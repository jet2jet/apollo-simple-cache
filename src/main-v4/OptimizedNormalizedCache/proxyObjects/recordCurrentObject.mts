import { SYMBOL_PROXY_ARRAY, type DataStoreObject } from '../internalTypes.mjs';
import proxyObjectGetter from './proxyObjectGetter.mjs';

export default function recordCurrentObject(dataStoreObject: unknown): void {
  if (!dataStoreObject || typeof dataStoreObject !== 'object') {
    return;
  }
  const proxies = (dataStoreObject as DataStoreObject)[SYMBOL_PROXY_ARRAY];
  if (!proxies) {
    return;
  }
  for (let i = 0, l = proxies.length; i < l; ++i) {
    const proxy = proxies[i]!;
    for (const key in proxy) {
      // call getter to update caches
      proxyObjectGetter(proxy, key);
    }
  }
}
