import { PROXY_SYMBOL_TARGET, type ProxyObject } from './types.mjs';

// @internal
export default function isProxyObject(object: unknown): object is ProxyObject {
  return (
    !!object &&
    typeof object === 'object' &&
    !!(object as Record<string | symbol, unknown>)[PROXY_SYMBOL_TARGET]
  );
}
