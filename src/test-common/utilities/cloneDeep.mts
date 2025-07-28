export default function cloneDeep<T>(value: T): T {
  return __cloneDeep(value, new WeakMap());

  function __cloneDeep<T>(value: T, seen: WeakMap<object, object>): T {
    if (typeof value !== 'object' || !value) {
      return value;
    }
    const seenData = seen.get(value);
    if (seenData) {
      return seenData as T;
    }
    if (value instanceof Array) {
      const r: unknown[] = [];
      seen.set(value, r);
      for (let i = 0, l = value.length; i < l; ++i) {
        r[i] = __cloneDeep(value[i], seen);
      }
      return r as T;
    } else {
      const r: Record<string | symbol, unknown> = {};
      seen.set(value, r);
      for (const k of (
        Object.getOwnPropertyNames(value) as Array<string | symbol>
      ).concat(Object.getOwnPropertySymbols(value))) {
        r[k] = __cloneDeep(
          (value as Record<string | symbol, unknown>)[k],
          seen
        );
      }
      return r as T;
    }
  }
}
