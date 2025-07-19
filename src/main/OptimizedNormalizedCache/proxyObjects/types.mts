import type { SelectionSetNode } from 'graphql';
import type { FragmentMap, SupertypeMap } from '../internalTypes.mjs';
import type {
  DataIdFromObjectFunction,
  KeyFields,
  OptimizedReadMap,
  ReadFromIdFunction,
} from '../types.mjs';

// @internal
export const PROXY_SYMBOL_DIRTY = Symbol('snc:proxyDirty');
// @internal
export const PROXY_SYMBOL_TARGET = Symbol('snc:proxyTarget');
// @internal
export const PROXY_SYMBOL_BASE = Symbol('snc:proxyBase');
// @internal
export const PROXY_SYMBOL_OWN_KEYS = Symbol('snc:proxyOwnKeys');
// @internal
export const PROXY_SYMBOL_SELECTION_SETS = Symbol('snc:proxySelectionSets');
// @internal
export const PROXY_SYMBOL_FRAGMENT_MAP = Symbol('snc:proxyFragmentMap');
// @internal
export const PROXY_SYMBOL_BASE_CACHE = Symbol('snc:proxyBaseCache');
// @internal
export const PROXY_SYMBOL_VARIABLES = Symbol('snc:proxyVariables');
// @internal
export const PROXY_SYMBOL_VARIABLES_STRING = Symbol('snc:proxyVariablesString');
// @internal
export const PROXY_SYMBOL_GET_EFFECTIVE_ARGUMENTS = Symbol(
  'snc:proxyGetEffectiveArguments'
);

// @internal
export interface BaseCache {
  readonly data: Record<string, unknown>;
  readonly keyFields: KeyFields | undefined;
  readonly supertypeMap: SupertypeMap | undefined;
  readonly optimizedRead: OptimizedReadMap;
  readonly dataIdFromObject: DataIdFromObjectFunction;
  readonly readFromId: ReadFromIdFunction;
}

// @internal
export type ProxyObject = Record<string | symbol, unknown> & {
  [PROXY_SYMBOL_DIRTY]: boolean;
  readonly [PROXY_SYMBOL_TARGET]: object;
  [PROXY_SYMBOL_BASE]: object;
  [PROXY_SYMBOL_OWN_KEYS]: readonly string[];
  [PROXY_SYMBOL_SELECTION_SETS]: readonly SelectionSetNode[];
  [PROXY_SYMBOL_FRAGMENT_MAP]: FragmentMap;
  [PROXY_SYMBOL_BASE_CACHE]: BaseCache;
  [PROXY_SYMBOL_VARIABLES]: Record<string, unknown> | undefined;
  [PROXY_SYMBOL_VARIABLES_STRING]: string;
  readonly [PROXY_SYMBOL_GET_EFFECTIVE_ARGUMENTS]: (
    fieldName: string
  ) => Record<string, unknown> | undefined;
};

// @internal
export type ProxyCacheRecord = [
  variablesString: string,
  base: object,
  proxy: ProxyObject | undefined,
  lastAccessTime: number,
];

// @internal
export interface ProxyCacheEntry {
  id: string | undefined;
  /** records */
  r: ProxyCacheRecord[];
  /** fragmentMap */
  fm: FragmentMap;
  /** subMap */
  // eslint-disable-next-line no-use-before-define
  sm?: ProxyCacheMap | undefined;
}

// @internal
export type ProxyCacheMap = Map<SelectionSetNode, ProxyCacheEntry>;

// @internal
export type RevokedProxyRecords = Array<
  [record: ProxyCacheRecord, parentRecords: ProxyCacheRecord[]]
>;

// redefinition for definition order
// @internal
export interface BaseCache {
  readonly proxyCacheMap: ProxyCacheMap;
  readonly proxyCacheRecords: ProxyCacheRecord[];
  readonly revokedProxyRecords: RevokedProxyRecords;
  readonly setProxyCleanTimer: () => void;
}
