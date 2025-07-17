import type { FragmentMap } from '@apollo/client/utilities';
import type { SelectionSetNode } from 'graphql';
import type { ChangedFieldsArray, SupertypeMap } from '../internalTypes.mjs';
import type { KeyFields } from '../types.mjs';
import getCachedSelections from './getCachedSelections.mjs';
import getFieldValue from './getFieldValue.mjs';
import isWatchingFields from './isWatchingFields.mjs';
import makeStoreId from './makeStoreId.mjs';

function noop(): never {
  throw new Error();
}

// @internal
export default function isWatchingIdFields(
  data: object,
  selectionSetNode: SelectionSetNode,
  fragmentMap: FragmentMap,
  idFields: ChangedFieldsArray,
  variables: Record<string, unknown> | undefined,
  keyFields: KeyFields | undefined,
  supertypeMap: SupertypeMap | undefined
): boolean {
  if (data instanceof Array) {
    for (let l = data.length, i = 0; i < l; ++i) {
      const o = data[i];
      if (o == null || typeof o !== 'object') {
        continue;
      }
      if (
        isWatchingIdFields(
          o,
          selectionSetNode,
          fragmentMap,
          idFields,
          variables,
          keyFields,
          supertypeMap
        )
      ) {
        return true;
      }
    }
    return false;
  }

  // Check idFields
  {
    const id = makeStoreId(data, keyFields, supertypeMap);
    if (id) {
      for (const idField of idFields) {
        if (idField[0] === id) {
          if (
            isWatchingFields(
              data as Record<string, unknown>,
              selectionSetNode,
              fragmentMap,
              idField,
              idFields,
              1,
              variables,
              keyFields,
              supertypeMap
            )
          ) {
            return true;
          }
        }
      }
    }
  }

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

    if (value == null || typeof value !== 'object') {
      continue;
    }
    if (!subSelectionSet) {
      continue;
    }

    if (
      isWatchingIdFields(
        value,
        subSelectionSet,
        fragmentMap,
        idFields,
        variables,
        keyFields,
        supertypeMap
      )
    ) {
      return true;
    }
  }

  return false;
}
