import {
  ApolloCache,
  Cache,
  DocumentTransform,
  MissingFieldError,
  type DataProxy,
  type DocumentNode,
  type NormalizedCacheObject,
  type Reference,
  type Transaction,
  type Unmasked,
} from '@apollo/client';
import type {
  CanReadFunction,
  ToReferenceFunction,
} from '@apollo/client/cache/core/types/common';
import {
  addTypenameToDocument,
  isReference,
  type StoreObject,
} from '@apollo/client/utilities';
import { Kind, OperationTypeNode, type SelectionSetNode } from 'graphql';
import cloneVariables from '../utilities/cloneVariables.mjs';
import getMainDefinition from '../utilities/getMainDefinition.mjs';
import hasOwn from '../utilities/hasOwn.mjs';
import variablesToString from '../utilities/variablesToString.mjs';
import {
  SYMBOL_PROXY_ARRAY,
  type ChangedFieldsArray,
  type DataStoreObject,
  type FragmentMap,
  type MissingFieldRecord,
  type SupertypeMap,
} from './internalTypes.mjs';
import isProxyObject from './proxyObjects/isProxyObject.mjs';
import makeProxyObject from './proxyObjects/makeProxyObject.mjs';
import {
  PROXY_SYMBOL_BASE,
  PROXY_SYMBOL_DIRTY,
  type BaseCache,
  type ProxyCacheMap,
  type ProxyCacheRecord,
  type ProxyObject,
  type RevokedProxyRecords,
} from './proxyObjects/types.mjs';
import type {
  DataIdFromObjectFunction,
  KeyFields,
  OptimizedNormalizedCacheOptions,
  OptimizedReadMap,
  ReadFromIdFunction,
  WriteToCacheMap,
} from './types.mjs';
import evictData from './utilities/evictData.mjs';
import getFragmentMap from './utilities/getFragmentMap.mjs';
import getMissingFields from './utilities/getMissingFields.mjs';
import isObjectUsing from './utilities/isObjectUsing.mjs';
import isWatchingFields from './utilities/isWatchingFields.mjs';
import isWatchingIdFields from './utilities/isWatchingIdFields.mjs';
import makeReference from './utilities/makeReference.mjs';
import makeStoreId from './utilities/makeStoreId.mjs';
import markProxyDirtyRecursive from './utilities/markProxyDirtyRecursive.mjs';
import modifyField from './utilities/modifyField.mjs';
import releaseDataStoreObject from './utilities/releaseDataStoreObject.mjs';
import setFieldValues from './utilities/setFieldValues.mjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyVariable = any;

type WatcherData = [options: Cache.WatchOptions<object>, revoked: boolean];

type RootDataStoreObject = Record<string, DataStoreObject> & {
  ROOT_QUERY: DataStoreObject;
  ROOT_MUTATION: DataStoreObject;
  ROOT_SUBSCRIPTION: DataStoreObject;
};

function makeNewData(
  queryType: string,
  mutationType: string,
  subscriptionType: string
): RootDataStoreObject {
  return {
    __proto__: null as unknown as DataStoreObject, // hacky because TS does not ignore __proto__
    ROOT_QUERY: {
      __proto__: null,
      __typename: queryType,
      [SYMBOL_PROXY_ARRAY]: [],
    },
    ROOT_MUTATION: {
      __proto__: null,
      __typename: mutationType,
      [SYMBOL_PROXY_ARRAY]: [],
    },
    ROOT_SUBSCRIPTION: {
      __proto__: null,
      __typename: subscriptionType,
      [SYMBOL_PROXY_ARRAY]: [],
    },
  };
}
/**
 * Cache implementation with normalized cache, aiming to make performance faster than Apollo's `InMemoryCache`.
 * @example
 * ```ts
 * const cache = new OptimizedNormalizedCache();
 * const client = new ApolloClient({ cache });
 * ```
 */
export default class OptimizedNormalizedCache extends ApolloCache<NormalizedCacheObject> {
  public readonly assumeImmutableResults = true;

  // @internal
  public data: RootDataStoreObject;

  // @internal
  public readonly keyFields: KeyFields | undefined;
  // @internal
  public readonly supertypeMap: SupertypeMap | undefined;
  // @internal
  public readonly optimizedRead: OptimizedReadMap;
  // @internal
  public readonly dataIdFromObject: DataIdFromObjectFunction;
  // @internal
  public readonly readFromId: ReadFromIdFunction = (id) => this.data[id];
  // @internal
  public readonly setProxyCleanTimer: () => void;

