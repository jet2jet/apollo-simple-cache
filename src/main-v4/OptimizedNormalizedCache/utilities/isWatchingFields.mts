import type { SelectionSetNode } from 'graphql';
import equal from '../../utilities/equal.mjs';
import type {
  ChangedFields,
  ChangedFieldsArray,
  FragmentMap,
  SliceFirst,
  SupertypeMap,
} from '../internalTypes.mjs';
import type { DataIdFromObjectFunction, KeyFields } from '../types.mjs';
import getCachedSelections from './getCachedSelections.mjs';
import getEffectiveArguments from './getEffectiveArguments.mjs';
import getFieldValue from './getFieldValue.mjs';

function noop(): never {
  throw new Error();
}

// @internal
export default function isWatchingFields(
  data: Record<string, unknown>,
  selectionSetNode: SelectionSetNode,
  fragmentMap: FragmentMap,
  fieldList: ChangedFields,
  idFields: ChangedFieldsArray,
  index: number,
  variables: Record<string, unknown> | undefined,
  keyFields: KeyFields | undefined,
  supertypeMap: SupertypeMap | undefined,
  dataIdFromObject: DataIdFromObjectFunction
): boolean {
  const field = fieldList[index] as SliceFirst<ChangedFields>[number];
  for (
    let cs = getCachedSelections(selectionSetNode, fragmentMap),
      l = cs.length,
      i = 0;
    i < l;
    ++i
  ) {
    const selection = cs[i]!;
    const subSelectionSet = selection[1].selectionSet;
    const value = getFieldValue(
      data,
      selection[1],
      selection[0],
      supertypeMap,
      {},
      noop,
      noop,
      selection[2],
      variables
    );
    const name = !field ? null : typeof field === 'string' ? field : field[0];

    if (field && selection[0] === name) {
      const effectiveArguments = getEffectiveArguments(selection[1], variables);
      if (typeof field !== 'string') {
        if (!equal(field[1], effectiveArguments)) {
          continue;
        }
      }
      if (!subSelectionSet || index >= fieldList.length - 1) {
        return true;
      }
      if (value == null || typeof value !== 'object') {
        return true;
      }
      return isWatchingFields(
        value as Record<string, unknown>,
        subSelectionSet,
        fragmentMap,
        fieldList,
        idFields,
        index + 1,
        variables,
        keyFields,
        supertypeMap,
        dataIdFromObject
      );
    }

    // Check idFields
    if (value && typeof value === 'object') {
      const id = dataIdFromObject(value);
      if (id) {
        for (const idField of idFields) {
          if (idField[1] === id) {
            if (
              !subSelectionSet ||
              isWatchingFields(
                value as Record<string, unknown>,
                subSelectionSet,
                fragmentMap,
                idField,
                idFields,
                2,
                variables,
                keyFields,
                supertypeMap,
                dataIdFromObject
              )
            ) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}
