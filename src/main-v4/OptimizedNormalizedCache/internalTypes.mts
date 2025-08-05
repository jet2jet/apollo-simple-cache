import type { StoreValue } from '@apollo/client';
import type {
  FieldNode,
  FragmentDefinitionNode,
  SelectionSetNode,
} from 'graphql';
import type { ProxyObject } from './proxyObjects/types.mjs';

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
  isDeleted: boolean,
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
