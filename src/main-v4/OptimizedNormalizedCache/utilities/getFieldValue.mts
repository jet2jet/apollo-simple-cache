import type { StoreObject } from '@apollo/client';
import type { ArgumentNode, FieldNode } from 'graphql';
import type { SupertypeMap } from '../internalTypes.mts';
import type {
  DataIdFromObjectFunction,
  OptimizedReadContext,
  OptimizedReadMap,
  ReadFromIdFunction,
} from '../types.mts';
import getActualTypename from './getActualTypename.mts';
import getEffectiveArguments from './getEffectiveArguments.mts';
import getFieldWithArguments from './getFieldWithArguments.mts';
import pickRecordOfFieldWithArguments from './pickRecordOfFieldWithArguments.mts';

/** Returns field value with calculation of arguments and OptimizedRead */
// @internal
export default function getFieldValue(
  object: object,
  fieldOrArguments: FieldNode | readonly ArgumentNode[] | null,
  name: string,
  supertypeMap: SupertypeMap | undefined,
  optimizedRead: OptimizedReadMap,
  dataIdFromObject: DataIdFromObjectFunction,
  readFromId: ReadFromIdFunction,
  selectionTypename?: string,
  variables?: Record<string, unknown>
): unknown {
  const typename = (object as StoreObject).__typename;
  let actualTypename: string | undefined;
  if (selectionTypename) {
    actualTypename = getActualTypename(
      typename,
      selectionTypename,
      supertypeMap
    );
  }

  // pick read function from typename and supertype (if exists)
  const read =
    (typename && optimizedRead[typename]) ||
    (actualTypename && optimizedRead[actualTypename]);
  const effectiveArguments =
    getEffectiveArguments(fieldOrArguments, variables) || {};
  const optimizedReadContext: OptimizedReadContext = {
    checkExistenceOnly: false,
    dataIdFromObject,
    readFromId,
    effectiveArguments,
  };

  if (variables) {
    const fieldWithArguments = getFieldWithArguments(object, name);
    if (fieldWithArguments) {
      const record = pickRecordOfFieldWithArguments(
        fieldWithArguments,
        effectiveArguments
      );
      if (record) {
        if (read) {
          return read(name, record[1], optimizedReadContext);
        }
        return record[1];
      } else {
        if (read) {
          return read(name, undefined, optimizedReadContext);
        }
        return undefined;
      }
    }
  }

  if (name in object) {
    const v = (object as Record<string, unknown>)[name];
    if (read) {
      return read(name, v, optimizedReadContext);
    }
    return v;
  } else {
    if (read) {
      return read(name, undefined, optimizedReadContext);
    }
    return undefined;
  }
}
