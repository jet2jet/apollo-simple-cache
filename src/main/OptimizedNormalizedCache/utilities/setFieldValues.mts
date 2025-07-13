import type { StoreObject } from '@apollo/client';
import type { FieldNode, SelectionSetNode } from 'graphql';
import type {
  ChangedFields,
  ChangedFieldsArray,
  FragmentMap,
  SupertypeMap,
} from '../internalTypes.mjs';
import type { KeyFields, WriteToCacheMap } from '../types.mjs';
import getActualTypename from './getActualTypename.mjs';
import getCachedSelections from './getCachedSelections.mjs';
import getEffectiveArguments from './getEffectiveArguments.mjs';
import getFieldWithArguments from './getFieldWithArguments.mjs';
import makeStoreId from './makeStoreId.mjs';
import pickRecordOfFieldWithArguments from './pickRecordOfFieldWithArguments.mjs';

interface SetFieldValuesContext {
  /** rootStore */
  rs: Record<string, unknown>;
  /** fragmentMap */
  fm: FragmentMap | undefined;
  /** keyFields */
  kf: KeyFields | undefined;
  /** supertypeMap */
  sm: SupertypeMap | undefined;
  /** writeToCacheMap */
  wm: WriteToCacheMap | undefined;
  /** outChangedFields */
  cf: ChangedFieldsArray;
  /** variables */
  v: Record<string, unknown> | undefined;
}

function mergeObjectWithId(
  id: string,
  existing: unknown,
  incoming: object,
  selectionSet: SelectionSetNode | undefined,
  currentPath: ChangedFields | undefined,
  context: SetFieldValuesContext
): [object, boolean] {
  const rootStore = context.rs;
  if (
    rootStore[id] == null ||
    typeof rootStore[id] !== 'object' ||
    rootStore[id] instanceof Array
  ) {
    const obj =
      existing != null &&
      typeof existing === 'object' &&
      !(existing instanceof Array)
        ? existing
        : (Object.create(null) as object);
    rootStore[id] = obj;
  }
  return setFieldValuesImpl(
    rootStore[id] as object,
    incoming,
    selectionSet,
    currentPath,
    context
  );
}

/** Return value `changed` only effects on `currentPath != null` */
function setFieldValuesImpl<T>(
  target: T,
  source: unknown,
  selectionSet: SelectionSetNode | undefined,
  currentPath: ChangedFields | undefined,
  context: SetFieldValuesContext
): [value: T, changed: boolean] {
  if (source == null || typeof source !== 'object') {
    return [source as T, !!currentPath && target !== source];
  }

  if (source instanceof Array) {
    const changedFields: ChangedFieldsArray = [];
    // If target is same size array for source, destArray will be the same instance for target
    const destArray: unknown[] =
      target instanceof Array && target.length === source.length ? target : [];
    destArray.length = source.length;
    if (destArray !== target && currentPath) {
      changedFields.push(currentPath.slice() as ChangedFields);
      currentPath = undefined;
    }
    source.forEach((s: unknown, i) => {
      if (s == null || typeof s !== 'object') {
        destArray[i] = s;
      } else {
        const id = makeStoreId(s, context.kf, context.sm);
        if (id) {
          const [merged, changed] = mergeObjectWithId(
            id,
            destArray[i],
            s,
            selectionSet,
            currentPath,
            context
          );
          if (currentPath && changed) {
            changedFields.push(currentPath.slice() as ChangedFields);
          }
          const newPath: ChangedFields = [id];
          const [returnValue, changed2] = setFieldValuesImpl(
            merged,
            s,
            selectionSet,
            newPath,
            context
          );
          if (changed2) {
            changedFields.push(newPath);
          }
          destArray[i] = returnValue;
        }
      }
    });
    return [destArray as unknown as T, changedFields.length > 0];
  }

  let destination: Record<string, unknown>;
  let changed = false;
  if (target != null && typeof target === 'object') {
    destination = target as Record<string, unknown>;
  } else {
    destination = Object.create(null) as Record<string, unknown>;
    changed = true;
    // Set undefined to avoid adding child paths
    currentPath = undefined;
  }

  const typename = (source as StoreObject).__typename;
  if (typename) {
    destination.__typename = typename;
  }
  const changedFields: ChangedFieldsArray = [];

  if (!selectionSet) {
    // No selection set, enumerate all existing fields
    for (const name in source) {
      const effectiveArguments = getEffectiveArguments(null, context.v);
      const path = joinCurrentPath(name, effectiveArguments);
      if (process(name, null, typename, undefined, path, effectiveArguments)) {
        if (path) {
          changedFields.push(path);
        }
      }
    }
  } else {
    // fragmentMap must be non-null when selectionSet is non-null
    for (const selection of getCachedSelections(selectionSet, context.fm!)) {
      const name = selection[0];
      const effectiveArguments = getEffectiveArguments(selection[1], context.v);
      const path = joinCurrentPath(name, effectiveArguments);
      if (
        process(
          name,
          selection[1],
          typename,
          selection[2],
          path,
          effectiveArguments
        )
      ) {
        if (path) {
          changedFields.push(path);
        }
      }
    }
  }

  // if changedFields has many fields, assume the object itself is changed
  if (!changed && changedFields.length < 3) {
    context.cf.push(...changedFields);
    return [destination as T, false];
  } else {
    return [destination as T, true];
  }

  function process(
    name: string,
    fieldNode: FieldNode | null,
    typename: string | undefined,
    selectionTypename: string | undefined,
    path: ChangedFields | undefined,
    effectiveArguments: Record<string, unknown> | undefined
  ): boolean {
    let changed = false;
    let actualTypename: string | undefined;
    if (selectionTypename) {
      actualTypename = getActualTypename(
        typename,
        selectionTypename,
        context.sm
      );
      // skip if type is mismatch
      if (!actualTypename) {
        return false;
      }
    }
    const writeToCacheMap = context.wm;
    const write =
      writeToCacheMap &&
      ((typename && writeToCacheMap[typename]) ||
        (actualTypename && writeToCacheMap[actualTypename]));
    let val = (source as Record<string, unknown>)[name];
    if (write) {
      val = write(name, destination[name], val, {
        effectiveArguments: effectiveArguments || {},
      });
    }
    const subSelectionSet = fieldNode ? fieldNode.selectionSet : undefined;

    const id =
      val != null && typeof val === 'object'
        ? makeStoreId(val, context.kf, context.sm)
        : undefined;
    let merged: unknown;
    let existing: unknown;
    const doMerge = () => {
      if (id) {
        let changed2: boolean;
        [merged, changed2] = mergeObjectWithId(
          id,
          existing,
          val as object,
          subSelectionSet,
          path,
          context
        );
        if (path && changed2) {
          changed = true;
          context.cf.push(path);
        }
        path = [id];
      }
    };

    if (effectiveArguments) {
      // Store value for specific arguments
      const fieldWithArguments = getFieldWithArguments(destination, name, true);
      const record = pickRecordOfFieldWithArguments(
        fieldWithArguments,
        effectiveArguments
      );
      if (record) {
        existing = record[1];
        doMerge();
        if (merged !== undefined) {
          changed = record[1] !== merged;
          record[1] = merged;
        } else {
          let changed2: boolean;
          [record[1], changed2] = setFieldValuesImpl(
            record[1],
            val,
            subSelectionSet,
            path,
            context
          );
          changed ||= changed2;
        }
      } else {
        doMerge();
        if (merged !== undefined) {
          changed = true;
          fieldWithArguments.r.push([effectiveArguments, merged]);
        } else {
          const tuple = setFieldValuesImpl(
            null,
            val,
            subSelectionSet,
            path,
            context
          );
          fieldWithArguments.r.push([effectiveArguments, tuple[0]]);
          changed = true;
        }
      }
    } else {
      existing = destination[name];
      doMerge();
      // Store value normally
      if (merged !== undefined) {
        destination[name] = merged;
      } else {
        let changed2: boolean;
        [destination[name], changed2] = setFieldValuesImpl(
          destination[name],
          val,
          subSelectionSet,
          path,
          context
        );
        changed ||= changed2;
      }
    }
    return changed;
  }

  function joinCurrentPath(
    path: string,
    effectiveArguments: Record<string, unknown> | undefined
  ): ChangedFields | undefined {
    return currentPath
      ? [...currentPath, effectiveArguments ? [path, effectiveArguments] : path]
      : undefined;
  }
}

