import type { SupertypeMap } from '../internalTypes.mjs';
import type { KeyFields } from '../types.mjs';

const defaultKeyFields = ['id'] as const;

// @internal
export default function getKeyFields(
  typename: string,
  keyFields: KeyFields | undefined,
  supertypeMap: SupertypeMap | undefined
): readonly string[] {
  if (!keyFields) {
    return defaultKeyFields;
  } else if (keyFields instanceof Array) {
    return keyFields;
  }
  const types = keyFields.types;
  if (types == null) {
    return keyFields.fields || defaultKeyFields;
  }
  const k = getKeyFieldsForTypes(typename, types);
  return k || keyFields.fields || defaultKeyFields;

  function getKeyFieldsForTypes(
    typename: string,
    types: { [typename in string]?: readonly string[] }
  ): readonly string[] | undefined {
    if (types[typename]) {
      return types[typename];
    }
    if (!supertypeMap) {
      return undefined;
    }
    const supertypes = supertypeMap[typename];
    if (!supertypes) {
      return undefined;
    }
    for (let l = supertypes.length, i = 0; i < l; ++i) {
      const t = supertypes[i]!;
      const r = getKeyFieldsForTypes(t, types);
      if (r) {
        return r;
      }
    }
    return undefined;
  }
}
