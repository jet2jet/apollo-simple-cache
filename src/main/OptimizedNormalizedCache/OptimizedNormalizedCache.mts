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
import type {
  ChangedFieldsArray,
  FragmentMap,
  MissingFieldRecord,
  SupertypeMap,
} from './internalTypes.mjs';
import isProxyObject from './proxyObjects/isProxyObject.mjs';
import makeProxyObject from './proxyObjects/makeProxyObject.mjs';
import releaseProxyRecords from './proxyObjects/releaseProxyRecords.mjs';
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
import isWatchingFields from './utilities/isWatchingFields.mjs';
import isWatchingIdFields from './utilities/isWatchingIdFields.mjs';
import makeStoreId from './utilities/makeStoreId.mjs';
import modifyField from './utilities/modifyField.mjs';
import setFieldValues from './utilities/setFieldValues.mjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyVariable = any;

type WatcherData = [options: Cache.WatchOptions<object>, revoked: boolean];

function makeNewData(queryType: string, mutationType: string) {
  return Object.assign(Object.create(null) as object, {
    ROOT_QUERY: Object.assign(Object.create(null) as object, {
      __typename: queryType,
    }),
    ROOT_MUTATION: Object.assign(Object.create(null) as object, {
      __typename: mutationType,
    }),
  });
}

export default class OptimizedNormalizedCache extends ApolloCache<NormalizedCacheObject> {
  public readonly assumeImmutableResults = true;

  private data: Record<string, unknown> & {
    ROOT_QUERY: Record<string, unknown>;
    ROOT_MUTATION: Record<string, unknown>;
  };

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

  // @internal
  public proxyCacheMap: ProxyCacheMap;
  // @internal
  public proxyCacheRecords: ProxyCacheRecord[];
  // @internal
  public revokedProxyRecords: RevokedProxyRecords;
  private proxyCacheCleanTimer: ReturnType<typeof setTimeout> | undefined;

  private txCount: number;
  private readonly missingFields: MissingFieldRecord[];
  private readonly watchers: WatcherData[];

  public readonly canRead: CanReadFunction;
  public readonly toReference: ToReferenceFunction;

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

    this.data = makeNewData(this.queryType, this.mutationType);

    this.proxyCacheMap = new Map();
    this.proxyCacheRecords = [];
    this.revokedProxyRecords = [];

