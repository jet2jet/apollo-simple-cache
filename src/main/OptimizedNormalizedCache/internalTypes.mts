import type { StoreValue } from '@apollo/client';
import type {
  Cache,
  Modifier,
  ModifierDetails,
  ReadFieldOptions,
} from '@apollo/client/cache';
import type {
  FieldNode,
  FragmentDefinitionNode,
  SelectionSetNode,
} from 'graphql';
import type { ProxyObject } from './proxyObjects/types.mts';

// from Apollo Client v3
// @internal
export type { Modifier, ModifierDetails, ReadFieldOptions };

// @internal
export type AllFieldsModifier<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Entity extends Record<string, any> = Record<string, any>,
> = Exclude<
  Cache.ModifyOptions<Entity>['fields'],
  (...args: never[]) => unknown
>;
// @internal
export type FieldsDataParameter<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Entity extends Record<string, any> = Record<string, any>,
> = Cache.ModifyOptions<Entity>['fields'];
// @internal
export type CanReadFunction = ModifierDetails['canRead'];
// @internal
export type ToReferenceFunction = ModifierDetails['toReference'];
// @internal
export type DeleteModifier = ModifierDetails['DELETE'];
// @internal
export type InvalidateModifier = ModifierDetails['INVALIDATE'];

// @internal
export type FragmentMap = Record<string, FragmentDefinitionNode>;

/**
 * Record of child typename and super typenames
 * @internal
 */
export type SupertypeMap = Record<string, string[]>;

// @internal
export type SelectionTuple = [
  name: string,
  fieldNode: FieldNode,
  parentTypename: string | undefined,
];

// @internal
export type FieldWithArgumentsDataRecord = [
  args: Record<string, unknown>,
  data: unknown,
];

// @internal
export interface FieldWithArguments {
  r: FieldWithArgumentsDataRecord[];
}

// @internal
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SliceFirst<T extends any[]> = T extends [
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...infer A extends any[],
]
  ? A
  : [];

// @internal
export type ChangedFields = [
  isDeletedOrModified: boolean,
  id: string,
  ...Array<
    string | [fieldName: string, effectiveArguments: Record<string, unknown>]
  >,
];

// @internal
export type ChangedFieldsPathPart = SliceFirst<SliceFirst<ChangedFields>>;

// @internal
export type ChangedFieldsArray = ChangedFields[];

// @internal
export type MissingFieldRecord = [
  selectionSet: SelectionSetNode,
  fragmentMap: FragmentMap,
  variables: Record<string, unknown> | undefined,
  variablesString: string,
  missing: string[],
];

// @internal
export const SYMBOL_PROXY_ARRAY = Symbol('smc:proxies');

// @internal
export type DataStoreObject = {
  [key: string]: StoreValue | DataStoreObject;
  [SYMBOL_PROXY_ARRAY]?: ProxyObject[];
};
