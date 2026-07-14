import assert from 'node:assert/strict';

/** This unwraps Proxy object */
export function isDeepStrictEqualWithUnwrapProxy(
  actual: unknown,
  expected: unknown
): boolean {
  if (actual == null) {
    return expected == null;
  } else if (expected == null) {
    return false;
  }
  if (typeof actual !== 'object') {
    if (typeof expected === 'object') {
      return false;
    }
    return actual === expected;
  }
  const keysExpected = Object.keys(expected);
  const keysActual = Object.keys(actual);
  if (keysActual.length !== keysExpected.length) {
    return false;
  }
  if (
    keysExpected.reduce(
      (prev, key) => prev.filter((k) => k !== key),
      keysActual
    ).length !== 0
  ) {
    return false;
  }
  for (const key in expected) {
    if (Object.prototype.hasOwnProperty.call(expected, key)) {
      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        return false;
      }
      if (
        !isDeepStrictEqualWithUnwrapProxy(
          actual[key as keyof typeof actual],
          expected[key as keyof typeof expected]
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

export function assertDeepEqualWithUnwrapProxy<T extends object>(
  actual: T | null | undefined,
  expected: Partial<T>,
  message?: string
): void;
export function assertDeepEqualWithUnwrapProxy(
  actual: unknown,
  expected: unknown,
  message?: string
): void;

export function assertDeepEqualWithUnwrapProxy(
  actual: unknown,
  expected: unknown,
  message?: string
): void {
  if (!isDeepStrictEqualWithUnwrapProxy(actual, expected)) {
    assert.fail(
      message ||
        `Expected actual object to match subset ${JSON.stringify(expected)} (actual: ${JSON.stringify(actual)})`
    );
  }
}

export function isPartialDeepStrictEqualWithUnwrapProxy(
  actual: unknown,
  expected: unknown
): boolean {
  if (actual == null) {
    return expected == null;
  } else if (expected == null) {
    return false;
  }
  if (typeof actual !== 'object') {
    if (typeof expected === 'object') {
      return false;
    }
    return actual === expected;
  }
  for (const key in expected) {
    if (Object.prototype.hasOwnProperty.call(expected, key)) {
      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        return false;
      }
      if (
        !isPartialDeepStrictEqualWithUnwrapProxy(
          actual[key as keyof typeof actual],
          expected[key as keyof typeof expected]
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

export function assertPartialEqual<T extends object>(
  actual: T | null | undefined,
  expected: Partial<T>,
  message?: string
): void;
export function assertPartialEqual(
  actual: unknown,
  expected: object,
  message?: string
): void;

export function assertPartialEqual(
  actual: unknown,
  expected: object,
  message?: string
): void {
  if (!isPartialDeepStrictEqualWithUnwrapProxy(actual, expected)) {
    assert.fail(
      message ||
        `Expected actual object to match subset ${JSON.stringify(expected)} (actual: ${JSON.stringify(actual)})`
    );
  }
}
