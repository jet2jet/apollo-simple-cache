import type { Cache } from '@apollo/client';
import { jest } from '@jest/globals';
import { registerTests } from '../common/basicTests.mjs';
import { personsData } from '@/data/dummyData.mjs';
import {
  PersonDocument,
  PersonsDocument,
  PersonSimple2Document,
  PersonSimpleDocument,
  possibleTypes,
  type PersonSimpleQuery,
} from '@/data/simpleQueries.mjs';
import OptimizedNormalizedCache from '@/OptimizedNormalizedCache/index.mjs';
import expectToQueryValue from '@/utilities/expectToQueryValue.mjs';

describe('OptimizedNormalizedCache without possibleTypes', () => {
  registerTests(() => new OptimizedNormalizedCache(), 'normalized');

  test('will not affect queries on same field', () => {
    const cache = new OptimizedNormalizedCache();
    const personSimpleDocument = cache.transformDocument(
      PersonSimpleDocument
    ) as typeof PersonSimpleDocument;
    const personSimple2Document = cache.transformDocument(
      PersonSimple2Document
    ) as typeof PersonSimple2Document;

    const personData = personsData[0]!;
    const PERSON_ID = personData.id;

    const fnCallbackPersonSimple =
      jest.fn<Cache.WatchCallback<PersonSimpleQuery>>();

    cache.watch({
      query: personSimpleDocument,
      variables: { id: PERSON_ID },
      optimistic: false,
      returnPartialData: true,
      callback: fnCallbackPersonSimple,
    });

    expect(
      cache.diff({
        query: personSimpleDocument,
        variables: { id: PERSON_ID },
        optimistic: false,
        returnPartialData: true,
      })
    ).toEqual({
      result: { __typename: 'Query' },
      complete: false,
      missing: expect.anything(),
    });

    cache.write({
      query: personSimpleDocument,
      variables: { id: PERSON_ID },
      result: {
        __typename: 'Query',
        person: {
          __typename: 'Person',
          id: PERSON_ID,
          name: personData.name,
        },
      },
    });
    expect(fnCallbackPersonSimple).toHaveBeenCalled();
    fnCallbackPersonSimple.mockClear();
    const personSimpleDiff = cache.diff({
      query: personSimpleDocument,
      variables: { id: PERSON_ID },
      optimistic: false,
      returnPartialData: true,
    });
    let person: unknown = personSimpleDiff.result?.person;

    cache.write({
      query: personSimple2Document,
      variables: { id: PERSON_ID },
      result: {
        __typename: 'Query',
        person: {
          __typename: 'Person',
          id: PERSON_ID,
          sha256: personData.sha256,
        },
      },
    });
    const personSimple2Diff = cache.diff({
      query: personSimple2Document,
      variables: { id: PERSON_ID },
      optimistic: false,
      returnPartialData: true,
    });
    person = personSimple2Diff.result?.person;
    // should not be affected by personSimple2
    expect(fnCallbackPersonSimple).not.toHaveBeenCalled();

    expectToQueryValue(personSimpleDiff.result, {
      person: {
        __typename: 'Person',
        id: PERSON_ID,
        name: personData.name,
      },
    });
    expect(personSimpleDiff.complete).toBeTrue();
    expectToQueryValue(personSimple2Diff.result, {
      person: {
        __typename: 'Person',
        id: PERSON_ID,
        sha256: personData.sha256,
      },
    });
    expect(personSimple2Diff.complete).toBeTrue();

    void person;
  });
});

describe('OptimizedNormalizedCache with possibleTypes', () => {
  registerTests(
    () => new OptimizedNormalizedCache({ possibleTypes }),
    'normalized'
  );

  test('will affect individual query if optimized', () => {
    const fn = jest.fn();
    const cache = new OptimizedNormalizedCache({
      possibleTypes,
      optimizedRead: {
        Query: (fieldName, existingValue, context) => {
          if (fieldName !== 'person' && fieldName !== 'location') {
            return existingValue;
          }
          if (existingValue != null) {
            return existingValue;
          }
          const id = context.effectiveArguments?.id;
          if (id == null) {
            return undefined;
          }
          const dataId = context.dataIdFromObject({
            __typename: fieldName === 'person' ? 'Person' : 'Prefecture',
            id,
          });
          if (dataId == null) {
            return undefined;
          }
          fn(id);
          return context.readFromId(dataId);
        },
      },
    });

    const personsDocument = cache.transformDocument(
      PersonsDocument
    ) as typeof PersonsDocument;
    const personDocument = cache.transformDocument(
      PersonDocument
    ) as typeof PersonDocument;

    cache.writeQuery({
      query: personsDocument,
      data: {
        __typename: 'Query',
        persons: personsData,
      },
    });

    for (const p of personsData) {
      fn.mockClear();
      const q = cache.readQuery({
        query: personDocument,
        variables: { id: p.id },
      });
      expectToQueryValue(q, {
        person: p,
      });
      expect(fn).toHaveBeenCalledWith(p.id);
    }
  });
});
