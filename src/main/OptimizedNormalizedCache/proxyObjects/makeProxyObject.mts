import type { StoreObject } from '@apollo/client';
import type { ArgumentNode, SelectionSetNode } from 'graphql';
import cloneVariables from '../../utilities/cloneVariables.mjs';
import hasOwn from '../../utilities/hasOwn.mjs';
import type { FragmentMap } from '../internalTypes.mjs';
import getActualTypename from '../utilities/getActualTypename.mjs';
import getCachedSelections from '../utilities/getCachedSelections.mjs';
import getEffectiveArguments from '../utilities/getEffectiveArguments.mjs';
import getFieldValue from '../utilities/getFieldValue.mjs';
import makeStoreId from '../utilities/makeStoreId.mjs';
import findExistingProxy from './findExistingProxy.mjs';
import {
  PROXY_SYMBOL_BASE,
  PROXY_SYMBOL_GET_EFFECTIVE_ARGUMENTS,
  PROXY_SYMBOL_DIRTY,
  PROXY_SYMBOL_TARGET,
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
  get: (t, p) => {
    // If already cached, return it
    if (hasOwn(t, p)) {
      return t[p];
    }

    const selectionSets = t[PROXY_SYMBOL_SELECTION_SETS];
    const fragmentMap = t[PROXY_SYMBOL_FRAGMENT_MAP];
    const variables = t[PROXY_SYMBOL_VARIABLES];

    switch (p) {
      case PROXY_SYMBOL_TARGET:
        return t;
      case PROXY_SYMBOL_GET_EFFECTIVE_ARGUMENTS:
        return (fieldName: string) => {
          const fieldArguments: ArgumentNode[] = [];
          for (const selectionSet of selectionSets) {
            for (const selection of getCachedSelections(
              selectionSet,
              fragmentMap
            )) {
              if (selection[0] !== fieldName) {
                continue;
              }
              if (selection[1].arguments) {
                fieldArguments.push(...selection[1].arguments);
              }
            }
          }
          return getEffectiveArguments(
            fieldArguments,
            variables as Record<string, unknown> | undefined
          );
        };
    }

    // All other symbol fields refer to original (target) object's values
    if (typeof p === 'symbol') {
      return t[p];
    }

    // Return '__dirty' value only if dirty is true
    if (p === '__dirty' && t[PROXY_SYMBOL_DIRTY]) {
      return true;
    }

    const ownKeys = t[PROXY_SYMBOL_OWN_KEYS];
    if (!ownKeys.some((k) => k === p)) {
      return undefined;
    }

    const baseCache = t[PROXY_SYMBOL_BASE_CACHE];
    const base = t[PROXY_SYMBOL_BASE];
    const variablesString = t[PROXY_SYMBOL_VARIABLES_STRING];
    const { supertypeMap, optimizedRead, dataIdFromObject, readFromId } =
      baseCache;

    const subSelectionSet: SelectionSetNode[] = [];
    let incoming: object | undefined;
    for (const selectionSet of selectionSets) {
      for (const selection of getCachedSelections(selectionSet, fragmentMap)) {
        if (selection[0] !== p) {
          continue;
        }
        const fieldNode = selection[1];
        const val = getFieldValue(
          base,
          fieldNode,
          p,
          supertypeMap,
          optimizedRead,
          dataIdFromObject,
          readFromId,
          selection[2],
          variables
        );
        if (val !== undefined && (val == null || typeof val !== 'object')) {
          // Cache the value
          t[p] = val;

          return val;
        }
        // If no further selection, returns the value without proxying
        if (!fieldNode.selectionSet) {
          // Cache the value
          t[p] = val;

          return val;
        }
        incoming = val;
        subSelectionSet.push(fieldNode.selectionSet);
      }
    }

    if (incoming === undefined) {
      // Not found
      return undefined;
    }

    // Create new proxy for sub object
    const proxy = callMakeProxy(incoming, subSelectionSet);
    t[p] = proxy;
    return proxy;

    function callMakeProxy(
      incoming: object,
      subSelectionSet: readonly SelectionSetNode[]
    ) {
      if (incoming instanceof Array) {
        // Avoid wrapping array with proxy; apply for each elements
        return incoming.map((v: unknown): unknown =>
          v != null && typeof v === 'object'
            ? callMakeProxy(v, subSelectionSet)
            : v
        );
      }
      return makeProxyObjectImpl(
        incoming,
        subSelectionSet,
        variables,
        variablesString,
        fragmentMap,
        baseCache
      );
    }
  },
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
      return [...ownKeys, '__dirty'];
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

function makeProxyObjectImpl(
  base: object,
  selectionSets: readonly SelectionSetNode[],
  variables: unknown,
  variablesString: string,
  fragmentMap: FragmentMap,
  cache: BaseCache
) {
  const typename = (base as StoreObject).__typename;
  variables = cloneVariables(variables);

  // Gather existing fields
  const ownKeysMap: Record<string, boolean> = {};
  if (typename) {
    ownKeysMap.__typename = true;
  }
  for (const selectionSet of selectionSets) {
    for (const selection of getCachedSelections(selectionSet, fragmentMap)) {
      if (
        typename &&
        selection[2] &&
        !getActualTypename(typename, selection[2], cache.supertypeMap)
      ) {
        continue;
      }
      ownKeysMap[selection[0]] = true;
    }
  }

  const t = Object.create(null) as ProxyObject &
    Record<string | symbol, unknown>;
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

  return proxy;
}

// @internal
export default function makeProxyObject(
  base: object,
  selectionSets: readonly SelectionSetNode[],
  id: string | undefined,
  variables: unknown,
  variablesString: string,
  fragmentMap: FragmentMap,
  cache: BaseCache
): ProxyObject {
  if (!id) {
    id = makeStoreId(base, cache.keyFields, cache.supertypeMap);
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
