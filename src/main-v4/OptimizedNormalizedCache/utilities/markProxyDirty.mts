import { SYMBOL_PROXY_ARRAY, type DataStoreObject } from '../internalTypes.mjs';
import { PROXY_SYMBOL_DIRTY } from '../proxyObjects/types.mjs';

// @internal
export default function markProxyDirty(object: DataStoreObject): void {
  const rec = object[SYMBOL_PROXY_ARRAY];
  if (rec) {
    for (let l = rec.length, i = 0; i < l; ++i) {
      rec[i]![PROXY_SYMBOL_DIRTY] = true;
    }
    rec.splice(0);
  }
}
