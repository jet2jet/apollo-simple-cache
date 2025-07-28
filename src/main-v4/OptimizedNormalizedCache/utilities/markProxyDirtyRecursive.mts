import type { DataStoreObject } from '../internalTypes.mjs';
import isReference from './isReference.mjs';
import markProxyDirty from './markProxyDirty.mjs';

// @internal
export default function markProxyDirtyRecursive(data: unknown): void {
  if (!data || typeof data !== 'object') {
    return;
  }
  if (isReference(data)) {
    return;
  }
  if (data instanceof Array) {
    data.forEach((x) => markProxyDirtyRecursive(x));
    return;
  }

  markProxyDirty(data as DataStoreObject);

  for (const key in data) {
    const o = (data as Record<string, unknown>)[key];
    markProxyDirtyRecursive(o);
  }
}