    this.txCount = 0;
    this.missingFields = [];
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
        return { __ref: objOrIdOrRef };
      }
      if (isReference(objOrIdOrRef)) {
        return objOrIdOrRef;
      }
      const id = makeStoreId(objOrIdOrRef, this.keyFields, this.supertypeMap);
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
          this.keyFields,
          this.supertypeMap,
          this.writeToCacheMap,
          'ROOT_QUERY',
          changedFields,
          undefined,
          false
        );
        this.updateProxiesAndMissingFields(changedFields);
      }
      return { __ref: id };
    };
    this.setProxyCleanTimer = this._setProxyCleanTimer.bind(this);
  }

  public override read<TData = AnyData, TVariables = AnyVariable>(
    query: Cache.ReadOptions<TVariables, TData>
  ): Unmasked<TData> | null {
    const definition = getMainDefinition(query.query);
    const fragmentMap = getFragmentMap(query.query);
    const variableString = variablesToString(query.variables);

    if (query.returnPartialData) {
      return this.getProxy(
        definition.selectionSet,
        fragmentMap,
        query.variables,
        variableString
      ) as Unmasked<TData>;
    }
    if (
      this.getMissingFields(
        definition.selectionSet,
        fragmentMap,
        query.variables as Record<string, unknown> | undefined,
        variableString
      ).length > 0
    ) {
      return null;
    }
    return this.getProxy(
      definition.selectionSet,
      fragmentMap,
      query.variables,
      variableString
    ) as Unmasked<TData>;
  }

  public override write<TData = AnyData, TVariables = AnyVariable>(
    write: Cache.WriteOptions<TData, TVariables>
  ): Reference | undefined {
    if (hasOwn(write, 'dataId') && write.dataId === undefined) {
      return undefined;
    }

    const definition = getMainDefinition(write.query);
    const fragmentMap = getFragmentMap(write.query);
    const source = write.result;

    if (typeof source !== 'object') {
      // Not supported
      return undefined;
    }

    let rootId = 'ROOT_QUERY';
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      if (definition.operation === OperationTypeNode.QUERY) {
        // do nothing
      } else if (definition.operation === OperationTypeNode.MUTATION) {
        rootId = 'ROOT_MUTATION;';
      } else {
        throw new Error('Subscription not supported');
      }
    }

    if (isProxyObject(source)) {
      return { __ref: rootId };
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

      const id = write.dataId || rootId;
      const target = this.data[id] || (this.data[id] = Object.create(null));
      setFieldValues(
        this.data,
        target,
        source,
        definition.selectionSet,
        fragmentMap,
        this.keyFields,
        this.supertypeMap,
        this.writeToCacheMap,
        id,
        changedFields,
        write.variables as Record<string, unknown> | undefined,
        false
      );

      return { __ref: id };
    } finally {
      this.updateProxiesAndMissingFields(changedFields);

      if (!--this.txCount && write.broadcast !== false) {
        this.broadcastAllWatchers();
      }
    }
  }

  public override diff<T>(query: Cache.DiffOptions): DataProxy.DiffResult<T> {
    const definition = getMainDefinition(query.query);
    const fragmentMap = getFragmentMap(query.query);
    const variableString = variablesToString(query.variables);
    const missing = this.getMissingFields(
      definition.selectionSet,
      fragmentMap,
      query.variables as Record<string, unknown> | undefined,
      variableString
    );

    if (query.returnPartialData !== false) {
      const proxy = this.getProxy(
        definition.selectionSet,
        fragmentMap,
        query.variables,
        variableString
      );
      if (missing.length > 0) {
        return {
          complete: false,
          result: proxy as T,
          missing: [
            new MissingFieldError(
              `Missing fields: ${missing.join(',')}`,
              missing,
              query.query,
              query.variables
            ),
          ],
        };
      } else {
        return {
          complete: true,
          result: proxy as T,
        };
      }
    }

    if (missing.length > 0) {
      throw new MissingFieldError(
        `Missing fields: ${missing.join(',')}`,
        missing,
        query.query,
        query.variables
      );
    } else {
      return {
        complete: true,
        result: this.getProxy(
          definition.selectionSet,
          fragmentMap,
          query.variables,
          variableString
        ) as T,
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

      this.data = makeNewData(this.queryType, this.mutationType);
      this.proxyCacheMap.clear();
      this.proxyCacheRecords.splice(0);
      this.revokedProxyRecords.splice(0);
      if (this.proxyCacheCleanTimer != null) {
        clearTimeout(this.proxyCacheCleanTimer);
        this.proxyCacheCleanTimer = undefined;
      }
      this.missingFields.splice(0);
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
        [id],
        changedFields,
        removedObjects,
        options
      );
      if (id !== 'ROOT_QUERY' && id !== 'ROOT_MUTATION') {
        removedObjects.push(this.data[id] as object);
        changedFields.push([id]);
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
    const d: typeof this.data = makeNewData(this.queryType, this.mutationType);
    // Pick fields with id
    for (const key in serializedState) {
      if (key === 'ROOT_QUERY' || key === 'ROOT_MUTATION') {
        continue;
      }
      d[key] = Object.assign(Object.create(null), serializedState[key]);
    }
    for (const key in serializedState) {
      const targetParent =
        key === 'ROOT_QUERY' || key === 'ROOT_MUTATION' ? d : undefined;
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
        r = source || Object.create(null);
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
    const objectsWithId = Object.entries(this.data).filter(
      (x) => x[0] !== 'ROOT_QUERY' && x[0] !== 'ROOT_MUTATION'
    ) as Array<[string, object]>;
    // Replace objects with id ref
    const rootStore = this.data;
    return JSON.parse(
      JSON.stringify(rootStore, function (_, v) {
        if (v == null || typeof v !== 'object') {
          return v;
        }
        if (this === rootStore) {
          return v;
        }
        const x = objectsWithId.find((x) => v === x[1]);
        return x ? { __ref: x[0] } : v;
      })
    );
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
        this.keyFields,
        this.supertypeMap,
        this.canRead,
        this.toReference,
        this.optimizedRead,
        this.dataIdFromObject,
        this.readFromId,
        [id],
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
    return makeStoreId(object, this.keyFields, this.supertypeMap);
  }

  private getMissingFields(
    selectionSet: SelectionSetNode,
    fragmentMap: FragmentMap,
    variables: Record<string, unknown> | undefined,
    variableString: string
  ) {
    const mf = this.missingFields;
    for (let l = mf.length, i = 0; i < l; ++i) {
      const missing = mf[i]!;
      if (missing[0] === selectionSet && missing[3] === variableString) {
        return missing[4];
      }
    }
    const missing = getMissingFields(
      this.data.ROOT_QUERY,
      selectionSet,
      fragmentMap,
      this.supertypeMap,
      this.optimizedRead,
      this.dataIdFromObject,
      this.readFromId,
      this.queryType,
      variables
    );
    mf.push([
      selectionSet,
      fragmentMap,
      cloneVariables(variables),
      variableString,
      missing,
    ]);
    return missing;
  }

  private getProxy(
    selectionSet: SelectionSetNode,
    fragmentMap: FragmentMap,
    variables: unknown,
    variablesString: string
  ): ProxyObject {
    return makeProxyObject(
      this.data.ROOT_QUERY,
      [selectionSet],
      'ROOT_QUERY',
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
        if (cur[0] === 'ROOT_QUERY') {
          prev[0].push(cur);
        } else {
          prev[1].push(cur);
        }
        return prev;
      },
      [[], []]
    );

    const mf = this.missingFields;
    for (let i = mf.length - 1; i >= 0; --i) {
      const missingField = mf[i]!;
      let found = false;
      for (let l = rootFields.length, j = 0; j < l; ++j) {
        if (
          isWatchingFields(
            this.data.ROOT_QUERY,
            missingField[0],
            missingField[1],
            rootFields[j]!,
            idFields,
            1,
            missingField[2],
            this.keyFields,
            this.supertypeMap
          )
        ) {
          found = true;
          break;
        }
      }
      if (found) {
        mf.splice(i, 1);
      }
    }

    releaseProxyRecords(
      this.proxyCacheMap,
      this.proxyCacheRecords,
      rootFields,
      idFields
    );

    this.releaseProxyForWatchers(rootFields, idFields);
  }

  private releaseProxyForWatchers(
    rootFields: ChangedFieldsArray,
    idFields: ChangedFieldsArray
  ) {
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

      const def = getMainDefinition(w.query);
      const map = getFragmentMap(w.query);
      let isWatching = false;
      const m = rootFields.length;
      for (let j = 0; j < m; ++j) {
        if (
          isWatchingFields(
            this.data.ROOT_QUERY,
            def.selectionSet,
            map,
            rootFields[j]!,
            idFields,
            1,
            w.variables,
            this.keyFields,
            this.supertypeMap
          )
        ) {
          isWatching = true;
          break;
        }
      }
      if (!isWatching && idFields.length) {
        if (
          isWatchingIdFields(
            this.data.ROOT_QUERY,
            def.selectionSet,
            map,
            idFields,
            w.variables,
            this.keyFields,
            this.supertypeMap
          )
        ) {
          isWatching = true;
        }
      }

      if (isWatching) {
        proxy[PROXY_SYMBOL_DIRTY] = true;
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
