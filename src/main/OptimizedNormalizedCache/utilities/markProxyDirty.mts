import { SYMBOL_PROXY_ARRAY, type DataStoreObject } from '../internalTypes.mjs';
import recordProxyObject from '../proxyObjects/recordProxyObject.mjs';
import {
  PROXY_SYMBOL_DIRTY,
  PROXY_SYMBOL_FRAGMENT_MAP,
  PROXY_SYMBOL_SELECTION_SETS,
} from '../proxyObjects/types.mjs';
import getCachedSelections from './getCachedSelections.mjs';

/** If fieldName is missing, record current snapshot */
// @internal
export default function markProxyDirty(
  object: DataStoreObject,
  fieldName?: string
): void {
  const rec = object[SYMBOL_PROXY_ARRAY];
  if (rec) {
    for (let i = rec.length - 1; i >= 0; --i) {
      const proxy = rec[i]!;
      if (fieldName) {
        const selectionSets = proxy[PROXY_SYMBOL_SELECTION_SETS];
        const fragmentMap = proxy[PROXY_SYMBOL_FRAGMENT_MAP];
        let found = false;
        for (const selectionSet of selectionSets) {
          for (const selection of getCachedSelections(
            selectionSet,
            fragmentMap
          )) {
            if (selection[0] === fieldName) {
              found = true;
              break;
            }
          }
        }
        if (!found) {
          continue;
        }
      } else {
        recordProxyObject(proxy);
      }
      proxy[PROXY_SYMBOL_DIRTY] = true;
      rec.splice(i, 1);
    }
  }
}
