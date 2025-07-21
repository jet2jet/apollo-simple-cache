import {
  isReference,
  type Modifiers,
  type Reference,
  type StoreObject,
} from '@apollo/client/cache';
import type {
  AllFieldsModifier,
  CanReadFunction,
  Modifier,
  ModifierDetails,
  ReadFieldOptions,
  ToReferenceFunction,
} from '@apollo/client/cache/core/types/common';
import {
  DELETE_MODIFIER,
  INVALIDATE_MODIFIER,
} from '../../utilities/constants.mjs';
import hasOwn from '../../utilities/hasOwn.mjs';
import variablesToString from '../../utilities/variablesToString.mjs';
import type {
  ChangedFields,
  ChangedFieldsArray,
  SupertypeMap,
} from '../internalTypes.mjs';
import type {
  DataIdFromObjectFunction,
  OptimizedReadMap,
  ReadFromIdFunction,
} from '../types.mjs';
import getFieldValue from './getFieldValue.mjs';
import getFieldWithArguments from './getFieldWithArguments.mjs';
import getNameFromFieldWithArgumentsName from './getNameFromFieldWithArgumentsName.mjs';
import pickRecordOfFieldWithArguments from './pickRecordOfFieldWithArguments.mjs';

type ModifierDetailsBase = Pick<
  ModifierDetails,
  | 'DELETE'
  | 'INVALIDATE'
  | 'isReference'
  | 'canRead'
  | 'toReference'
  | 'storage'
>;

function makeFieldNameWithArgumentsForProxy(
  fieldName: string,
  args: Record<string, unknown>
) {
  // May compatible with Apollo's InMemoryCache
  return `${fieldName}(${variablesToString(args)})`;
}

function makeModifyProxyObject(
  proxyMap: WeakMap<object, object>,
  value: object
): object {
  if (proxyMap.has(value)) {
    return proxyMap.get(value)!;
  }
  if (value instanceof Array) {
    const a: unknown[] = [];
    proxyMap.set(value, a);
    for (let i = 0, l = value.length; i < l; ++i) {
      const v: unknown = value[i];
      if (v != null && typeof v === 'object') {
        a[i] = makeModifyProxyObject(proxyMap, v);
      } else {
        a[i] = v;
      }
    }
    return a;
  }

  const keys: string[] = [];
  const fieldWithArgumentsMap: Record<
    string,
    [Record<string, unknown>, unknown]
  > = {};

  for (const key in value) {
    const actualName = getNameFromFieldWithArgumentsName(key);
    if (actualName) {
      const fieldWithArguments = getFieldWithArguments(value, actualName);
      if (fieldWithArguments) {
        for (const record of fieldWithArguments.r) {
          const storeFieldName = makeFieldNameWithArgumentsForProxy(
            actualName,
            record[0]
          );
          keys.push(storeFieldName);
          fieldWithArgumentsMap[storeFieldName] = record;
        }
      }
    } else {
      keys.push(key);
    }
  }

  const target = { __proto__: null } as Record<string | symbol, unknown>;
  const proxy = new Proxy(target, {
    get: (_, p) => {
      if (hasOwn(target, p)) {
        return target[p];
      }
      if (!keys.some((k) => p === k)) {
        return undefined;
      }
      let val: unknown;
      if (typeof p === 'string') {
        const rec = fieldWithArgumentsMap[p];
        if (rec) {
          val = rec[1];
        } else {
          val = (value as Record<string, unknown>)[p];
        }
      } else {
        val = (value as Record<string | symbol, unknown>)[p];
      }
      if (val != null && typeof val === 'object') {
        val = makeModifyProxyObject(proxyMap, val);
      }
      target[p] = val;
      return val;
    },
    set: (_, p, newValue: unknown) => {
      if (
        newValue === DELETE_MODIFIER ||
        newValue === INVALIDATE_MODIFIER ||
        newValue == null ||
        typeof newValue !== 'object'
      ) {
        target[p] = newValue;
      } else {
        target[p] = makeModifyProxyObject(proxyMap, newValue);
      }
      return true;
    },
    ownKeys: () => keys,
    has: (_, p) => keys.some((k) => p === k),
    getOwnPropertyDescriptor: () => {
      return {
        enumerable: true,
        configurable: true,
      };
    },
  });
  proxyMap.set(value, proxy);
  return proxy;
}