// @internal
export default function setFieldValues(
  rootStore: Record<string, unknown>,
  target: Record<string, unknown>,
  source: unknown,
  selectionSet: undefined,
  fragmentMap: undefined,
  keyFields: KeyFields | undefined,
  supertypeMap: SupertypeMap | undefined,
  writeToCacheMap: WriteToCacheMap | undefined,
  startPathName: string,
  outChangedFields: ChangedFieldsArray,
  variables: Record<string, unknown> | undefined,
  noStoreToRoot: boolean
): void;
// @internal
export default function setFieldValues(
  rootStore: Record<string, unknown>,
  target: Record<string, unknown>,
  source: unknown,
  selectionSet: SelectionSetNode,
  fragmentMap: FragmentMap,
  keyFields: KeyFields | undefined,
  supertypeMap: SupertypeMap | undefined,
  writeToCacheMap: WriteToCacheMap | undefined,
  startPathName: string,
  outChangedFields: ChangedFieldsArray,
  variables: Record<string, unknown> | undefined,
  noStoreToRoot: boolean
): void;

// @internal
export default function setFieldValues(
  rootStore: Record<string, unknown>,
  target: Record<string, unknown>,
  source: unknown,
  selectionSet: SelectionSetNode | undefined,
  fragmentMap: FragmentMap | undefined,
  keyFields: KeyFields | undefined,
  supertypeMap: SupertypeMap | undefined,
  writeToCacheMap: WriteToCacheMap | undefined,
  startPathName: string,
  outChangedFields: ChangedFieldsArray,
  variables: Record<string, unknown> | undefined,
  noStoreToRoot: boolean
): void {
  if (source == null || typeof source !== 'object') {
    // To write to the root, source must be object.
    return;
  }

  const context: SetFieldValuesContext = {
    rs: rootStore,
    fm: fragmentMap,
    kf: keyFields,
    sm: supertypeMap,
    wm: writeToCacheMap,
    cf: outChangedFields,
    v: variables,
  };

  if (noStoreToRoot) {
    const id = makeStoreId(source, keyFields, supertypeMap);
    if (id) {
      mergeObjectWithId(id, undefined, source, undefined, [id], context);
    }
  } else {
    setFieldValuesImpl(target, source, selectionSet, [startPathName], context);
  }
}
