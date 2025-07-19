import { type Reference, type StoreObject } from '@apollo/client';
import type { FieldNode, SelectionSetNode } from 'graphql';
import equal from '../../utilities/equal.mjs';
import {
  SYMBOL_PROXY_ARRAY,
  type ChangedFields,
  type ChangedFieldsArray,
  type DataStoreObject,
  type FragmentMap,
  type SupertypeMap,
} from '../internalTypes.mjs';
import type { KeyFields, WriteToCacheMap } from '../types.mjs';
import getActualTypename from './getActualTypename.mjs';
import getCachedSelections from './getCachedSelections.mjs';
import getEffectiveArguments from './getEffectiveArguments.mjs';
import getFieldWithArguments from './getFieldWithArguments.mjs';
import isReference from './isReference.mjs';
import makeReference from './makeReference.mjs';
import makeStoreId from './makeStoreId.mjs';
import markProxyDirty from './markProxyDirty.mjs';
import pickRecordOfFieldWithArguments from './pickRecordOfFieldWithArguments.mjs';
import releaseDataStoreObject from './releaseDataStoreObject.mjs';

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

function isEqualChangedFields(a: ChangedFields, b: ChangedFields) {
  const l = a.length;
  if (l !== b.length) {
    return false;
  }
  for (let i = 0; i < l; ++i) {
    const aElem = a[i]!;
    const bElem = b[i]!;
    if (typeof aElem === 'string') {
      if (aElem !== bElem) {
        return false;
      }
      continue;
    } else if (typeof bElem === 'string') {
      return false;
    }
    if (aElem[0] !== bElem[0]) {
      return false;
    }
    if (!equal(aElem[1], bElem[1])) {
      return false;
    }
  }
  return true;
}

function pushChangedFields(
  outChangedFields: ChangedFieldsArray,
  path: ChangedFields | undefined
) {
  if (!path) {
    return;
  }
  if (!outChangedFields.some((c) => isEqualChangedFields(c, path))) {
    outChangedFields.push(path.slice() as ChangedFields);
  }
}

function mergeObjectWithId(
  id: string,
  existing: unknown,
  incoming: object,
  selectionSet: SelectionSetNode | undefined,
  context: SetFieldValuesContext
): [Reference, boolean] {
  const rootStore = context.rs;
  let changed = false;
  if (
    rootStore[id] == null ||
    typeof rootStore[id] !== 'object' ||
    rootStore[id] instanceof Array
  ) {
    const obj: DataStoreObject =
      existing != null &&
      typeof existing === 'object' &&
      !(existing instanceof Array)
        ? (existing as DataStoreObject)
        : { __proto__: null, [SYMBOL_PROXY_ARRAY]: [] };
    rootStore[id] = obj;
    changed = true;
  }
  const r = setFieldValuesImpl(
    rootStore[id] as object,
    incoming,
    selectionSet,
    [id],
    context
  );
  return [makeReference(id), changed || r[1]];
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
    if (destArray !== target) {
      pushChangedFields(changedFields, currentPath);
      currentPath = undefined;
    }
    for (let l = source.length, i = 0; i < l; ++i) {
      const e = destArray[i];
      const s = source[i];
      if (s == null || typeof s !== 'object') {
        destArray[i] = s;
      } else {
        const id = makeStoreId(s, context.kf, context.sm);
        if (id) {
          const [merged, changed] = mergeObjectWithId(
            id,
            e,
            s,
            selectionSet,
            context
          );
          if (changed) {
            pushChangedFields(changedFields, currentPath);
          }
          destArray[i] = merged;
        } else {
          const [returnValue, changed2] = setFieldValuesImpl(
            e,
            s,
            selectionSet,
            currentPath,
            context
          );
          if (changed2) {
            pushChangedFields(changedFields, currentPath);
          }
          destArray[i] = returnValue;
        }
      }
      if (destArray[i] !== e) {
        if (e && typeof e === 'object') {
          releaseDataStoreObject(e as DataStoreObject);
        }
      }
    }

    // if changedFields has many fields, assume the object itself is changed
    if (changedFields.length < 3) {
      for (let l = changedFields.length, i = 0; i < l; ++i) {
        pushChangedFields(context.cf, changedFields[i]!);
      }
      return [destArray as unknown as T, false];
    } else {
      return [destArray as unknown as T, true];
    }
  }

  let destination: DataStoreObject;
  let changed = false;
  if (target != null && typeof target === 'object') {
    destination = target as Record<string, unknown> as DataStoreObject;
    if (!destination[SYMBOL_PROXY_ARRAY]) {
      destination[SYMBOL_PROXY_ARRAY] = [];
    }
  } else {
    destination = { __proto__: null, [SYMBOL_PROXY_ARRAY]: [] };
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
        pushChangedFields(changedFields, path);
      }
    }
  } else {
    // fragmentMap must be non-null when selectionSet is non-null
    getCachedSelections(selectionSet, context.fm!).forEach((selection) => {
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
        pushChangedFields(changedFields, path);
      }
    });
  }

  // if changedFields has many fields, assume the object itself is changed
  if (!changed && changedFields.length < 3) {
    for (let l = changedFields.length, i = 0; i < l; ++i) {
      pushChangedFields(context.cf, changedFields[i]!);
    }
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
    let merged: Reference | undefined;
    let existing: unknown;
    function doMerge() {
      if (id) {
        let changed2: boolean;
        [merged, changed2] = mergeObjectWithId(
          id,
          existing,
          val as object,
          subSelectionSet,
          context
        );
        if (path && changed2) {
          changed = true;
          context.cf.push(path);
        }
      }
    }

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
        if (merged) {
          changed = !isReference(existing) || existing.__ref !== merged.__ref;
          record[1] = merged;
        } else {
          let changed2: boolean;
          [record[1], changed2] = setFieldValuesImpl(
            existing,
            val,
            subSelectionSet,
            path,
            context
          );
          changed ||= changed2;
        }
        if (existing !== record[1]) {
          if (existing && typeof existing === 'object') {
            releaseDataStoreObject(existing as DataStoreObject);
          }
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
          existing as DataStoreObject | undefined,
          val,
          subSelectionSet,
          path,
          context
        );
        changed ||= changed2;
      }
      if (destination[name] !== existing) {
        if (existing && typeof existing === 'object') {
          releaseDataStoreObject(existing as DataStoreObject);
        }
      }
    }
    if (changed) {
      markProxyDirty(destination);
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
  target: DataStoreObject,
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
  target: DataStoreObject,
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
  target: DataStoreObject,
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
      mergeObjectWithId(id, undefined, source, undefined, context);
    }
  } else {
    setFieldValuesImpl(target, source, selectionSet, [startPathName], context);
  }
}
