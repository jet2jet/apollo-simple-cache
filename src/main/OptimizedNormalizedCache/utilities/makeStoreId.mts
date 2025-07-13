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
  for (const key of getKeyFields(typename, keyFields, supertypeMap)) {
    if (key in data) {
      return `${typename}:${(data as Record<string, string | number>)[key]}`;
    }
  }
  return undefined;
}
