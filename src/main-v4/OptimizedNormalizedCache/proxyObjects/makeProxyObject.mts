import { isReference, type Reference, type StoreObject } from '@apollo/client';
import type { SelectionSetNode } from 'graphql';
import cloneVariables from '../../utilities/cloneVariables.mjs';
import hasOwn from '../../utilities/hasOwn.mjs';
import {
  SYMBOL_PROXY_ARRAY,
  type DataStoreObject,
  type FragmentMap,
  type SelectionTuple,
} from '../internalTypes.mjs';
import getActualTypename from '../utilities/getActualTypename.mjs';
import getCachedSelections from '../utilities/getCachedSelections.mjs';
import getFieldValue from '../utilities/getFieldValue.mjs';
import findExistingProxy from './findExistingProxy.mjs';
import proxyObjectGetter from './proxyObjectGetter.mjs';
import {
  PROXY_SYMBOL_BASE,
  PROXY_SYMBOL_DIRTY,
  PROXY_SYMBOL_BASE_CACHE,
  PROXY_SYMBOL_SELECTION_SETS,
  PROXY_SYMBOL_FRAGMENT_MAP,
  PROXY_SYMBOL_OWN_KEYS,
  PROXY_SYMBOL_VARIABLES,
  PROXY_SYMBOL_VARIABLES_STRING,
  type BaseCache,
  type ProxyObject,
} from './types.mjs';

const proxyHandler: ProxyHandler<ProxyObject> & { __proto__: null } = {
  __proto__: null,
  get: proxyObjectGetter,
  has: (t, p) => {
    if (hasOwn(t, p)) {
      return true;
    }
    if (typeof p === 'symbol') {
      return false;
    }
    if (t[PROXY_SYMBOL_DIRTY] && p === '__dirty') {
      return true;
    }

    const ownKeys = t[PROXY_SYMBOL_OWN_KEYS];
    return ownKeys.some((k) => k === p);
  },
  // Add '__dirty' field to compare with fresh object resulting not match
  ownKeys: (t) => {
    const ownKeys = t[PROXY_SYMBOL_OWN_KEYS];
    if (t[PROXY_SYMBOL_DIRTY]) {
      return ownKeys.concat('__dirty');
    }
    return ownKeys;
  },
  set: (t, p, newValue: unknown) => {
    if (typeof p === 'symbol') {
      if (p === PROXY_SYMBOL_DIRTY) {
        if (!newValue) {
          return false;
        }
      }
      t[p] = newValue;
      return true;
    }
    return false;
  },
  getOwnPropertyDescriptor: (_, p) => {
    return {
      enumerable: true,
      configurable: true,
      writable: typeof p === 'symbol',
    };
  },
};

// @internal
export function makeProxyObjectImpl(
  base: DataStoreObject,
  selectionSets: readonly SelectionSetNode[],
  variables: unknown,
  variablesString: string,
  fragmentMap: FragmentMap,
  cache: BaseCache
): ProxyObject {
  const typename = (base as StoreObject).__typename;
  variables = cloneVariables(variables);

  // Gather existing fields
  const ownKeysMap: Record<string, boolean> = {};
  if (typename) {
    ownKeysMap.__typename = true;
  }

  const t = { __proto__: null } as ProxyObject &
    Record<string | symbol, unknown> & { __proto__: null };

  for (const selectionSet of selectionSets) {
    for (const selection of getCachedSelections(selectionSet, fragmentMap)) {
      if (
        typename &&
        selection[2] &&
        !getActualTypename(typename, selection[2], cache.supertypeMap)
      ) {
        continue;
      }
      const name = selection[0];

      const value = getFieldValue(
        base,
        selection[1],
        name,
        cache.supertypeMap,
        cache.optimizedRead,
        cache.dataIdFromObject,
        cache.readFromId,
        selection[2],
        variables as Record<string, unknown> | undefined
      );
      if (value === undefined) {
        continue;
      }

      ownKeysMap[name] = true;

      const existing = t[`${name}:s`] as
        | SelectionTuple
        | SelectionTuple[]
        | undefined;
      if (!existing) {
        t[`${name}:s`] = selection;
      } else {
        if (existing[0] instanceof Array) {
          (existing as SelectionTuple[]).push(selection);
        } else {
          t[`${name}:s`] = [existing, selection];
        }
      }
    }
  }

  if (typename) {
    t.__typename = typename;
  }
  t[PROXY_SYMBOL_DIRTY] = false;
  t[PROXY_SYMBOL_BASE] = base;
  t[PROXY_SYMBOL_OWN_KEYS] = Object.keys(ownKeysMap);
  t[PROXY_SYMBOL_SELECTION_SETS] = selectionSets;
  t[PROXY_SYMBOL_FRAGMENT_MAP] = fragmentMap;
  t[PROXY_SYMBOL_BASE_CACHE] = cache;
  t[PROXY_SYMBOL_VARIABLES] = variables as Record<string, unknown> | undefined;
  t[PROXY_SYMBOL_VARIABLES_STRING] = variablesString;

  const proxy = new Proxy<ProxyObject>(t, proxyHandler);

  const rec = base[SYMBOL_PROXY_ARRAY] || (base[SYMBOL_PROXY_ARRAY] = []);
  rec.push(proxy);

  return proxy;
}

// @internal
export default function makeProxyObject(
  base: DataStoreObject | Reference,
  selectionSets: readonly SelectionSetNode[],
  id: string | undefined,
  variables: unknown,
  variablesString: string,
  fragmentMap: FragmentMap,
  cache: BaseCache
): ProxyObject {
  if (isReference(base)) {
    id = base.__ref;
    base = cache.data[id] as DataStoreObject;
  }
  if (!id) {
    id = cache.dataIdFromObject(base);
  }
  const entry = findExistingProxy(
    base,
    id,
    fragmentMap,
    cache.proxyCacheMap,
    cache.proxyCacheRecords,
    cache.revokedProxyRecords,
    selectionSets,
    variablesString
  )[0];
  if (entry[2] !== undefined) {
    return entry[2];
  }

  const proxy = makeProxyObjectImpl(
    base,
    selectionSets,
    variables,
    variablesString,
    fragmentMap,
    cache
  );

  entry[2] = proxy;

  cache.setProxyCleanTimer();

  return proxy;
}
