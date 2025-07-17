import type { StoreObject } from '@apollo/client';
import type { SupertypeMap } from '../internalTypes.mjs';
import type { KeyFields } from '../types.mjs';
import getKeyFields from './getKeyFields.mjs';

// @internal
export default function makeStoreId(
  data: object,
  keyFields: KeyFields | undefined,
  supertypeMap: SupertypeMap | undefined
): string | undefined {
  const typename = (data as StoreObject).__typename;
  if (!typename) {
    return undefined;
  }
  for (
    let kf = getKeyFields(typename, keyFields, supertypeMap),
      l = kf.length,
      i = 0;
    i < l;
    ++i
  ) {
    const key = kf[i]!;
    if (key in data) {
      return `${typename}:${(data as Record<string, string | number>)[key]}`;
    }
  }
  return undefined;
}
