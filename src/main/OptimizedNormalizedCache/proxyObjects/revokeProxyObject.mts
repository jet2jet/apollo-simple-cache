import isProxyObject from './isProxyObject.mjs';
import { PROXY_SYMBOL_REVOKED } from './types.mjs';

export default function revokeProxyObject(proxy: object): void {
  if (!isProxyObject(proxy)) {
    return;
  }
  proxy[PROXY_SYMBOL_REVOKED] = true;
}
