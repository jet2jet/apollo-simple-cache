import type {
  FieldWithArguments,
  FieldWithArgumentsDataRecord,
} from '../internalTypes.mjs';
import isMatchArguments from './isMatchArguments.mjs';

// @internal
export default function pickRecordOfFieldWithArguments(
  field: FieldWithArguments,
  args: Record<string, unknown>
): FieldWithArgumentsDataRecord | undefined {
  for (let r = field.r, l = r.length, i = 0; i < l; ++i) {
    const record = r[i]!;
    if (isMatchArguments(record[0], args)) {
      return record;
    }
  }
  return undefined;
}