function doModify(
  rootStore: Record<string, unknown>,
  data: object,
  fieldName: string,
  storeFieldName: string,
  value: unknown,
  fieldFunction: Modifier<unknown>,
  detailsBase: ModifierDetailsBase,
  proxyMap: WeakMap<object, object>,
  supertypeMap: SupertypeMap | undefined,
  optimizedRead: OptimizedReadMap,
  dataIdFromObject: DataIdFromObjectFunction,
  readFromId: ReadFromIdFunction,
  currentPath: ChangedFields,
  outChangedFields: ChangedFieldsArray
): [value: unknown, modified: boolean] {
  const details: ModifierDetails = {
    ...detailsBase,
    fieldName,
    storeFieldName,
    readField: (
      fieldNameOrOptions: string | ReadFieldOptions,
      from?: StoreObject | Reference
    ) => {
      const fieldName =
        typeof fieldNameOrOptions === 'string'
          ? fieldNameOrOptions
          : fieldNameOrOptions.fieldName;
      const f =
        typeof fieldNameOrOptions === 'string' ? from : fieldNameOrOptions.from;
      const args =
        typeof fieldNameOrOptions === 'string'
          ? undefined
          : fieldNameOrOptions.args;
      const variables =
        typeof fieldNameOrOptions === 'string'
          ? undefined
          : fieldNameOrOptions.variables;
      const o = isReference(f)
        ? rootStore[f.__ref]
        : typeof f === 'object'
          ? f
          : data;
      if (o == null) {
        return undefined;
      }
      return getFieldValue(
        o,
        null,
        fieldName,
        supertypeMap,
        optimizedRead,
        dataIdFromObject,
        readFromId,
        undefined,
        args || variables
      );
    },
  };

  let modified = false;

  const r = fieldFunction(
    value != null && typeof value === 'object'
      ? makeModifyProxyObject(proxyMap, value)
      : value,
    details
  );
  if (
    r === DELETE_MODIFIER ||
    r === INVALIDATE_MODIFIER ||
    r == null ||
    typeof r !== 'object'
  ) {
    return [r, false];
  }
  // Convert to the object for store
  const seenObject = new WeakSet<object>();
  const mergeIntoStore = (
    object: object,
    returnValue: object,
    currentPath: ChangedFields | undefined
  ): object => {
    if (seenObject.has(object)) {
      return object;
    }
    seenObject.add(object);

    if (returnValue instanceof Array) {
      if (!(object instanceof Array) || object.length !== returnValue.length) {
        modified = true;
        if (currentPath) {
          outChangedFields.push(currentPath);
        }
        return returnValue.map((value: unknown) => {
          if (value == null || typeof value !== 'object') {
            return value;
          }
          return mergeIntoStore({ __proto__: null }, value, undefined);
        });
      }
      for (let i = object.length - 1; i >= 0; --i) {
        const o: unknown = object[i];
        const v: unknown = returnValue[i];
        if (v === DELETE_MODIFIER || v === INVALIDATE_MODIFIER) {
          object.splice(i, 1);
          modified = true;
          if (currentPath) {
            outChangedFields.push(currentPath);
            currentPath = undefined;
          }
        } else if (v == null || typeof v !== 'object') {
          if (o !== v) {
            modified = true;
            if (currentPath) {
              outChangedFields.push(currentPath);
              currentPath = undefined;
            }
            object[i] = v;
          }
        } else if (o == null || typeof o !== 'object') {
          modified = true;
          if (currentPath) {
            outChangedFields.push(currentPath);
            currentPath = undefined;
          }
          object[i] = mergeIntoStore({ __proto__: null }, v, undefined);
        } else {
          object[i] = mergeIntoStore(o, v, currentPath);
        }
      }
      return object as unknown[];
    } // for Array

    const id = dataIdFromObject(returnValue) || dataIdFromObject(object);
    if (id) {
      object = rootStore[id] || (rootStore[id] = { __proto__: null });
      seenObject.add(object);
    }

    const seenFields: Record<string, true> = {};

    // First, walk for all existing keys in object (detination)
    for (const key of Object.keys(object)) {
      const actualFieldName = getNameFromFieldWithArgumentsName(key);
      if (actualFieldName) {
        seenFields[actualFieldName] = true;
        const fieldWithArguments = getFieldWithArguments(
          object,
          actualFieldName
        );
        if (fieldWithArguments) {
          const records = fieldWithArguments.r;
          for (let i = records.length - 1; i >= 0; --i) {
            const record = records[i]!;
            const storeFieldName = makeFieldNameWithArgumentsForProxy(
              actualFieldName,
              record[0]
            );
            const r =
              storeFieldName in returnValue
                ? (returnValue as Record<string, unknown>)[storeFieldName]
                : DELETE_MODIFIER;
            let mod = false;
            if (r === DELETE_MODIFIER || r === INVALIDATE_MODIFIER) {
              records.splice(i, 1);
              mod = true;
            } else if (r != null && typeof r === 'object') {
              const o = record[1];
              if (o == null || typeof o !== 'object') {
                mod = true;
                record[1] = mergeIntoStore({ __proto__: null }, r, undefined);
              } else {
                record[1] = mergeIntoStore(
                  o,
                  r,
                  currentPath
                    ? [...currentPath, [actualFieldName, record[0]]]
                    : undefined
                );
              }
            } else {
              const v = record[1];
              record[1] = r;
              if (v !== r) {
                mod = true;
              }
            }

            modified ||= mod;
            if (mod && currentPath) {
              outChangedFields.push([
                ...currentPath,
                [actualFieldName, record[0]],
              ]);
            }
          }
        }
        // end of field with arguments
      } else {
        seenFields[key] = true;

        const v = (object as Record<string, unknown>)[key];
        const r =
          key in returnValue
            ? (returnValue as Record<string, unknown>)[key]
            : DELETE_MODIFIER;
        let mod = false;

        if (r === DELETE_MODIFIER || r === INVALIDATE_MODIFIER) {
          delete (object as Record<string, unknown>)[key];
          mod = true;
        } else if (r != null && typeof r === 'object') {
          if (v == null || typeof v !== 'object') {
            mod = true;
            (object as Record<string, unknown>)[key] = mergeIntoStore(
              { __proto__: null },
              r,
              undefined
            );
          } else {
            (object as Record<string, unknown>)[key] = mergeIntoStore(
              v,
              r,
              currentPath ? [...currentPath, key] : undefined
            );
          }
        } else {
          (object as Record<string, unknown>)[key] = r;
          if (v !== r) {
            mod = true;
          }
        }

        modified ||= mod;
        if (mod && currentPath) {
          outChangedFields.push([...currentPath, key]);
        }
      }
    }

    // Second, walk for all keys in returnValue, to check whether the field(s) is added
    for (const key of Object.keys(returnValue)) {
      let actualFieldName = key;
      let argsString: string | undefined;
      {
        const i = key.indexOf('(');
        if (i >= 0) {
          actualFieldName = key.substring(0, i);
          argsString = key.substring(i + 1, key.length - 1);
        }
      }

      // Do not set seenFields[actualFieldName] = true, since there may be multiple entries with different arguments
      if (seenFields[actualFieldName]) {
        continue;
      }

      const r = (returnValue as Record<string, unknown>)[key];
      if (
        r === DELETE_MODIFIER ||
        r === INVALIDATE_MODIFIER ||
        r === undefined
      ) {
        // The field does not exist
        continue;
      }

      let fieldWithArguments = getFieldWithArguments(object, actualFieldName);
      if (!fieldWithArguments && argsString && !(actualFieldName in object)) {
        (object as Record<string, unknown>)[actualFieldName] =
          fieldWithArguments = { r: [] };
      }
      if (fieldWithArguments) {
        let args: Record<string, unknown>;
        if (!argsString) {
          args = {};
        } else {
          try {
            args = JSON.parse(argsString) as Record<string, unknown>;
          } catch {
            args = {};
          }
        }
        let mod = false;
        const record = pickRecordOfFieldWithArguments(fieldWithArguments, args);
        if (record) {
          const v = record[1];
          if (r != null && typeof r === 'object') {
            if (v == null || typeof v !== 'object') {
              mod = true;
              record[1] = mergeIntoStore({ __proto__: null }, r, undefined);
            } else {
              record[1] = mergeIntoStore(
                v,
                r,
                currentPath
                  ? [...currentPath, [actualFieldName, args]]
                  : undefined
              );
            }
          } else {
            record[1] = r;
            if (v !== r) {
              mod = true;
            }
          }
        } else {
          mod = true;
          const v =
            r != null && typeof r === 'object'
              ? mergeIntoStore({ __proto__: null }, r, undefined)
              : r;
          fieldWithArguments.r.push([args, v]);
        }
        modified ||= mod;
        if (mod && currentPath) {
          outChangedFields.push([...currentPath, [actualFieldName, args]]);
        }
      } else {
        const r = (returnValue as Record<string, unknown>)[key];
        let mod = false;
        if (actualFieldName in object) {
          if (argsString) {
            throw new Error(
              `Existing field does not have arguments (reading ${actualFieldName})`
            );
          } else {
            const v = (object as Record<string, unknown>)[actualFieldName];
            if (r != null && typeof r === 'object') {
              if (v == null || typeof v !== 'object') {
                mod = true;
                (object as Record<string, unknown>)[actualFieldName] =
                  mergeIntoStore({ __proto__: null }, r, undefined);
              } else {
                (object as Record<string, unknown>)[actualFieldName] =
                  mergeIntoStore(
                    v,
                    r,
                    currentPath ? [...currentPath, actualFieldName] : undefined
                  );
              }
            } else {
              (object as Record<string, unknown>)[actualFieldName] = r;
              if (v !== r) {
                mod = true;
              }
            }
          }
        } else {
          mod = true;
          if (r != null && typeof r === 'object') {
            (object as Record<string, unknown>)[actualFieldName] =
              mergeIntoStore({ __proto__: null }, r, undefined);
          } else {
            (object as Record<string, unknown>)[actualFieldName] = r;
          }
        }
        modified ||= mod;
        if (mod && currentPath) {
          outChangedFields.push([...currentPath, actualFieldName]);
        }
      }
    }

    return object;
  }; // mergeIntoStore

  let _currentPath: ChangedFields | undefined = currentPath && [
    ...currentPath,
    storeFieldName,
  ];
  if (value == null || typeof value !== 'object') {
    outChangedFields.push(_currentPath);
    _currentPath = undefined;
  }
  const ret = mergeIntoStore(
    value != null && typeof value === 'object' ? value : { __proto__: null },
    r,
    _currentPath
  );
  return [ret, modified];
}

