import equal from '../../utilities/equal.mjs';
import hasOwn from '../../utilities/hasOwn.mjs';
import type { ChangedFields, ChangedFieldsArray } from '../internalTypes.mjs';
import isProxyObject from './isProxyObject.mjs';
import {
  PROXY_SYMBOL_GET_EFFECTIVE_ARGUMENTS,
  PROXY_SYMBOL_REVOKED,
  PROXY_SYMBOL_TARGET,
  type ProxyCacheMap,
  type ProxyCacheRecord,
} from './types.mjs';

function releaseProxyFromField(
  proxy: object,
  field: ChangedFields,
  index: number
) {
  if (proxy instanceof Array) {
    for (const o of proxy) {
      if (o != null && typeof o === 'object') {
        releaseProxyFromField(o, field, index);
      }
    }
  }
  if (!isProxyObject(proxy)) {
    return;
  }

  const target = proxy[PROXY_SYMBOL_TARGET];

  if (index >= field.length) {
    // Only enumerates cached keys
    for (const key of Object.keys(target)) {
      const o = (target as Record<string, unknown>)[key];
      if (o != null && typeof o === 'object') {
        releaseProxyFromField(o, field, index + 1);
      }
    }
    proxy[PROXY_SYMBOL_REVOKED] = true;
    return;
  }

  const f = field[index]!;
  const name = typeof f === 'string' ? f : f[0];
  const args = typeof f === 'string' ? undefined : f[1];

  if (!hasOwn(target, name)) {
    return;
  }

  if (args) {
    const proxyArgs = proxy[PROXY_SYMBOL_GET_EFFECTIVE_ARGUMENTS](name);
    if (!equal(args, proxyArgs)) {
      return;
    }
  }

  const o = (target as Record<string, unknown>)[name];
  if (o != null && typeof o === 'object') {
    releaseProxyFromField(o, field, index + 1);
  }
}

function releaseProxyRecordsImpl(
  proxyCacheMap: ProxyCacheMap,
  proxyCacheRecords: ProxyCacheRecord[],
  field: ChangedFields,
  id: string
) {
  for (const [, entry] of proxyCacheMap) {
    if (entry.id !== id) {
      continue;
    }
    for (let i = entry.r.length - 1; i >= 0; --i) {
      const record = entry.r[i]!;
      const proxy = record[2];
      if (!proxy) {
        continue;
      }
      releaseProxyFromField(proxy, field, 1);
      if (proxy[PROXY_SYMBOL_REVOKED]) {
        entry.r.splice(i, 1);
        const j = proxyCacheRecords.indexOf(record);
        if (j >= 0) {
          proxyCacheRecords.splice(j, 1);
        }
      }
    }
    if (entry.sm) {
      releaseProxyRecordsImpl(entry.sm, proxyCacheRecords, field, id);
    }
  }
}

// @internal
export default function releaseProxyRecords(
  proxyCacheMap: ProxyCacheMap,
  proxyCacheRecords: ProxyCacheRecord[],
  rootFields: ChangedFieldsArray,
  idFields: ChangedFieldsArray
): void {
  for (const field of rootFields) {
    if (field.length === 1) {
      continue;
    }
    releaseProxyRecordsImpl(proxyCacheMap, proxyCacheRecords, field, field[0]);
  }
  for (const field of idFields) {
    if (field.length === 1) {
      continue;
    }
    releaseProxyRecordsImpl(proxyCacheMap, proxyCacheRecords, field, field[0]);
  }
}
