/** This type can be used to add your types */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PredefinedTypenames {}

export interface KeyFieldsObject {
  /** Key field names for all types */
  fields?: readonly string[];
  /** Key field names for individual types */
  types?: Record<string, readonly string[]>;
}
/** An array of key field names for all types, or {@link KeyFieldsObject} */
export type KeyFields = readonly string[] | KeyFieldsObject;

export interface PossibleTypesMap {
  readonly [supertype: string | keyof PredefinedTypenames]: readonly string[];
}

export type DataIdFromObjectFunction = (object: object) => string | undefined;

export type ReadFromIdFunction = (id: string) => unknown;

export interface OptimizedReadContext {
  checkExistenceOnly: boolean;
  effectiveArguments: Record<string, unknown>;
  dataIdFromObject: DataIdFromObjectFunction;
  readFromId: ReadFromIdFunction;
}

export type OptimizedReadFunction = (
  fieldName: string,
  existingValue: unknown,
  context: OptimizedReadContext
) => unknown;

export interface OptimizedReadMap {
  [typename: string | keyof PredefinedTypenames]: OptimizedReadFunction;
}

export interface WriteToCacheContext {
  effectiveArguments: Record<string, unknown>;
}

/** Called when to write to the cache tree. Returns the value to write. When untouching the value, `incomingValue` should be returned. */
export type WriteToCacheFunction = (
  fieldName: string,
  existingValue: unknown,
  incomingValue: unknown,
  context: WriteToCacheContext
) => unknown;

export interface WriteToCacheMap {
  [typename: string | keyof PredefinedTypenames]: WriteToCacheFunction;
}

export interface OptimizedNormalizedCacheOptions {
  keyFields?: KeyFields | undefined;
  possibleTypes?: PossibleTypesMap | undefined;
  optimizedRead?: OptimizedReadMap | undefined;
  writeToCacheMap?: WriteToCacheMap | undefined;
  dataIdFromObject?: DataIdFromObjectFunction | undefined;
  rootTypes?: {
    Query?: string;
    Mutation?: string;
  };
}
