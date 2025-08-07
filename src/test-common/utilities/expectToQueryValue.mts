function adjustExpectedObject(actual: unknown, expected: unknown): unknown {
  if (typeof expected !== 'object' || !expected) {
    return expected;
  }
  if (typeof actual !== 'object' || !actual) {
    return expected;
  }
  if (expected instanceof Array) {
    if (!(actual instanceof Array)) {
      return expected;
    }
    return expected.map((x, i) => adjustExpectedObject(actual[i], x));
  }
  const obj: Record<string, unknown> = { __proto__: null };
  if ('__dirty' in actual) {
    obj.__dirty = (actual as Record<string, unknown>).__dirty;
  }
  if ('__typename' in actual) {
    obj.__typename = (actual as Record<string, unknown>).__typename;
  }
  for (const key in expected) {
    if (key === '__typename') {
      if (!('__typename' in actual)) {
        continue;
      }
    }
    obj[key] = adjustExpectedObject(
      (actual as Record<string, unknown>)[key],
      (expected as Record<string, unknown>)[key]
    );
  }
  return obj;
}

type AcceptableQueryValue<T> =
  T extends ReadonlyArray<infer R>
    ? ReadonlyArray<AcceptableQueryValue<R>>
    : T extends object
      ? {
          readonly [P in Exclude<keyof T, '__typename'>]?:
            | AcceptableQueryValue<T[P]>
            | null
            | undefined;
        } & ('__typename' extends keyof T
          ? { readonly __typename?: string }
          : unknown)
      : T;

/**
 * Utility function to check if actual object is the form of expected object, considering `__typename`.
 * - If `expected` has `__typename`, `actual`'s `__typename` will be checked. Otherwise, `__typename` is ignored.
 * - `actual`'s `__dirty` field is ignored.
 */
export default function expectToQueryValue<T>(
  actual: AcceptableQueryValue<T> | null | undefined,
  expected: AcceptableQueryValue<T> | null | undefined
): void {
  expect(actual).toEqual(adjustExpectedObject(actual, expected));
}
