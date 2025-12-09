import isProxyObject from './isProxyObject.mjs';
import proxyObjectGetter from './proxyObjectGetter.mjs';
import { PROXY_SYMBOL_RECORDED, type ProxyObject } from './types.mjs';

function recordProxyObjectImpl(proxy: unknown, seen: WeakSet<object>) {
  if (proxy instanceof Array) {
    if (seen.has(proxy)) {
      return;
    }
    seen.add(proxy);
    proxy.forEach((value) => recordProxyObjectImpl(value, seen));
    return;
  }
  if (!isProxyObject(proxy)) {
    return;
  }
  if (seen.has(proxy)) {
    return;
  }
  seen.add(proxy);
  if (proxy[PROXY_SYMBOL_RECORDED]) {
    return;
  }
  proxy[PROXY_SYMBOL_RECORDED] = true;
  for (const key in proxy) {
    // call getter to update caches
    const value = proxyObjectGetter(proxy, key);
    // record recursively
    recordProxyObjectImpl(value, seen);
  }
}

// @internal
export default function recordProxyObject(proxy: ProxyObject): void {
  recordProxyObjectImpl(proxy, new WeakSet());
}
