import type { DocumentNode } from 'graphql';
import type {
  FragmentMap,
  SelectionTuple,
} from '@/OptimizedNormalizedCache/internalTypes.mjs';
import getCachedSelections from '@/OptimizedNormalizedCache/utilities/getCachedSelections.mjs';
import getMainDefinition from '@/utilities/getMainDefinition.mjs';

function adjustExpectedObject(
  actual: unknown,
  expected: unknown,
  selections: readonly SelectionTuple[],
  fragmentMap: FragmentMap
): unknown {
  if (typeof expected !== 'object' || !expected) {
    return expected;
  }
  if (expected instanceof Array) {
    if (!(actual instanceof Array) || actual.length !== expected.length) {
      return expected.map((x) =>
        adjustExpectedObject(undefined, x, selections, fragmentMap)
      );
    } else {
      return expected.map((x, i) =>
        adjustExpectedObject(actual[i], x, selections, fragmentMap)
      );
    }
  }
  const obj: Record<string, unknown> = { __proto__: null };
  const thisTypename =
    (expected as Record<string, string>).__typename ||
    (typeof actual === 'object' && actual
      ? (actual as Record<string, string>).__typename
      : undefined);
  for (const sel of selections) {
    const key = sel[0];
    if (thisTypename != null && sel[2] && sel[2] !== thisTypename) {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(expected, key)) {
      if (
        typeof actual === 'object' &&
        actual != null &&
        Object.prototype.hasOwnProperty.call(actual, key)
      ) {
        obj[key] = (actual as Record<string, unknown>)[key];
      }
    } else {
      const actualValue =
        typeof actual === 'object' && actual != null
          ? (actual as Record<string, unknown>)[key]
          : undefined;
      if (sel[1].selectionSet) {
        obj[key] = adjustExpectedObject(
          actualValue,
          (expected as Record<string, unknown>)[key],
          getCachedSelections(sel[1].selectionSet, fragmentMap),
          fragmentMap
        );
      } else {
        obj[key] = (expected as Record<string, unknown>)[key];
      }
    }
  }
  if (typeof actual === 'object' && actual && '__typename' in actual) {
    obj.__typename = (actual as Record<string, unknown>).__typename;
  }
  if (typeof actual === 'object' && actual && '__dirty' in actual) {
    obj.__dirty = (actual as Record<string, unknown>).__dirty;
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
  expected: AcceptableQueryValue<T> | null | undefined,
  document: DocumentNode,
  fragmentMap: FragmentMap = {}
): void {
  const mainDefinition = getMainDefinition(document);
  expect(actual).toEqual(
    adjustExpectedObject(
      actual,
      expected,
      getCachedSelections(mainDefinition.selectionSet, fragmentMap),
      fragmentMap
    )
  );
}
