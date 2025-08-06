import proxyObjectGetter from './proxyObjectGetter.mjs';
import type { ProxyObject } from './types.mjs';

// @internal
export default function recordProxyObject(proxy: ProxyObject): void {
  for (const key in proxy) {
    // call getter to update caches
    proxyObjectGetter(proxy, key);
  }
}