  private readonly addTypenameTransform: DocumentTransform;
  private readonly writeToCacheMap: WriteToCacheMap;
  private readonly queryType: string;
  private readonly mutationType: string;
  private readonly subscriptionType: string;

  // @internal
  public proxyCacheMap: ProxyCacheMap;
  // @internal
  public proxyCacheRecords: ProxyCacheRecord[];
  // @internal
  public revokedProxyRecords: RevokedProxyRecords;
  private proxyCacheCleanTimer: ReturnType<typeof setTimeout> | undefined;

  private txCount: number;
  private readonly missingFieldsNothing: MissingFieldRecord[];
  private readonly missingFieldsExisting: MissingFieldRecord[];
  private readonly watchers: WatcherData[];

  public readonly canRead: CanReadFunction;
  public readonly toReference: ToReferenceFunction;

  /** For options, see {@link OptimizedNormalizedCacheOptions}. */
  public constructor(
    options: OptimizedNormalizedCacheOptions | undefined = {}
  ) {
    super();

    // Check whether this extends BaseCache instead of using `implements` (to avoid exposing `BaseCache` type)
    this satisfies BaseCache;

    this.addTypenameTransform = new DocumentTransform(addTypenameToDocument);

    this.keyFields = options.keyFields;
    // Convert possibleTypes to supertypeMap
    {
      const possibleTypes = options.possibleTypes;
      if (possibleTypes) {
        const supertypeMap: SupertypeMap = {};
        for (const type in possibleTypes) {
          const childTypes = possibleTypes[type] || [];
          for (const childType of childTypes) {
            const a = supertypeMap[childType] || (supertypeMap[childType] = []);
            a.push(type);
          }
        }
        if (Object.keys(supertypeMap).length > 0) {
          this.supertypeMap = supertypeMap;
        }
      }
    }
    this.optimizedRead = options.optimizedRead || {};
    this.writeToCacheMap = options.writeToCacheMap || {};
    this.dataIdFromObject =
      options.dataIdFromObject ||
      ((object) => makeStoreId(object, this.keyFields, this.supertypeMap));
    this.queryType = (options.rootTypes && options.rootTypes.Query) || 'Query';
    this.mutationType =
      (options.rootTypes && options.rootTypes.Mutation) || 'Mutation';
    this.subscriptionType =
      (options.rootTypes && options.rootTypes.Subscription) || 'Subscription';

    this.data = makeNewData(
      this.queryType,
      this.mutationType,
      this.subscriptionType
    );

    this.proxyCacheMap = new Map();
    this.proxyCacheRecords = [];
    this.revokedProxyRecords = [];

    this.txCount = 0;
    this.missingFieldsNothing = [];
    this.missingFieldsExisting = [];
    this.watchers = [];

    this.canRead = (objOrIdOrRef) => {
      if (typeof objOrIdOrRef === 'string') {
        return objOrIdOrRef in this.data;
      }
      if (isReference(objOrIdOrRef)) {
        return objOrIdOrRef.__ref in this.data;
      }
      return objOrIdOrRef != null && typeof objOrIdOrRef === 'object';
    };
    this.toReference = (objOrIdOrRef, mergeIntoStore) => {
      if (typeof objOrIdOrRef === 'string') {
        return makeReference(objOrIdOrRef);
      }
      if (isReference(objOrIdOrRef)) {
        return objOrIdOrRef;
      }
      const id = this.dataIdFromObject(objOrIdOrRef);
      if (id == null) {
        return undefined;
      }
      if (mergeIntoStore) {
        const changedFields: ChangedFieldsArray = [];
        setFieldValues(
          this.data,
          this.data.ROOT_QUERY,
          objOrIdOrRef,
          undefined,
          undefined,
          this.supertypeMap,
          this.dataIdFromObject,
          this.writeToCacheMap,
          'ROOT_QUERY',
          changedFields,
          undefined,
          false
        );
        this.updateProxiesAndMissingFields(changedFields);
      }
      return makeReference(id);
    };
    this.setProxyCleanTimer = this._setProxyCleanTimer.bind(this);
  }

