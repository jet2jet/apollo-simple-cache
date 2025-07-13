import type { FieldWithArguments } from '../internalTypes.mjs';
import getNameFromFieldWithArgumentsName from './getNameFromFieldWithArgumentsName.mjs';

// @internal
export default function eachFields(
  object: object,
  cb: (fieldName: string, value: unknown) => void
): void {
  for (const fieldName in object) {
    const val = (object as Record<string, unknown>)[fieldName];
    const name = getNameFromFieldWithArgumentsName(fieldName);
    if (name) {
      for (const record of (val as FieldWithArguments).r) {
        cb(name, record[1]);
      }
    } else {
      cb(fieldName, val);
    }
  }
}
