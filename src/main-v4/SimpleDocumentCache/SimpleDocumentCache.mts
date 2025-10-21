import {
  ApolloCache,
  isReference,
  MissingFieldError,
  type Cache,
  type OperationVariables,
  type Reference,
  type StoreObject,
  type Transaction,
  type Unmasked,
} from '@apollo/client';
import type {
  Modifier,
  ModifierDetails,
  ReadFieldOptions,
  StoreValue,
} from '@apollo/client/cache';
import {
  type DocumentNode,
  type FragmentDefinitionNode,
  type InlineFragmentNode,
} from 'graphql';
import {
  DELETE_MODIFIER,
  INVALIDATE_MODIFIER,
} from '../utilities/constants.mjs';
import equal from '../utilities/equal.mjs';
import getMainDefinition from '../utilities/getMainDefinition.mjs';
import hasOwn from '../utilities/hasOwn.mjs';
import variablesToString from '../utilities/variablesToString.mjs';
import type {
  CacheKey,
  CacheObject,
  SimpleDocumentCacheOptions,
} from './types.mjs';

type DataStore = Record<CacheKey, StoreObject>;

function defaultGetCacheKey<TVariables>(
  document: DocumentNode,
  variables: TVariables | undefined
): CacheKey {
  const name = getMainDefinition(document).name?.value;
  if (name == null) {
    throw new Error('Default cache key requires operation name');
  }
  const varString = variablesToString(variables);
  const varSuffix = varString ? `:${varString}` : '';
  return `${name}${varSuffix}`;
}

function refToCacheKey(ref: Reference): CacheKey {
  return ref.__ref;
}

function cacheKeyToRef(cacheKey: CacheKey): Reference {
  return { __ref: cacheKey };
}

/**
 * Simplified cache implementation with document cache.
 * @example
 * ```ts
 * const cache = new SimpleDocumentCache();
 * const client = new ApolloClient({ cache });
 * ```
 */
export default class SimpleDocumentCache extends ApolloCache {
  private data: DataStore;
  private readonly getCacheKey: <TVariables>(
    document: DocumentNode,
    variables: TVariables | undefined
  ) => CacheKey;

  private txCount: number;
  private readonly watchers: Map<CacheKey, Cache.WatchOptions[]>;
  private readonly dirtyKeys: CacheKey[];

  /** See options for {@link SimpleDocumentCacheOptions} */
  public constructor(options?: SimpleDocumentCacheOptions) {
    super();

    this.getCacheKey = options?.getCacheKey ?? defaultGetCacheKey;

    this.data = {};
    this.txCount = 0;
    this.watchers = new Map();
    this.dirtyKeys = [];
  }

  public override read<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(query: Cache.ReadOptions<TData, TVariables>): Unmasked<TData> | null {
    const key = this.getCacheKey(query.query, query.variables);
    const data = this.data[key] as Unmasked<TData> | undefined;
    return data !== undefined ? data : null;
  }

  public override write<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(write: Cache.WriteOptions<TData, TVariables>): Reference | undefined {
    try {
      ++this.txCount;
      const key = this.getCacheKey(write.query, write.variables);
      this.data[key] = write.result as StoreObject;
      this.dirtyKeys.push(key);
      return cacheKeyToRef(key);
    } finally {
      if (--this.txCount === 0 && write.broadcast !== false) {
        this.broadcastDirtyWatchers();
      }
    }
  }

  public override diff<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(query: Cache.DiffOptions<TData, TVariables>): Cache.DiffResult<TData> {
    if (query.previousResult && isReference(query.previousResult)) {
      const key = refToCacheKey(query.previousResult);
      const data = this.data[key] as TData | undefined;
      if (data !== undefined) {
        return {
          complete: true,
          result: data,
        };
      }
    }
    const key = this.getCacheKey(query.query, query.variables);
    const data = this.data[key] as TData | undefined;
    if (data === undefined) {
      return {
        complete: false,
        result: null,
        missing: new MissingFieldError(
          `'${key}' is not found`,
          [key],
          query.query,
          query.variables as Record<string, unknown> | undefined
        ),
      };
    } else {
      return {
        complete: true,
        result: data,
      };
    }
  }

  public override watch<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(watch: Cache.WatchOptions<TData, TVariables>): () => void {
    const watchObject = { ...watch };
    const key = this.getCacheKey(watch.query, watch.variables);
    let rec = this.watchers.get(key);
    if (!rec) {
      rec = [];
      this.watchers.set(key, rec);
    }
    rec.push(watchObject as Cache.WatchOptions);
    return () => {
      const i = rec.indexOf(watchObject as Cache.WatchOptions);
      if (i >= 0) {
        rec.splice(i, 1);
        if (rec.length === 0) {
          this.watchers.delete(key);
        }
      }
    };
  }

  public override reset(options?: Cache.ResetOptions): Promise<void> {
    if (options?.discardWatches) {
      this.watchers.clear();
    }
    this.data = {};
    this.dirtyKeys.splice(0);
    this.broadcastAllWatchers();
    return Promise.resolve();
  }

  public override evict(options: Cache.EvictOptions): boolean {
    return this.modify({
      fields: (_, details) => details.DELETE,
      broadcast: options.broadcast,
      id: options.id,
    });
  }