  public override read<TData = AnyData, TVariables = AnyVariable>(
    query: Cache.ReadOptions<TVariables, TData>
  ): Unmasked<TData> | null {
    const definition = getMainDefinition(query.query);
    const fragmentMap = getFragmentMap(query.query);
    const variableString = variablesToString(query.variables);

    let typename: string;
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      typename =
        definition.operation === OperationTypeNode.MUTATION
          ? this.mutationType
          : definition.operation === OperationTypeNode.SUBSCRIPTION
            ? this.subscriptionType
            : this.queryType;
    } else {
      typename = definition.typeCondition.name.value;
    }

    const dataId = query.id || query.rootId || 'ROOT_QUERY';

    if (query.returnPartialData) {
      return this.getProxy(
        dataId,
        definition.selectionSet,
        fragmentMap,
        query.variables,
        variableString
      ) as Unmasked<TData> | null;
    }
    if (
      this.getMissingFields(
        dataId,
        typename,
        definition.selectionSet,
        fragmentMap,
        query.variables as Record<string, unknown> | undefined,
        variableString
      ).length > 0
    ) {
      return null;
    }
    return this.getProxy(
      dataId,
      definition.selectionSet,
      fragmentMap,
      query.variables,
      variableString
    ) as Unmasked<TData> | null;
  }

  public override write<TData = AnyData, TVariables = AnyVariable>(
    write: Cache.WriteOptions<TData, TVariables>
  ): Reference | undefined {
    const definition = getMainDefinition(write.query);
    const fragmentMap = getFragmentMap(write.query);
    const source = write.result;

    if (typeof source !== 'object') {
      // Not supported
      return undefined;
    }

    let typename: string;
    if (source && typeof source === 'object' && '__typename' in source) {
      typename = source.__typename as string;
    } else if (definition.kind === Kind.OPERATION_DEFINITION) {
      typename =
        definition.operation === OperationTypeNode.MUTATION
          ? this.mutationType
          : definition.operation === OperationTypeNode.SUBSCRIPTION
            ? this.subscriptionType
            : this.queryType;
    } else {
      typename = definition.typeCondition.name.value;
    }

    let dataId = write.dataId;
    if (!dataId) {
      switch (typename) {
        case this.queryType:
          dataId = 'ROOT_QUERY';
          break;
        case this.mutationType:
          dataId = 'ROOT_MUTATION';
          break;
        case this.subscriptionType:
          dataId = 'ROOT_SUBSCRIPTION';
          break;
        default:
          dataId = this.dataIdFromObject(source as object);
          if (!dataId) {
            return undefined;
          }
          break;
      }
    }

    if (isProxyObject(source)) {
      return makeReference(dataId);
    }

    const changedFields: ChangedFieldsArray = [];
    try {
      ++this.txCount;

      if (source == null) {
        if (write.dataId) {
          this.evict({ id: write.dataId });
        }
        return undefined;
      }

      const target =
        this.data[dataId] || (this.data[dataId] = { __proto__: null });
      setFieldValues(
        this.data,
        target,
        source,
        definition.selectionSet,
        fragmentMap,
        this.supertypeMap,
        this.dataIdFromObject,
        this.writeToCacheMap,
        dataId,
        changedFields,
        write.variables as Record<string, unknown> | undefined,
        false
      );

      return makeReference(dataId);
    } finally {
      this.updateProxiesAndMissingFields(changedFields);

      if (!--this.txCount && write.broadcast !== false) {
        this.broadcastAllWatchers();
      }
    }
  }

  public override diff<TData = AnyData, TVariables = AnyVariable>(
    query: Cache.DiffOptions<TData, TVariables>
  ): DataProxy.DiffResult<TData> {
    const definition = getMainDefinition(query.query);
    const fragmentMap = getFragmentMap(query.query);
    const variableString = variablesToString(query.variables);

    let typename: string;
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      typename =
        definition.operation === OperationTypeNode.MUTATION
          ? this.mutationType
          : definition.operation === OperationTypeNode.SUBSCRIPTION
            ? this.subscriptionType
            : this.queryType;
    } else {
      typename = definition.typeCondition.name.value;
    }

    const dataId = query.id || 'ROOT_QUERY';

    const missing = this.getMissingFields(
      dataId,
      typename,
      definition.selectionSet,
      fragmentMap,
      query.variables as Record<string, unknown> | undefined,
      variableString
    );

    if (query.returnPartialData !== false) {
      const proxy = this.getProxy(
        dataId,
        definition.selectionSet,
        fragmentMap,
        query.variables,
        variableString
      ) as TData | null;
      if (missing.length > 0) {
        return {
          complete: false,
          result: proxy || undefined,
          missing: [
            new MissingFieldError(
              `Missing fields: ${missing.join(',')}`,
              missing,
              query.query,
              query.variables as Record<string, unknown> | undefined
            ),
          ],
        };
      } else if (!proxy) {
        return {
          complete: false,
          missing: [
            new MissingFieldError(
              `Missing fields: ${dataId}`,
              [dataId],
              query.query,
              query.variables as Record<string, unknown> | undefined
            ),
          ],
        };
      } else {
        return {
          complete: true,
          result: proxy,
        };
      }
    }

    if (missing.length > 0) {
      throw new MissingFieldError(
        `Missing fields: ${missing.join(',')}`,
        missing,
        query.query,
        query.variables as Record<string, unknown> | undefined
      );
    } else {
      const proxy = this.getProxy(
        dataId,
        definition.selectionSet,
        fragmentMap,
        query.variables,
        variableString
      ) as TData | null;
      if (!proxy) {
        return {
          complete: false,
          missing: [
            new MissingFieldError(
              `Missing fields: ${dataId}`,
              [dataId],
              query.query,
              query.variables as Record<string, unknown> | undefined
            ),
          ],
        };
      }
      return {
        complete: true,
        result: proxy,
      };
    }
  }

  public override watch<TData = AnyData, TVariables = AnyVariable>(
    watch: Cache.WatchOptions<TData, TVariables>
  ): () => void {
    const newWatcher: WatcherData = [
      { ...watch } as Cache.WatchOptions<object>,
      false,
    ];
    this.watchers.push(newWatcher);
    return () => {
      const i = this.watchers.indexOf(newWatcher);
      if (i >= 0) {
        this.watchers.splice(i, 1);
      }
    };
  }

  public override reset(options?: Cache.ResetOptions): Promise<void> {
    try {
      ++this.txCount;

      if (options && options.discardWatches) {
        this.watchers.splice(0);
      }

      this.data = makeNewData(
        this.queryType,
        this.mutationType,
        this.subscriptionType
      );
      this.proxyCacheMap.clear();
      this.proxyCacheRecords.splice(0);
      this.revokedProxyRecords.splice(0);
      if (this.proxyCacheCleanTimer != null) {
        clearTimeout(this.proxyCacheCleanTimer);
        this.proxyCacheCleanTimer = undefined;
      }
      this.missingFieldsNothing.splice(0);
      this.missingFieldsExisting.splice(0);
      return Promise.resolve();
    } finally {
      if (!--this.txCount) {
        this.broadcastAllWatchers();
      }
    }
  }

  public override evict(options: Cache.EvictOptions): boolean {
    if (hasOwn(options, 'id') && options.id === undefined) {
      return false;
    }
    const id = options.id || 'ROOT_QUERY';
    if (!(id in this.data)) {
      return false;
    }

    const changedFields: ChangedFieldsArray = [];
    const removedObjects: object[] = [];

    try {
      ++this.txCount;
      let changed = evictData(
        this.data[id],
        [true, id],
        changedFields,
        removedObjects,
        options
      );
      if (
        id !== 'ROOT_QUERY' &&
        id !== 'ROOT_MUTATION' &&
        id !== 'ROOT_SUBSCRIPTION'
      ) {
        removedObjects.push(this.data[id] as object);
        changedFields.push([true, id]);
        delete this.data[id];
        changed = true;
      }
      changed = this.releaseObjects(removedObjects) || changed;
      return changed;
    } finally {
      this.updateProxiesAndMissingFields(changedFields);
      if (!--this.txCount && options.broadcast !== false) {
        this.broadcastAllWatchers();
      }
    }
  }

  public override restore(
    serializedState: NormalizedCacheObject
  ): ApolloCache<NormalizedCacheObject> {
    const d: typeof this.data = makeNewData(
      this.queryType,
      this.mutationType,
      this.subscriptionType
    );
    // Pick fields with id
    for (const key in serializedState) {
      if (
        key === 'ROOT_QUERY' ||
        key === 'ROOT_MUTATION' ||
        key === 'ROOT_SUBSCRIPTION'
      ) {
        continue;
      }
      d[key] = { __proto__: null, ...serializedState[key] };
    }
    for (const key in serializedState) {
      const targetParent =
        key === 'ROOT_QUERY' ||
        key === 'ROOT_MUTATION' ||
        key === 'ROOT_SUBSCRIPTION'
          ? d
          : undefined;
      storeToObject(
        d,
        targetParent,
        d[key] as Record<string, unknown>,
        key,
        serializedState[key]
      );
    }
    this.data = d;
    return this;

    function storeToObject(
      rootStore: Record<string, unknown>,
      targetParent: Record<string, unknown> | undefined,
      source: Record<string, unknown> | undefined,
      fieldName: string,
      value: unknown
    ) {
      let r: unknown;
      if (value == null || typeof value !== 'object') {
        r = value;
      } else if (value instanceof Array) {
        r = value.map((v: unknown) =>
          storeToObject(rootStore, undefined, undefined, '', v)
        );
      } else if (isReference(value)) {
        r = rootStore[value.__ref];
      } else {
        r = source || { __proto__: null };
        for (const key in value) {
          storeToObject(
            rootStore,
            r as Record<string, unknown>,
            undefined,
            key,
            (value as Record<string, unknown>)[key]
          );
        }
      }
      if (targetParent && r !== undefined) {
        targetParent[fieldName] = r;
      }
      return r;
    }
  }

  public override extract(_optimistic?: boolean): NormalizedCacheObject {
    const rootStore = this.data;
    return JSON.parse(
      JSON.stringify(rootStore)
    ) as unknown as NormalizedCacheObject;
  }

  public override removeOptimistic(_id: string): void {
    throw new Error('Method not implemented.');
  }

  public override performTransaction(
    transaction: Transaction<NormalizedCacheObject>,
    optimisticId?: string | null
  ): void {
    if (optimisticId != null) {
      throw new Error('Optimistic not implemented');
    }

    try {
      ++this.txCount;
      transaction(this);
    } finally {
      if (!--this.txCount) {
        this.broadcastAllWatchers();
      }
    }
  }

  public override modify<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Entity extends Record<string, any> = Record<string, any>,
  >(options: Cache.ModifyOptions<Entity>): boolean {
    if (hasOwn(options, 'id') && !options.id) {
      return false;
    }
    const id = options.id || 'ROOT_QUERY';
    if (!(id in this.data)) {
      return false;
    }
    const d = this.data[id];
    if (d == null || typeof d !== 'object') {
      return false;
    }

    const changedFields: ChangedFieldsArray = [];
    try {
      ++this.txCount;
      return modifyField(
        this.data,
        d,
        options.fields,
        this.supertypeMap,
        this.canRead,
        this.toReference,
        this.optimizedRead,
        this.dataIdFromObject,
        this.readFromId,
        [false, id],
        changedFields
      );
    } finally {
      this.updateProxiesAndMissingFields(changedFields);
      if (!--this.txCount && options.broadcast !== false) {
        this.broadcastAllWatchers();
      }
    }
  }

  public override transformDocument(document: DocumentNode): DocumentNode {
    return this.addTypenameTransform.transformDocument(document);
  }

  public override identify(
    object: StoreObject | Reference
  ): string | undefined {
    if (isReference(object)) {
      return object.__ref;
    }
    return this.dataIdFromObject(object);
  }

  public override gc(options?: { resetResultCache?: boolean }): string[] {
    const ids: string[] = [];

    for (const key in this.data) {
      if (
        key === 'ROOT_QUERY' ||
        key === 'ROOT_MUTATION' ||
        key === 'ROOT_SUBSCRIPTION'
      ) {
        continue;
      }
      const o = this.data[key];
      if (!isObjectUsing(o, key, this.data, true)) {
        ids.push(key);
      }
    }
    for (let l = ids.length, i = 0; i < l; ++i) {
      const key = ids[i]!;
      const o = this.data[key];
      delete this.data[key];
      releaseDataStoreObject(o);
    }

    if (options && options.resetResultCache) {
      markProxyDirtyRecursive(this.data);

      this.proxyCacheMap.clear();
      this.proxyCacheRecords.splice(0);
      this.revokedProxyRecords.splice(0);
      if (this.proxyCacheCleanTimer != null) {
        clearTimeout(this.proxyCacheCleanTimer);
        this.proxyCacheCleanTimer = undefined;
      }
      this.missingFieldsNothing.splice(0);
      this.missingFieldsExisting.splice(0);
    }

    return ids;
  }

  private getMissingFields(
    id: string,
    typename: string,
    selectionSet: SelectionSetNode,
    fragmentMap: FragmentMap,
    variables: Record<string, unknown> | undefined,
    variableString: string
  ) {
    for (
      let mf = this.missingFieldsExisting, l = mf.length, i = 0;
      i < l;
      ++i
    ) {
      const mfs = mf[i]!;
      if (mfs[0] === selectionSet && mfs[3] === variableString) {
        return mfs[4];
      }
    }
    for (let mf = this.missingFieldsNothing, l = mf.length, i = 0; i < l; ++i) {
      const mfs = mf[i]!;
      if (mfs[0] === selectionSet && mfs[3] === variableString) {
        return mfs[4];
      }
    }
    const missing = getMissingFields(
      this.data[id] as object | null | undefined,
      selectionSet,
      fragmentMap,
      this.data,
      this.supertypeMap,
      this.optimizedRead,
      {
        dataIdFromObject: this.dataIdFromObject,
        readFromId: this.readFromId,
        checkExistenceOnly: true,
        effectiveArguments: {},
      },
      typename,
      variables
    );
    const record: MissingFieldRecord = [
      selectionSet,
      fragmentMap,
      cloneVariables(variables),
      variableString,
      missing,
    ];
    if (missing.length > 0) {
      this.missingFieldsExisting.push(record);
    } else {
      this.missingFieldsNothing.push(record);
    }
    return missing;
  }

  private getProxy(
    id: string,
    selectionSet: SelectionSetNode,
    fragmentMap: FragmentMap,
    variables: unknown,
    variablesString: string
  ): unknown {
    const o = this.data[id];
    if (!o) {
      return null;
    }
    if (typeof o !== 'object') {
      return o;
    }
    return makeProxyObject(
      o,
      [selectionSet],
      id,
      variables,
      variablesString,
      fragmentMap,
      this
    );
  }

  private releaseObjects(objects: object[]): boolean {
    const gathered = new WeakSet<object>();
    gatherAllObjects(objects);
    return impl(this.data.ROOT_QUERY);

    function gatherAllObjects(array: unknown[]) {
      for (let l = array.length, i = 0; i < l; ++i) {
        const o = array[i];
        if (o != null && typeof o === 'object') {
          if (!gathered.has(o)) {
            gathered.add(o);
            gatherAllObjects(Object.values(o));
          }
        }
      }
    }

    function impl(target: unknown): boolean {
      if (target == null || typeof target !== 'object') {
        return false;
      }
      let found = false;
      for (const key in target) {
        const o = (target as Record<string, unknown>)[key];
        if (gathered.has(o as object)) {
          found = true;
          delete (target as Record<string, unknown>)[key];
        }
      }
      return found;
    }
  }

  private updateProxiesAndMissingFields(changedFields: ChangedFieldsArray) {
    const [rootFields, idFields] = changedFields.reduce<
      [ChangedFieldsArray, ChangedFieldsArray]
    >(
      (prev, cur) => {
        if (cur[1] === 'ROOT_QUERY') {
          prev[0].push(cur);
        } else {
          prev[1].push(cur);
        }
        return prev;
      },
      [[], []]
    );

    const dirtyMissings: MissingFieldRecord[] = [];
    for (let l = rootFields.length, j = 0; j < l; ++j) {
      const changedFields = rootFields[j]!;
      const isDeleted = changedFields[0];
      if (isDeleted) {
        for (
          let mfs = this.missingFieldsNothing, i = mfs.length - 1;
          i >= 0;
          --i
        ) {
          const missingField = mfs[i]!;
          if (
            isWatchingFields(
              this.data.ROOT_QUERY,
              missingField[0],
              missingField[1],
              changedFields,
              idFields,
              2,
              missingField[2],
              this.keyFields,
              this.supertypeMap,
              this.dataIdFromObject
            )
          ) {
            dirtyMissings.push(missingField);
            mfs.splice(i);
          }
        }
      }
      for (
        let mfs = this.missingFieldsExisting, i = mfs.length - 1;
        i >= 0;
        --i
      ) {
        const missingField = mfs[i]!;
        if (
          isWatchingFields(
            this.data.ROOT_QUERY,
            missingField[0],
            missingField[1],
            changedFields,
            idFields,
            2,
            missingField[2],
            this.keyFields,
            this.supertypeMap,
            this.dataIdFromObject
          )
        ) {
          dirtyMissings.push(missingField);
          mfs.splice(i);
        }
      }
    }
    for (let l = idFields.length, j = 0; j < l; ++j) {
      const changedFields = idFields[j]!;
      const isDeleted = changedFields[0];
      if (isDeleted) {
        for (
          let mfs = this.missingFieldsNothing, i = mfs.length - 1;
          i >= 0;
          --i
        ) {
          const missingField = mfs[i]!;
          if (
            isWatchingIdFields(
              this.data,
              missingField[0],
              missingField[1],
              changedFields,
              idFields,
              missingField[2],
              this.keyFields,
              this.supertypeMap,
              this.dataIdFromObject
            )
          ) {
            dirtyMissings.push(missingField);
            mfs.splice(i);
          }
        }
      }
      for (
        let mfs = this.missingFieldsExisting, i = mfs.length - 1;
        i >= 0;
        --i
      ) {
        const missingField = mfs[i]!;
        if (
          isWatchingIdFields(
            this.data,
            missingField[0],
            missingField[1],
            changedFields,
            idFields,
            missingField[2],
            this.keyFields,
            this.supertypeMap,
            this.dataIdFromObject
          )
        ) {
          dirtyMissings.push(missingField);
          mfs.splice(i);
        }
      }
    }

    this.releaseProxyForWatchers(dirtyMissings);
  }

  private releaseProxyForWatchers(dirtyMissings: MissingFieldRecord[]) {
    for (let wt = this.watchers, l = wt.length, i = 0; i < l; ++i) {
      const data = wt[i]!;
      if (data[1]) {
        continue;
      }
      const w = data[0];
      const proxy =
        w.lastDiff && w.lastDiff.result && (w.lastDiff.result as ProxyObject);
      const base = proxy && proxy[PROXY_SYMBOL_BASE];
      if (proxy == null || base == null) {
        w.lastDiff = undefined;
        data[1] = true;
        continue;
      }

      const definition = getMainDefinition(w.query);
      const variableString = variablesToString(w.variables);

      if (
        dirtyMissings.some(
          (missingField) =>
            missingField[0] === definition.selectionSet &&
            missingField[3] === variableString
        )
      ) {
        proxy[PROXY_SYMBOL_DIRTY] = true;
      }

      if (proxy[PROXY_SYMBOL_DIRTY]) {
        data[1] = true;
      }
    }
  }

  private _setProxyCleanTimer() {
    if (typeof setTimeout === 'undefined') {
      return;
    }
    if (this.proxyCacheCleanTimer !== undefined) {
      clearTimeout(this.proxyCacheCleanTimer);
    }
    this.proxyCacheCleanTimer = setTimeout(
      () => this.cleanOldProxyCacheRecords(),
      2000
    );
  }

  private cleanOldProxyCacheRecords() {
    this.proxyCacheCleanTimer = undefined;

    const records = this.revokedProxyRecords.splice(0);
    for (let l = records.length, i = 0; i < l; ++i) {
      const [record, parent] = records[i]!;
      {
        const i = parent.indexOf(record);
        if (i >= 0) {
          parent.splice(i, 1);
        }
      }
      {
        const i = this.proxyCacheRecords.indexOf(record);
        if (i >= 0) {
          this.proxyCacheRecords.splice(i, 1);
        }
      }
    }

    if (this.proxyCacheRecords.length > 500000) {
      const records = this.proxyCacheRecords
        .sort((a, b) => b[3] - a[3])
        .splice(200000);
      deleteOldProxies(this.proxyCacheMap, records);
    }

    function deleteOldProxies(map: ProxyCacheMap, records: ProxyCacheRecord[]) {
      for (const [, entry] of map) {
        for (let i = entry.r.length - 1; i >= 0; --i) {
          const record = entry.r[i]!;
          const j = records.indexOf(record);
          if (i >= 0) {
            records.splice(j, 1);
            entry.r.splice(i, 1);
            if (records.length === 0) {
              break;
            }
          }
        }
        if (records.length === 0) {
          break;
        }
        if (entry.sm) {
          deleteOldProxies(entry.sm, records);
        }
      }
    }
  }

  private broadcastAllWatchers() {
    for (let wt = this.watchers, l = wt.length, i = 0; i < l; ++i) {
      const watcher = wt[i]!;
      if (!watcher[1]) {
        continue;
      }

      watcher[1] = false;
      const options = watcher[0];
      const lastDiff = options.lastDiff;
      const diff = this.diff<object>(options);
      options.lastDiff = diff;
      options.callback(diff, lastDiff);
    }
  }
}
