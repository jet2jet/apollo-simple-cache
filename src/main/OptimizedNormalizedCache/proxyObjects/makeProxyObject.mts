import type { StoreObject } from '@apollo/client';
import type { ArgumentNode, SelectionSetNode } from 'graphql';
import cloneVariables from '../../utilities/cloneVariables.mjs';
import hasOwn from '../../utilities/hasOwn.mjs';
import type {
  FragmentMap,
  SelectionTuple,
  SupertypeMap,
} from '../internalTypes.mjs';
import type {
  DataIdFromObjectFunction,
  KeyFields,
  OptimizedReadMap,
  ReadFromIdFunction,
} from '../types.mjs';
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
  type ProxyCacheMap,
  type ProxyCacheRecord,
  type ProxyObject,
  type RevokedProxyRecords,
} from './types.mjs';

function makeProxyObjectImpl(
  base: object,
  selectionSets: readonly SelectionSetNode[],
  variables: unknown,
  variablesString: string,
  fragmentMap: FragmentMap,
  keyFields: KeyFields | undefined,
  supertypeMap: SupertypeMap | undefined,
  optimizedRead: OptimizedReadMap,
  dataIdFromObject: DataIdFromObjectFunction,
  readFromId: ReadFromIdFunction
) {
  const typename = (base as StoreObject).__typename;
  variables = cloneVariables(variables);

  // Gather existing fields
  const ownKeysMap: Record<string, boolean> = {};
  if (typename) {
    ownKeysMap.__typename = true;
  }
  const fieldSelections: SelectionTuple[] = [];
  for (const selectionSet of selectionSets) {
    for (const selection of getCachedSelections(selectionSet, fragmentMap)) {
      if (
        typename &&
        selection[2] &&
        !getActualTypename(typename, selection[2], supertypeMap)
      ) {
        continue;
      }
      fieldSelections.push(selection);
      ownKeysMap[selection[0]] = true;
    }
  }

  const t = Object.create(null) as Record<string | symbol, unknown>;

  let dirty = false;

  const proxy = new Proxy<ProxyObject>(t as ProxyObject, {
    get: (_, p) => {
      // If already cached, return it
      if (hasOwn(t, p)) {
        return t[p];
      }

      switch (p) {
        case PROXY_SYMBOL_TARGET:
          return t;
        case PROXY_SYMBOL_BASE:
          return base;
        case PROXY_SYMBOL_DIRTY:
          return dirty;
        case PROXY_SYMBOL_GET_EFFECTIVE_ARGUMENTS:
          return (fieldName: string) => {
            const fieldArguments: ArgumentNode[] = [];
            for (const selection of fieldSelections) {
              if (selection[0] !== fieldName) {
                continue;
              }
              if (selection[1].arguments) {
                fieldArguments.push(...selection[1].arguments);
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
      if (p === '__dirty' && dirty) {
        return true;
      }

      if (!ownKeysMap[p]) {
        return undefined;
      }

      const subSelectionSet: SelectionSetNode[] = [];
      let incoming: object | undefined;
      for (const selection of fieldSelections) {
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
          variables as Record<string, unknown> | undefined
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
          keyFields,
          supertypeMap,
          optimizedRead,
          dataIdFromObject,
          readFromId
        );
      }
    },
    has: (_, p) => {
      if (hasOwn(t, p)) {
        return true;
      }
      if (typeof p === 'symbol') {
        return false;
      }
      if (dirty && p === '__dirty') {
        return true;
      }
      return !!ownKeysMap[p];
    },
    // Add '__dirty' field to compare with fresh object resulting not match
    ownKeys: () => {
      const ownKeys = Object.keys(ownKeysMap);
      if (dirty) {
        ownKeys.push('__dirty');
      }
      return ownKeys;
    },
    set: (_, p, newValue: unknown) => {
      if (typeof p === 'symbol') {
        if (p === PROXY_SYMBOL_DIRTY) {
          if (!newValue) {
            return false;
          }

          dirty = true;
        } else {
          t[p] = newValue;
        }
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
  });

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
  keyFields: KeyFields | undefined,
  supertypeMap: SupertypeMap | undefined,
  optimizedRead: OptimizedReadMap,
  dataIdFromObject: DataIdFromObjectFunction,
  readFromId: ReadFromIdFunction,
  proxyCacheMap: ProxyCacheMap,
  proxyCacheRecords: ProxyCacheRecord[],
  revokedProxyRecords: RevokedProxyRecords,
  setProxyCleanTimer: () => void
): ProxyObject {
  if (!id) {
    id = makeStoreId(base, keyFields, supertypeMap);
  }
  const entry = findExistingProxy(
    base,
    id,
    fragmentMap,
    proxyCacheMap,
    proxyCacheRecords,
    revokedProxyRecords,
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
    keyFields,
    supertypeMap,
    optimizedRead,
    dataIdFromObject,
    readFromId
  );

  entry[2] = proxy;

  setProxyCleanTimer();

  return proxy;
}
