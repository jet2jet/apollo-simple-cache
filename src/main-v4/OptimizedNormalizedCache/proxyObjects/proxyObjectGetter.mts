import { isReference } from '@apollo/client';
import type { ArgumentNode, SelectionSetNode } from 'graphql';
import hasOwn from '../../utilities/hasOwn.mjs';
import type { DataStoreObject, SelectionTuple } from '../internalTypes.mjs';
import getCachedSelections from '../utilities/getCachedSelections.mjs';
import getEffectiveArguments from '../utilities/getEffectiveArguments.mjs';
import getFieldValue from '../utilities/getFieldValue.mjs';
import { makeProxyObjectImpl } from './makeProxyObject.mjs';
import {
  PROXY_SYMBOL_BASE,
  PROXY_SYMBOL_BASE_CACHE,
  PROXY_SYMBOL_DIRTY,
  PROXY_SYMBOL_FRAGMENT_MAP,
  PROXY_SYMBOL_GET_EFFECTIVE_ARGUMENTS,
  PROXY_SYMBOL_OWN_KEYS,
  PROXY_SYMBOL_SELECTION_SETS,
  PROXY_SYMBOL_TARGET,
  PROXY_SYMBOL_VARIABLES,
  PROXY_SYMBOL_VARIABLES_STRING,
  type ProxyObject,
} from './types.mjs';

function isDirtyObject(val: unknown) {
  if (!val || typeof val !== 'object') {
    return false;
  }
  if (val instanceof Array) {
    return val.some(isDirtyObject);
  }
  return !!(val as ProxyObject)[PROXY_SYMBOL_DIRTY];
}

// @internal
export default function proxyObjectGetter(
  t: ProxyObject,
  p: string | symbol
): unknown {
  // If already cached, return it
  if (hasOwn(t, p)) {
    const val = t[p];
    // If val is dirty and this object is not dirty, recreates proxy
    if (!isDirtyObject(val) || t[PROXY_SYMBOL_DIRTY]) {
      return val;
    }
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
        for (let l = selectionSets.length, i = 0; i < l; ++i) {
          for (
            let cs = getCachedSelections(selectionSets[i]!, fragmentMap),
              m = cs.length,
              j = 0;
            j < m;
            ++j
          ) {
            const selection = cs[j]!;
            if (selection[0] !== fieldName) {
              continue;
            }
            if (selection[1].arguments) {
              fieldArguments.push(...selection[1].arguments);
            }
          }
        }
        return getEffectiveArguments(fieldArguments, variables);
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

  const selectionTuple = t[`${p}:s`] as SelectionTuple | SelectionTuple[];

  let incoming: unknown;
  let subSelections: SelectionSetNode | SelectionSetNode[] | undefined;
  if (selectionTuple[0] instanceof Array) {
    for (let l = selectionTuple.length, i = 0; i < l; ++i) {
      const tuple = (selectionTuple as SelectionTuple[])[i]!;
      incoming = getFieldValue(
        base,
        tuple[1],
        p,
        supertypeMap,
        optimizedRead,
        dataIdFromObject,
        readFromId,
        tuple[2],
        variables
      );
      const sub = tuple[1].selectionSet;
      if (sub) {
        if (subSelections) {
          if (subSelections instanceof Array) {
            subSelections.push(sub);
          } else {
            subSelections = [subSelections, sub];
          }
        } else {
          subSelections = sub;
        }
      }
    }
  } else {
    incoming = getFieldValue(
      base,
      (selectionTuple as SelectionTuple)[1],
      p,
      supertypeMap,
      optimizedRead,
      dataIdFromObject,
      readFromId,
      (selectionTuple as SelectionTuple)[2],
      variables
    );
    subSelections = (selectionTuple as SelectionTuple)[1].selectionSet;
  }
  if (
    incoming !== undefined &&
    (incoming == null || typeof incoming !== 'object')
  ) {
    // Cache the value
    t[p] = incoming;

    return incoming;
  }
  // If no further selection, returns the value without proxying
  if (!subSelections) {
    // Cache the value
    t[p] = incoming;

    return incoming;
  }

  // Create new proxy for sub object
  const proxy = callMakeProxy(
    incoming,
    subSelections instanceof Array ? subSelections : [subSelections]
  );

  if (proxy === undefined) {
    // Not found
    return undefined;
  }
  t[p] = proxy;
  return proxy;

  function callMakeProxy(
    incoming: object | undefined,
    subSelectionSet: readonly SelectionSetNode[]
  ) {
    if (incoming && incoming instanceof Array) {
      // Avoid wrapping array with proxy; apply for each elements
      return incoming.map((v: unknown): unknown =>
        v != null && typeof v === 'object'
          ? callMakeProxy(v, subSelectionSet)
          : v
      );
    }
    if (incoming && isReference(incoming)) {
      const id = incoming.__ref;
      incoming = baseCache.data[id] as DataStoreObject | undefined;
    }
    if (incoming === undefined) {
      return incoming;
    }
    return makeProxyObjectImpl(
      incoming as DataStoreObject,
      subSelectionSet,
      variables,
      variablesString,
      fragmentMap,
      baseCache
    );
  }
}
