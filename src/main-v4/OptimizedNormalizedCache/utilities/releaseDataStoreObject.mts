import type { DataStoreObject } from '../internalTypes.mts';
import isReference from './isReference.mts';
import markProxyDirty from './markProxyDirty.mts';

// @internal
export default function releaseDataStoreObject(object: unknown): void {
  if (!object || typeof object !== 'object') {
    return;
  }
  if (isReference(object)) {
    return;
  }
  if (object instanceof Array) {
    object.forEach((x) => releaseDataStoreObject(x));
    return;
  }

  markProxyDirty(object as DataStoreObject);

  for (const key in object) {
    const o = (object as Record<string, unknown>)[key];
    releaseDataStoreObject(o);
  }
}
