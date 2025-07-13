import { PROXY_SYMBOL_REVOKED } from './types.mjs';

export default function isProxyRevoked(value: unknown): boolean {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  if (value instanceof Array) {
    return value.some(isProxyRevoked);
  }
  return !!(value as Record<string | symbol, unknown>)[PROXY_SYMBOL_REVOKED];
}