  public override restore(serializedState: unknown): this {
    this.data = serializedState as DataStore;
    this.dirtyKeys.splice(0);
    return this;
  }

  public override extract(optimistic?: boolean): CacheObject {
    if (optimistic) {
      return {};
    }
    return this.data;
  }

  public override removeOptimistic(_id: string): void {
    throw new Error('Method not implemented.');
  }

  public override fragmentMatches(
    fragment: InlineFragmentNode | FragmentDefinitionNode,
    typename: string
  ): boolean {
    if (!fragment.typeCondition) {
      return true;
    }
    if (!typename) {
      return false;
    }
    return fragment.typeCondition.name.value === typename;
  }

  public override performTransaction(
    transaction: Transaction,
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
        this.broadcastDirtyWatchers();
      }
    }
  }

  public override modify<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Entity extends Record<string, any> = Record<string, any>,
  >(options: Cache.ModifyOptions<Entity>): boolean {
    if (hasOwn(options, 'id') && options.id === undefined) {
      return false;
    }

    const { broadcast, fields, id } = options;
    const baseDetails = {
      DELETE: DELETE_MODIFIER,
      INVALIDATE: INVALIDATE_MODIFIER,
      canRead: (value) => {
        return isReference(value) ? refToCacheKey(value) in this.data : false;
      },
      isReference,
      toReference: (objOrIdOrRef) => {
        return isReference(objOrIdOrRef)
          ? objOrIdOrRef
          : typeof objOrIdOrRef === 'string'
            ? { __ref: objOrIdOrRef }
            : undefined;
      },
      storage: {},
    } satisfies Partial<ModifierDetails>;

    let isModified = false;

    try {
      ++this.txCount;

      if (id != null) {
        if (!(id in this.data)) {
          return false;
        }
        const obj = this.data[id]!;
        const r = modifyImpl(obj, this.data);
        let mod;
        if (r === DELETE_MODIFIER) {
          mod = true;
          delete this.data[id];
        } else {
          mod = r !== undefined;
          if (mod) {
            this.data[id] = r as StoreObject;
          }
        }
        isModified ||= mod;
        if (mod) {
          this.dirtyKeys.push(id);
        }
      } else {
        for (const [key, obj] of Object.entries(this.data)) {
          if (obj === undefined) {
            continue;
          }
          const r = modifyImpl(obj, this.data);
          let mod;
          if (r === DELETE_MODIFIER) {
            mod = true;
            delete this.data[key];
          } else {
            mod = r !== undefined;
            if (mod) {
              this.data[key] = r as StoreObject;
            }
          }
          isModified ||= mod;
          if (mod) {
            this.dirtyKeys.push(key);
          }
        }
      }

      return isModified;
    } finally {
      if (!--this.txCount && broadcast !== false) {
        this.broadcastDirtyWatchers();
      }
    }

    function modifyImpl(
      obj: StoreObject,
      data: DataStore
    ): StoreObject | typeof DELETE_MODIFIER | undefined {
      let isModified = false;
      const newObj: StoreObject = {};
      for (const fieldName in obj) {
        const value = obj[fieldName];
        const fn = (
          typeof fields === 'function' ? fields : fields[fieldName]
        ) as Modifier<unknown> | undefined;
        if (fn == null) {
          newObj[fieldName] = value;
          continue;
        }
        const details: ModifierDetails = {
          ...baseDetails,
          fieldName,
          storeFieldName: fieldName,
          readField: (
            fieldNameOrOptions: string | ReadFieldOptions,
            from?: StoreObject | Reference
          ) => {
            if (typeof fieldNameOrOptions !== 'string') {
              from = fieldNameOrOptions.from;
              fieldNameOrOptions = fieldNameOrOptions.fieldName;
            }
            const o = isReference(from)
              ? data[refToCacheKey(from)]
              : (from ?? obj);
            if (o === undefined) {
              return undefined;
            }
            return (o as Record<string, unknown>)[fieldNameOrOptions];
          },
        };
        const newValue = fn(value, details);
        if (newValue === DELETE_MODIFIER || newValue === INVALIDATE_MODIFIER) {
          // If field is deleted or invalidated, delete entire store object to trigger refetch
          return DELETE_MODIFIER;
        } else if (!equal(value, newValue)) {
          isModified = true;
        }
        newObj[fieldName] = newValue as StoreValue;
      }
      return isModified ? newObj : undefined;
    }
  }

  private broadcastAllWatchers() {
    for (const key of this.watchers.keys()) {
      this.broadcastWatcher(key);
    }
  }

  private broadcastDirtyWatchers() {
    for (const key of this.dirtyKeys.splice(0)) {
      this.broadcastWatcher(key);
    }
  }

  private broadcastWatcher(key: CacheKey) {
    const rec = this.watchers.get(key);
    if (!rec) {
      return;
    }
    for (const w of rec) {
      const lastDiff = w.lastDiff;
      const diff = this.diff(w);
      if (!equal(lastDiff, (w.lastDiff = diff))) {
        w.callback(diff, lastDiff);
      }
    }
  }
}
