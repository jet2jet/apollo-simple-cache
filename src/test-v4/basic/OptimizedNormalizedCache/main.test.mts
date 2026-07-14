import assert from 'node:assert';
import { describe, mock, test } from 'node:test';
import type { Cache } from '@apollo/client';
import { registerTests } from '../common/basicTests.mts';
import OptimizedNormalizedCache from '#main-v4/OptimizedNormalizedCache/index.mts';
import { personsData } from '#test-common/data/dummyData.mts';
import {
  PersonDocument,
  PersonsDocument,
  PersonSimple2Document,
  PersonSimpleDocument,
  possibleTypes,
  type PersonSimpleQuery,
} from '#test-common/data/simpleQueries.mts';
import type { PersonType } from '#test-common/data/types.mts';
import {
  assertDeepEqualWithUnwrapProxy,
  assertPartialEqual,
} from '#test-common/utilities/asserts.mts';
import expectToQueryValue from '#test-common/utilities/expectToQueryValue.mts';

void describe('basic:OptimizedNormalizedCache without possibleTypes', () => {
  registerTests(() => new OptimizedNormalizedCache(), 'normalized');

  void test('will not affect queries on same field', () => {
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
      mock.fn<Cache.WatchCallback<PersonSimpleQuery>>();

    cache.watch({
      query: personSimpleDocument,
      variables: { id: PERSON_ID },
      optimistic: false,
      returnPartialData: true,
      callback: fnCallbackPersonSimple,
    });

    assertPartialEqual(
      cache.diff({
        query: personSimpleDocument,
        variables: { id: PERSON_ID },
        optimistic: false,
        returnPartialData: true,
      }),
      {
        result: { __typename: 'Query' },
        complete: false,
        // missing: anything,
      }
    );

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
    assert.ok(fnCallbackPersonSimple.mock.callCount() >= 1);
    fnCallbackPersonSimple.mock.resetCalls();
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
    assert.ok(fnCallbackPersonSimple.mock.callCount() === 0);

    expectToQueryValue(
      personSimpleDiff.result,
      {
        person: {
          __typename: 'Person',
          id: PERSON_ID,
          name: personData.name,
        },
      },
      personSimpleDocument
    );
    assert.equal(personSimpleDiff.complete, true);
    expectToQueryValue(
      personSimple2Diff.result,
      {
        person: {
          __typename: 'Person',
          id: PERSON_ID,
          sha256: personData.sha256,
        },
      },
      personSimple2Document
    );
    assert.equal(personSimple2Diff.complete, true);

    void person;
  });

  void test("will invalidate parent object if the field is marked as 'DELETE'", () => {
    const cache = new OptimizedNormalizedCache();
    const personDocument = cache.transformDocument(
      PersonDocument
    ) as typeof PersonDocument;

    const personData = personsData[0]! as {
      [P in keyof PersonType]-?: NonNullable<PersonType[P]>;
    };
    const PERSON_ID = personData.id;

    cache.write({
      query: personDocument,
      variables: { id: PERSON_ID },
      result: {
        __typename: 'Query',
        person: {
          __typename: 'Person',
          id: PERSON_ID,
          name: personData.name,
          sha256: personData.sha256,
          tags: personData.tags,
          address: personData.address,
        },
      },
    });

    // pick data
    const data = cache.read({
      query: personDocument,
      variables: { id: PERSON_ID },
      optimistic: false,
    });
    const storedPerson = data?.person;
    assertDeepEqualWithUnwrapProxy(storedPerson, personData);

    // modify
    const id = cache.identify({ __typename: 'Person', id: PERSON_ID });
    cache.modify<{ person: typeof personData }>({
      id,
      fields: (value, details) => {
        if (details.fieldName !== 'address') {
          return value;
        }
        return details.DELETE;
      },
    });

    // new instance should be returned
    const r = cache.diff({
      query: personDocument,
      variables: { id: PERSON_ID },
      optimistic: false,
      returnPartialData: true,
    });
    assert.equal(r.complete, false);
    assert.notDeepEqual(r.result, storedPerson);

    // old instance can still be accessed
    assertDeepEqualWithUnwrapProxy(storedPerson?.address, personData.address);
  });
});

void describe('basic:OptimizedNormalizedCache with possibleTypes', () => {
  registerTests(
    () => new OptimizedNormalizedCache({ possibleTypes }),
    'normalized'
  );

  void test('will affect individual query if optimized', () => {
    const fn = mock.fn();
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
      fn.mock.resetCalls();
      const q = cache.readQuery({
        query: personDocument,
        variables: { id: p.id },
      });
      expectToQueryValue(
        q,
        {
          person: p,
        },
        personDocument
      );
      assert.ok(fn.mock.callCount() >= 1);
      assert.deepEqual(fn.mock.calls[0]!.arguments, [p.id]);
    }
  });
});
