import type { FieldWithArguments } from '../internalTypes.mts';
import makeFieldWithArgumentsName from './makeFieldWithArgumentsName.mts';

// @internal
export default function getFieldWithArguments(
  object: object,
  fieldName: string,
  grow?: false
): FieldWithArguments | undefined;

// @internal
export default function getFieldWithArguments(
  object: object,
  fieldName: string,
  grow: true
): FieldWithArguments;

// @internal
export default function getFieldWithArguments(
  object: object,
  fieldName: string,
  grow?: boolean
): FieldWithArguments | undefined {
  const name = makeFieldWithArgumentsName(fieldName);
  let data = (object as Record<string, unknown>)[name] as
    | FieldWithArguments
    | undefined;
  if (!data && grow) {
    (object as Record<string, unknown>)[name] = data = {
      __proto__: null,
      r: [],
    } satisfies FieldWithArguments & { __proto__: null } as FieldWithArguments;
  }
  return data;
}
