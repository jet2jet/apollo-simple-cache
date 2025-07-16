import type { SelectionSetNode } from 'graphql';
import type { FragmentMap } from '../internalTypes.mjs';

// @internal
export const PROXY_SYMBOL_OWN_KEYS = Symbol('snc:proxyOwnKeys');
// @internal
export const PROXY_SYMBOL_DIRTY = Symbol('snc:proxyDirty');
// @internal
export const PROXY_SYMBOL_TARGET = Symbol('snc:proxyTarget');
// @internal
export const PROXY_SYMBOL_BASE = Symbol('snc:proxyBase');
// @internal
export const PROXY_SYMBOL_GET_EFFECTIVE_ARGUMENTS = Symbol(
  'snc:proxyGetEffectiveArguments'
);

// @internal
export type ProxyObject = Record<string | symbol, unknown> & {
  readonly [PROXY_SYMBOL_OWN_KEYS]: readonly string[];
  [PROXY_SYMBOL_DIRTY]: boolean;
  readonly [PROXY_SYMBOL_TARGET]: object;
  readonly [PROXY_SYMBOL_BASE]: object;
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
