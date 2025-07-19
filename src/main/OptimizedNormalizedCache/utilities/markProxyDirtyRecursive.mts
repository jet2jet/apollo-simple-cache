import type { DataStoreObject } from '../internalTypes.mjs';
import markProxyDirty from './markProxyDirty.mjs';

function markProxyDirtyRecursiveImpl(data: unknown): void {
  if (!data || typeof data !== 'object') {
    return;
  }
  if (data instanceof Array) {
    data.forEach((x) => markProxyDirtyRecursiveImpl(x));
    return;
  }

  markProxyDirty(data as DataStoreObject);

  for (const key in data) {
    const o = (data as Record<string, unknown>)[key];
    markProxyDirtyRecursiveImpl(o);
  }
}

// @internal
export default function markProxyDirtyRecursive(object: DataStoreObject): void {
  markProxyDirtyRecursiveImpl(object);
}
