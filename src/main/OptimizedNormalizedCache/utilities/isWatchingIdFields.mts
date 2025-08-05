import { isReference, type FragmentMap } from '@apollo/client/utilities';
import type { SelectionSetNode } from 'graphql';
import type {
  ChangedFields,
  ChangedFieldsArray,
  SupertypeMap,
} from '../internalTypes.mjs';
import type { DataIdFromObjectFunction, KeyFields } from '../types.mjs';
import getCachedSelections from './getCachedSelections.mjs';
import getFieldValue from './getFieldValue.mjs';
import isWatchingFields from './isWatchingFields.mjs';

function noop(): never {
  throw new Error();
}

function isWatchingIdFieldsImpl(
  data: Record<string, unknown>,
  selectionSetNode: SelectionSetNode,
  fragmentMap: FragmentMap,
  fieldList: ChangedFields,
  idFields: ChangedFieldsArray,
  variables: Record<string, unknown> | undefined,
  keyFields: KeyFields | undefined,
  supertypeMap: SupertypeMap | undefined,
  dataIdFromObject: DataIdFromObjectFunction
): boolean {
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
    const id = isReference(value) ? value.__ref : dataIdFromObject(value);
    if (id && fieldList[1] === id) {
      if (
        !subSelectionSet ||
        isWatchingFields(
          value as Record<string, unknown>,
          subSelectionSet,
          fragmentMap,
          fieldList,
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
    if (subSelectionSet) {
      if (
        isWatchingIdFieldsImpl(
          value as Record<string, unknown>,
          subSelectionSet,
          fragmentMap,
          fieldList,
          idFields,
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
  return false;
}

// @internal
export default function isWatchingIdFields(
  rootStore: Record<string, unknown>,
  rootSelectionSetNode: SelectionSetNode,
  fragmentMap: FragmentMap,
  fieldList: ChangedFields,
  idFields: ChangedFieldsArray,
  variables: Record<string, unknown> | undefined,
  keyFields: KeyFields | undefined,
  supertypeMap: SupertypeMap | undefined,
  dataIdFromObject: DataIdFromObjectFunction
): boolean {
  return isWatchingIdFieldsImpl(
    rootStore.ROOT_QUERY as Record<string, unknown>,
    rootSelectionSetNode,
    fragmentMap,
    fieldList,
    idFields,
    variables,
    keyFields,
    supertypeMap,
    dataIdFromObject
  );
}
