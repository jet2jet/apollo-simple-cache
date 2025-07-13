import type { SupertypeMap } from '../internalTypes.mjs';

/**
 * For `supertypeMap = { A: [], B: ['A'], C: ['B', 'A'], D: ['A'] }`,
 *
 * |`typenameInput`|`typenameToUse`|result|
 * |----|----|----|
 * |`undefined`|don't care|`undefined`|
 * |`'B'`|`undefined`|`'B'`|
 * |`'B'`|`'B'`|`'B'`|
 * |`'B'`|`'A'`|`'A'`|
 * |`'C'`|`'B'`|`'B'`|
 * |`'C'`|`'A'`|`'A'`|
 * |`'D'`|`'A'`|`'A'`|
 * |`'D'`|`'B'`|`undefined`|
 */
// @internal
export default function getActualTypename(
  typenameInput: string | undefined,
  typenameToUse: string | undefined,
  supertypeMap: SupertypeMap | undefined
): string | undefined {
  if (typenameToUse == null || !supertypeMap) {
    return typenameInput;
  }
  if (typenameInput == null) {
    return undefined;
  }
  if (typenameInput === typenameToUse) {
    return typenameInput;
  }
  let hitSupertype: string | undefined;
  const supertypes = supertypeMap[typenameInput];
  if (supertypes != null) {
    visitSupertype(supertypes);
  }
  return hitSupertype;

  function visitSupertype(supertypes: readonly string[]): boolean {
    for (const supertype of supertypes) {
      if (supertype === typenameToUse) {
        hitSupertype = supertype;
        return true;
      }
      const superSuper = supertypeMap![supertype];
      if (superSuper != null && visitSupertype(superSuper)) {
        return true;
      }
    }
    return false;
  }
}
