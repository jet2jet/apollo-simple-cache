import {
  ApolloCache,
  Cache,
  isReference,
  MissingFieldError,
  type DataProxy,
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
import { type DocumentNode } from 'graphql';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyVariable = any;

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
export default class SimpleDocumentCache extends ApolloCache<CacheObject> {
  private data: DataStore;
  private readonly getCacheKey: <TVariables>(
    document: DocumentNode,
    variables: TVariables | undefined
  ) => CacheKey;

  private txCount: number;
  private readonly watchers: Cache.WatchOptions[];

  /** See options for {@link SimpleDocumentCacheOptions} */
  public constructor(options?: SimpleDocumentCacheOptions) {
    super();

    this.getCacheKey = options?.getCacheKey ?? defaultGetCacheKey;

    this.data = {};
    this.txCount = 0;
    this.watchers = [];
  }

  public override read<TData = AnyData, TVariables = AnyVariable>(
    query: Cache.ReadOptions<TVariables, TData>
  ): Unmasked<TData> | null {
    const key = this.getCacheKey(query.query, query.variables);
    const data = this.data[key] as Unmasked<TData> | undefined;
    return data !== undefined ? data : null;
  }

  public override write<TData = AnyData, TVariables = AnyVariable>(
    write: Cache.WriteOptions<TData, TVariables>
  ): Reference | undefined {
    try {
      ++this.txCount;
      const key = this.getCacheKey(write.query, write.variables);
      this.data[key] = write.result as StoreObject;
      return cacheKeyToRef(key);
    } finally {
      if (--this.txCount === 0) {
        this.broadcastAllWatchers();
      }
    }
  }

  public override diff<T>(query: Cache.DiffOptions): DataProxy.DiffResult<T> {
    if (query.previousResult && isReference(query.previousResult)) {
      const key = refToCacheKey(query.previousResult);
      const data = this.data[key] as T | undefined;
      if (data !== undefined) {
        return {
          complete: true,
          result: data,
        };
      }
    }
    const key = this.getCacheKey(query.query, query.variables);
    const data = this.data[key] as T | undefined;
    if (data === undefined) {
      return {
        complete: false,
        result: undefined,
        missing: [
          new MissingFieldError(
            `'${key}' is not found`,
            [],
            query.query,
            query.variables
          ),
        ],
      };
    } else {
      return {
        complete: true,
        result: data,
      };
    }
  }

  public override watch<TData = AnyData, TVariables = AnyVariable>(
    watch: Cache.WatchOptions<TData, TVariables>
  ): () => void {
    const watchObject = { ...watch };
    this.watchers.push(watchObject);
    return () => {
      const i = this.watchers.indexOf(watchObject);
      if (i >= 0) {
        this.watchers.splice(i, 1);
      }
    };
  }

  public override reset(options?: Cache.ResetOptions): Promise<void> {
    if (options?.discardWatches) {
      this.watchers.splice(0);
    }
    this.data = {};
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

  public override restore(
    serializedState: CacheObject
  ): ApolloCache<CacheObject> {
    this.data = serializedState;
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

  public override performTransaction(
    transaction: Transaction<CacheObject>,
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
        if (r === DELETE_MODIFIER) {
          isModified = true;
          delete this.data[id];
        }
      } else {
        for (const [key, obj] of Object.entries(this.data)) {
          if (obj === undefined) {
            continue;
          }
          const r = modifyImpl(obj, this.data);
          if (r === DELETE_MODIFIER) {
            isModified = true;
            delete this.data[key];
          }
        }
      }

      return isModified;
    } finally {
      if (!--this.txCount && broadcast) {
        this.broadcastAllWatchers();
      }
    }

    function modifyImpl(
      obj: StoreObject,
      data: DataStore
    ): void | typeof DELETE_MODIFIER {
      for (const fieldName in obj) {
        const value = obj[fieldName];
        const fn = (
          typeof fields === 'function' ? fields : fields[fieldName]
        ) as Modifier<unknown> | undefined;
        if (fn == null) {
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
          return DELETE_MODIFIER;
        } else if (value !== newValue) {
          isModified = true;
          obj[fieldName] = newValue as StoreValue;
        }
      }
    }
  }

  private broadcastAllWatchers() {
    for (const w of this.watchers) {
      const lastDiff = w.lastDiff;
      const diff = this.diff(w);
      if (!equal(lastDiff, (w.lastDiff = diff))) {
        w.callback(diff, lastDiff);
      }
    }
  }
}
