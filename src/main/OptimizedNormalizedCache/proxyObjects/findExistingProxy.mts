import type { SelectionSetNode } from 'graphql';
import type { FragmentMap } from '../internalTypes.mjs';
import {
  type RevokedProxyRecords,
  type ProxyCacheEntry,
  type ProxyCacheMap,
  type ProxyCacheRecord,
  PROXY_SYMBOL_DIRTY,
} from './types.mjs';

// @internal
export default function findExistingProxy(
  base: object,
  id: string | undefined,
  fragmentMap: FragmentMap,
  proxyCacheMap: ProxyCacheMap,
  proxyCacheRecords: ProxyCacheRecord[],
  revokedProxyRecords: RevokedProxyRecords,
  selectionSets: readonly SelectionSetNode[],
  variablesString: string,
  index?: number,
  noGrow?: false
): [
  proxyCacheRecord: ProxyCacheRecord,
  proxyCacheEntry: ProxyCacheEntry,
  proxyCacheMap: ProxyCacheMap,
  recordIndex: number,
];
// @internal
export default function findExistingProxy(
  base: object | undefined,
  id: string | undefined,
  fragmentMap: FragmentMap,
  proxyCacheMap: ProxyCacheMap,
  proxyCacheRecords: ProxyCacheRecord[],
  revokedProxyRecords: RevokedProxyRecords,
  selectionSets: readonly SelectionSetNode[],
  variablesString: string,
  index: number,
  noGrow: true
):
  | [
      proxyCacheRecord: ProxyCacheRecord,
      proxyCacheEntry: ProxyCacheEntry,
      proxyCacheMap: ProxyCacheMap,
      recordIndex: number,
    ]
  | undefined;
// @internal
export default function findExistingProxy(
  base: object | undefined,
  id: string | undefined,
  fragmentMap: FragmentMap,
  proxyCacheMap: ProxyCacheMap,
  proxyCacheRecords: ProxyCacheRecord[],
  revokedProxyRecords: RevokedProxyRecords,
  selectionSets: readonly SelectionSetNode[],
  variablesString: string,
  index = 0,
  noGrow?: boolean
):
  | [
      proxyCacheRecord: ProxyCacheRecord,
      proxyCacheEntry: ProxyCacheEntry,
      proxyCacheMap: ProxyCacheMap,
      recordIndex: number,
    ]
  | undefined {
  const currentSelectionSet = selectionSets[index]!;
  const entry = proxyCacheMap.get(currentSelectionSet);
  if (!entry) {
    if (noGrow) {
      return undefined;
    }
    const newEntry: ProxyCacheEntry = {
      __proto__: null,
      id,
      r: [],
      fm: fragmentMap,
    };
    proxyCacheMap.set(currentSelectionSet, newEntry);
    if (index < selectionSets.length - 1) {
      const subMap: ProxyCacheMap = new Map();
      newEntry.sm = subMap;
      return findExistingProxy(
        base!,
        id,
        fragmentMap,
        subMap,
        proxyCacheRecords,
        revokedProxyRecords,
        selectionSets,
        variablesString,
        index + 1
      );
    } else {
      const newRecord: ProxyCacheRecord = [
        variablesString,
        base!,
        undefined,
        Date.now(),
      ];
      newEntry.r[0] = newRecord;
      proxyCacheRecords.push(newRecord);
      return [newRecord, newEntry, proxyCacheMap, 0];
    }
  }

  if (index < selectionSets.length - 1) {
    let subMap = entry.sm;
    if (!subMap) {
      entry.sm = subMap = new Map();
    }
    return findExistingProxy(
      base!,
      id,
      fragmentMap,
      subMap,
      proxyCacheRecords,
      revokedProxyRecords,
      selectionSets,
      variablesString,
      index + 1,
      noGrow as false | undefined
    );
  }

  const records = entry.r;
  for (let i = records.length - 1; i >= 0; --i) {
    const record = records[i]!;
    if (base && record[1] !== base) {
      continue;
    }
    if (record[0] === variablesString) {
      const p = record[2];
      if (p && p[PROXY_SYMBOL_DIRTY]) {
        revokedProxyRecords.push([record, records]);
      } else {
        if (!noGrow) {
          record[3] = Date.now();
        }
        return [record, entry, proxyCacheMap, i];
      }
    }
  }

  if (noGrow) {
    return undefined;
  }

  const newRecord: ProxyCacheRecord = [
    variablesString,
    base!,
    undefined,
    Date.now(),
  ];
  const i = records.push(newRecord) - 1;
  proxyCacheRecords.push(newRecord);
  return [newRecord, entry, proxyCacheMap, i];
}
