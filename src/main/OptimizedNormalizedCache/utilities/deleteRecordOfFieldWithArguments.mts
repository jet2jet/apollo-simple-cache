import type { FieldWithArguments } from '../internalTypes.mjs';
import isMatchArguments from './isMatchArguments.mjs';

// @internal
export default function deleteRecordOfFieldWithArguments(
  field: FieldWithArguments,
  args: Record<string, unknown>,
  deletedObjects: object[]
): boolean {
  for (let i = 0, l = field.r.length; i < l; ++i) {
    const record = field.r[i]!;
    if (isMatchArguments(record[0], args)) {
      field.r.splice(i, 1);
      if (record[1] != null && typeof record[1] === 'object') {
        deletedObjects.push(record[1]);
      }
      return true;
    }
  }
  return false;
}
