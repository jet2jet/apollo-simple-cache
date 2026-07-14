import type { StoreObject } from '@apollo/client';
import type { SelectionSetNode } from 'graphql';
import type { FragmentMap, SupertypeMap } from '../internalTypes.mts';
import type { OptimizedReadContext, OptimizedReadMap } from '../types.mts';
import getActualTypename from './getActualTypename.mts';
import getCachedSelections from './getCachedSelections.mts';
import getEffectiveArguments from './getEffectiveArguments.mts';
import getFieldWithArguments from './getFieldWithArguments.mts';
import isReference from './isReference.mts';
import pickRecordOfFieldWithArguments from './pickRecordOfFieldWithArguments.mts';

/** Picks missing fields from current data object. */
// @internal
export default function getMissingFields(
  currentData: object | null | undefined,
  selection: SelectionSetNode,
  fragmentMap: FragmentMap,
  rootStore: Record<string, unknown>,
  supertypeMap: SupertypeMap | undefined,
  optimizedRead: OptimizedReadMap,
  optimizedReadContext: OptimizedReadContext,
  typename: string | undefined,
  variables: Record<string, unknown> | undefined,
  currentPath = ''
): string[] {
  if (currentData && isReference(currentData)) {
    currentData = rootStore[currentData.__ref] as object | null | undefined;
    typename =
      currentData != null ? (currentData as StoreObject).__typename : undefined;
  }

  if (!currentData) {
    return [currentPath];
  }
  const missingFields: string[] = [];

  if (currentData instanceof Array) {
    currentData.forEach((item: unknown, i) => {
      const pathName = !currentPath ? `[${i}]` : `${currentPath}.[${i}]`;
      if (item === undefined) {
        missingFields.push(pathName);
      } else if (item != null && typeof item === 'object') {
        const childMissingFields = getMissingFields(
          item,
          selection,
          fragmentMap,
          rootStore,
          supertypeMap,
          optimizedRead,
          optimizedReadContext,
          (item as StoreObject).__typename,
          variables,
          pathName
        );
        if (childMissingFields.length > 0) {
          Array.prototype.push.apply(missingFields, childMissingFields);
        }
      }
    });
  } else {
    for (
      let cs = getCachedSelections(selection, fragmentMap),
        l = cs.length,
        i = 0;
      i < l;
      ++i
    ) {
      const tuple = cs[i]!;
      let actualTypename: string | undefined;
      if (typename && tuple[2]) {
        actualTypename = getActualTypename(typename, tuple[2], supertypeMap);
        if (!actualTypename) {
          continue;
        }
      }
      const name = tuple[0];
      const fieldNode = tuple[1];
      // pick read function from typename and supertype (if exists)
      const read =
        (typename && optimizedRead[typename]) ||
        (actualTypename && optimizedRead[actualTypename]);
      const pathName = !currentPath ? name : `${currentPath}.${name}`;
      const effectiveArguments = getEffectiveArguments(fieldNode, variables);
      optimizedReadContext.effectiveArguments = effectiveArguments || {};

      let value: unknown;
      let baseValue: unknown;

      if (effectiveArguments) {
        const fieldWithArguments = getFieldWithArguments(currentData, name);
        if (fieldWithArguments) {
          const record = pickRecordOfFieldWithArguments(
            fieldWithArguments,
            effectiveArguments
          );
          if (record) {
            baseValue = record[1];
          }
          value = !read
            ? baseValue
            : read(name, baseValue, optimizedReadContext);
        }
      }

      if (value === undefined) {
        baseValue = (currentData as Record<string, unknown>)[name];
        value = !read ? baseValue : read(name, baseValue, optimizedReadContext);
        if (value === undefined) {
          if (!tuple[2] || actualTypename === tuple[2]) {
            missingFields.push(pathName);
          }
        }
      }

      if (
        value != null &&
        typeof value === 'object' &&
        fieldNode.selectionSet
      ) {
        const childMissingFields = getMissingFields(
          value,
          fieldNode.selectionSet,
          fragmentMap,
          rootStore,
          supertypeMap,
          optimizedRead,
          optimizedReadContext,
          (value as StoreObject).__typename,
          variables,
          pathName
        );
        if (childMissingFields.length > 0) {
          Array.prototype.push.apply(missingFields, childMissingFields);
        }
      }
    }
  }

  return missingFields;
}
