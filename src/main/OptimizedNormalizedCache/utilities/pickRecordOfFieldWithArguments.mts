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
  for (const record of field.r) {
    if (isMatchArguments(record[0], args)) {
      return record;
    }
  }
  return undefined;
}
