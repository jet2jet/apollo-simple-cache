import type { Cache } from '@apollo/client';
import type { ChangedFields, ChangedFieldsArray } from '../internalTypes.mjs';
import deleteRecordOfFieldWithArguments from './deleteRecordOfFieldWithArguments.mjs';
import getFieldWithArguments from './getFieldWithArguments.mjs';
import getNameFromFieldWithArgumentsName from './getNameFromFieldWithArgumentsName.mjs';

// @internal
export default function evictData(
  data: unknown,
  currentPath: ChangedFields,
  outChangedFields: ChangedFieldsArray,
  outRemovedObjects: object[],
  options: Cache.EvictOptions
): boolean {
  if (data == null || typeof data !== 'object') {
    return false;
  }

  let changed = false;
  if (data instanceof Array) {
    if (options.fieldName == null) {
      changed = data.length > 0;
      data.splice(0);
    } else {
      for (const d of data) {
        changed =
          evictData(
            d,
            currentPath,
            outChangedFields,
            outRemovedObjects,
            options
          ) || changed;
      }
    }
  } else {
    const keys = Object.keys(data);
    changed = keys.length > 0;
    for (const key of keys) {
      const o = (data as Record<string, unknown>)[key];

      const actualFieldName = getNameFromFieldWithArgumentsName(key);
      if (options.fieldName != null) {
        if (options.fieldName !== (actualFieldName || key)) {
          continue;
        }
      }

      const fieldWithArguments =
        actualFieldName && getFieldWithArguments(data, actualFieldName);
      if (fieldWithArguments) {
        if (options.args) {
          changed =
            deleteRecordOfFieldWithArguments(
              fieldWithArguments,
              options.args,
              outRemovedObjects
            ) || changed;
        } else {
          for (const record of fieldWithArguments.r) {
            const r = record[1];
            if (r != null && typeof r === 'object') {
              outRemovedObjects.push(r);
            }
          }
          delete (data as Record<string, unknown>)[key];
          changed = true;
        }
      } else {
        if (o != null && typeof o === 'object') {
          outRemovedObjects.push(o);
        }
        delete (data as Record<string, unknown>)[key];
        changed = true;
      }
    }
  }

  return changed;
}