// @internal
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function modifyField<Entity extends Record<string, any>>(
  rootStore: Record<string, unknown>,
  data: object,
  fieldsData: Modifiers<Entity> | AllFieldsModifier<Entity>,
  supertypeMap: SupertypeMap | undefined,
  canRead: CanReadFunction,
  toReference: ToReferenceFunction,
  optimizedRead: OptimizedReadMap,
  dataIdFromObject: DataIdFromObjectFunction,
  readFromId: ReadFromIdFunction,
  currentPath: ChangedFields,
  outChangedFields: ChangedFieldsArray
): boolean {
  const detailsBase: ModifierDetailsBase = {
    DELETE: DELETE_MODIFIER,
    INVALIDATE: INVALIDATE_MODIFIER,
    isReference,
    canRead,
    toReference,
    storage: {},
  };
  const proxyMap = new WeakMap<object, object>();
  let modified = false;

  for (const fieldName in data) {
    const value = (data as Record<string, unknown>)[fieldName];
    if (value === undefined) {
      continue;
    }

    const actualFieldName = getNameFromFieldWithArgumentsName(fieldName);
    const fieldFunction =
      typeof fieldsData === 'function'
        ? fieldsData
        : fieldsData[actualFieldName || fieldName];
    if (fieldFunction == null) {
      continue;
    }

    const fieldWithArguments = actualFieldName
      ? getFieldWithArguments(data, actualFieldName)
      : undefined;
    if (fieldWithArguments) {
      const records = fieldWithArguments.r;
      for (let i = records.length - 1; i >= 0; --i) {
        const record = records[i]!;
        const args = record[0];
        const recordValue = record[1];
        const modifiedData = doModify(
          rootStore,
          data,
          actualFieldName!,
          makeFieldNameWithArgumentsForProxy(actualFieldName!, args),
          recordValue,
          fieldFunction as Modifier<unknown>,
          detailsBase,
          proxyMap,
          supertypeMap,
          optimizedRead,
          dataIdFromObject,
          readFromId,
          currentPath,
          outChangedFields
        );
        const modifiedValue = modifiedData[0];
        modified ||= modifiedData[1];
        if (
          modifiedValue === DELETE_MODIFIER ||
          modifiedValue === INVALIDATE_MODIFIER
        ) {
          modified = true;
          records.splice(i, 1);
          const newPath = currentPath.slice() as typeof currentPath;
          // mark as deleted
          newPath[0] = true;
          newPath.push([actualFieldName!, args]);
          outChangedFields.push(newPath);
        } else {
          record[1] = modifiedValue;
          if (modifiedValue !== recordValue) {
            modified = true;
            outChangedFields.push([...currentPath, [actualFieldName!, args]]);
          }
        }
      }
    } else {
      const modifiedData = doModify(
        rootStore,
        data,
        fieldName,
        fieldName,
        value,
        fieldFunction as Modifier<unknown>,
        detailsBase,
        proxyMap,
        supertypeMap,
        optimizedRead,
        dataIdFromObject,
        readFromId,
        currentPath,
        outChangedFields
      );
      const modifiedValue = modifiedData[0];
      modified ||= modifiedData[1];
      if (
        modifiedValue === DELETE_MODIFIER ||
        modifiedValue === INVALIDATE_MODIFIER
      ) {
        modified = true;
        const newPath = currentPath.slice() as typeof currentPath;
        // mark as deleted
        newPath[0] = true;
        newPath.push(fieldName);
        outChangedFields.push(newPath);
      } else {
        (data as Record<string, unknown>)[fieldName] = modifiedValue;
        if (modifiedValue !== value) {
          modified = true;
          outChangedFields.push([...currentPath, fieldName]);
        }
      }
    }
  }

  return modified;
}
