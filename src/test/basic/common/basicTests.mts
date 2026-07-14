import assert from 'node:assert';
import { mock, test } from 'node:test';
import {
  MissingFieldError,
  type ApolloCache,
  type Cache,
  type Reference,
  type StoreObject,
} from '@apollo/client';
import {
  dummyGetAllUsersData,
  dummyGetUserByIdData,
  dummyGetUserPostsData,
} from '#test-common/data/complexDummyData.mts';
import {
  GetAllUsersDocument,
  GetUserByIdDocument,
  GetUserPostsDocument,
} from '#test-common/data/complexQueries.mts';
import {
  citiesData,
  locationsData,
  personsData,
} from '#test-common/data/dummyData.mts';
import {
  LocationNamesDocument,
  LocationsDocument,
  PersonChunkFragment,
  PersonDocument,
  PersonsDocument,
  PersonSimpleDocument,
  type PersonQuery,
  type PersonsQuery,
  PersonDocumentWithFragment,
  LocationSimpleDocument,
  LocationSimple2Document,
} from '#test-common/data/simpleQueries.mts';
import type { PersonType } from '#test-common/data/types.mts';
import {
  assertPartialEqual,
  isPartialDeepStrictEqualWithUnwrapProxy,
} from '#test-common/utilities/asserts.mts';
import cloneDeep from '#test-common/utilities/cloneDeep.mts';
import expectToQueryValue from '#test-common/utilities/expectToQueryValue.mts';

export function registerTests(
  makeCache: () => ApolloCache<unknown>,
  cacheType: 'normalized' | 'document' | 'no-normalized'
): void {
  void test('write and read query', () => {
    const cache = makeCache();

    const personsDocument = cache.transformDocument(
      PersonsDocument
    ) as typeof PersonsDocument;
    const locationsDocument = cache.transformDocument(
      LocationsDocument
    ) as typeof LocationsDocument;
    const locationNamesDocument = cache.transformDocument(
      LocationNamesDocument
    ) as typeof LocationNamesDocument;

    const locationNames = locationsData
      .map((l) => ('name' in l ? (l.name as string) : null))
      .filter((x) => x != null);

    cache.writeQuery({
      query: personsDocument,
      data: {
        __typename: 'Query',
        persons: personsData,
      },
    });
    cache.writeQuery({
      query: locationsDocument,
      data: {
        __typename: 'Query',
        locations: locationsData,
      },
    });
    cache.writeQuery({
      query: locationNamesDocument,
      data: {
        __typename: 'Query',
        locationNames,
      },
    });

    const q1 = cache.readQuery({ query: personsDocument });
    expectToQueryValue(
      q1,
      {
        persons: personsData,
      },
      personsDocument
    );
    const q2 = cache.readQuery({ query: locationsDocument });
    expectToQueryValue(
      q2,
      {
        locations: locationsData,
      },
      locationsDocument
    );
    const q3 = cache.readQuery({ query: locationNamesDocument });
    expectToQueryValue(
      q3,
      {
        locationNames,
      },
      locationNamesDocument
    );
  });

  void test('write and extract/restore query', () => {
    let serializedObject: unknown;
    {
      const cache = makeCache();

      const personsDocument = cache.transformDocument(
        PersonsDocument
      ) as typeof PersonsDocument;
      const locationsDocument = cache.transformDocument(
        LocationsDocument
      ) as typeof LocationsDocument;

      cache.writeQuery({
        query: personsDocument,
        data: {
          __typename: 'Query',
          persons: personsData,
        },
      });
      cache.writeQuery({
        query: locationsDocument,
        data: {
          __typename: 'Query',
          locations: locationsData,
        },
      });

      serializedObject = cache.extract();

      // Extracted data must be stringify-able
      assert.doesNotThrow(() => JSON.stringify(serializedObject));
    }
    serializedObject = JSON.parse(JSON.stringify(serializedObject));
    {
      const cache = makeCache();

      const personsDocument = cache.transformDocument(
        PersonsDocument
      ) as typeof PersonsDocument;
      const locationsDocument = cache.transformDocument(
        LocationsDocument
      ) as typeof LocationsDocument;

      cache.restore(serializedObject);

      const q1 = cache.readQuery({ query: personsDocument });
      expectToQueryValue(
        q1,
        {
          persons: personsData,
        },
        personsDocument
      );
      const q2 = cache.readQuery({ query: locationsDocument });
      expectToQueryValue(
        q2,
        {
          locations: locationsData,
        },
        locationsDocument
      );
    }
  });

  void test('write and read query with only variable differences', () => {
    const cache = makeCache();

    const personDocument = cache.transformDocument(
      PersonDocument
    ) as typeof PersonDocument;

    for (const p of personsData) {
      cache.writeQuery({
        query: personDocument,
        variables: { id: p.id },
        data: {
          __typename: 'Query',
          person: p,
        },
      });
    }

    // data will be written for each variables individually
    for (const p of personsData) {
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
    }
  });

  if (cacheType === 'normalized') {
    void test('write and read query with only field differences', () => {
      const cache = makeCache();

      const locationSimpleDocument = cache.transformDocument(
        LocationSimpleDocument
      ) as typeof LocationSimpleDocument;
      const locationSimple2Document = cache.transformDocument(
        LocationSimple2Document
      ) as typeof LocationSimple2Document;

      const locationData = citiesData[0]!;
      const LOCATION_ID = locationData.id;

      const diff1 = cache.diff({
        query: locationSimpleDocument,
        variables: { id: LOCATION_ID },
        optimistic: false,
      });
      assert.ok(!diff1.complete);

      cache.writeQuery({
        query: locationSimpleDocument,
        variables: { id: LOCATION_ID },
        data: {
          __typename: 'Query',
          location: {
            __typename: locationData.__typename,
            id: LOCATION_ID,
            name: locationData.name,
          },
        },
      });

      const diff2 = cache.diff({
        query: locationSimple2Document,
        variables: { id: LOCATION_ID },
        optimistic: false,
      });
      assert.ok(!diff2.complete);

      cache.writeQuery({
        query: locationSimple2Document,
        variables: { id: LOCATION_ID },
        data: {
          __typename: 'Query',
          location: {
            __typename: locationData.__typename,
            id: LOCATION_ID,
            prefecture: locationData.prefecture,
          },
        },
      });

      expectToQueryValue(
        cache.readQuery({
          query: locationSimpleDocument,
          variables: { id: LOCATION_ID },
        }),
        {
          location: {
            __typename: locationData.__typename,
            id: LOCATION_ID,
            name: locationData.name,
          },
        },
        locationSimpleDocument
      );
      expectToQueryValue(
        cache.readQuery({
          query: locationSimple2Document,
          variables: { id: LOCATION_ID },
        }),
        {
          location: {
            __typename: locationData.__typename,
            id: LOCATION_ID,
            prefecture: locationData.prefecture,
          },
        },
        locationSimple2Document
      );
    });
  }

  void test('watch and write query', () => {
    const fn = mock.fn<Cache.WatchCallback<PersonsQuery>>();
    const cache = makeCache();

    const personsDocument = cache.transformDocument(
      PersonsDocument
    ) as typeof PersonsDocument;

    cache.watch({ query: personsDocument, optimistic: false, callback: fn });

    cache.writeQuery({
      query: personsDocument,
      data: {
        __typename: 'Query',
        persons: personsData,
      },
    });

    assert.ok(
      fn.mock.calls.some((call) =>
        isPartialDeepStrictEqualWithUnwrapProxy(call.arguments, [
          {
            complete: true,
            result: {
              persons: personsData,
            },
          },
          undefined,
        ])
      )
    );

    fn.mock.resetCalls();

    // If same data is written, watcher callback will not be called
    cache.writeQuery({
      query: personsDocument,
      data: {
        __typename: 'Query',
        persons: personsData,
      },
    });
    assert.equal(fn.mock.callCount(), 0);

    fn.mock.resetCalls();

    // If broadcast = false, watcher callback will not be called
    const newPersonsData = personsData.map((p) => ({
      ...p,
      name: p.name + '_mod',
    }));
    cache.writeQuery({
      query: personsDocument,
      data: {
        __typename: 'Query',
        persons: newPersonsData,
      },
      broadcast: false,
    });
    assert.equal(fn.mock.callCount(), 0);
    // but data is changed
    const q = cache.readQuery({ query: personsDocument });
    expectToQueryValue(
      q,
      {
        persons: newPersonsData,
      },
      personsDocument
    );
  });

  void test('watch and write query with transaction', () => {
    const fn = mock.fn();
    const cache = makeCache();

    const personsDocument = cache.transformDocument(
      PersonsDocument
    ) as typeof PersonsDocument;

    cache.watch({ query: personsDocument, optimistic: false, callback: fn });

    cache.performTransaction((cache) => {
      cache.writeQuery({
        query: personsDocument,
        data: {
          __typename: 'Query',
          persons: personsData,
        },
      });

      // During transaction, watcher would not be called
      assert.equal(fn.mock.callCount(), 0);
    });

    assert.ok(
      fn.mock.calls.some((call) =>
        isPartialDeepStrictEqualWithUnwrapProxy(call.arguments, [
          {
            complete: true,
            result: {
              persons: personsData,
            },
          },
          undefined,
        ])
      )
    );
  });

  void test('will not affect list and individual query', async () => {
    const cache = makeCache();

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
      const q = cache.readQuery({
        query: personDocument,
        variables: { id: p.id },
      });
      assert.equal(q, null);
    }

    await cache.reset();

    for (const p of personsData) {
      cache.writeQuery({
        query: personDocument,
        variables: { id: p.id },
        data: {
          __typename: 'Query',
          person: p,
        },
      });
    }

    const q = cache.readQuery({ query: personsDocument });
    assert.equal(q, null);
  });

  if (cacheType !== 'no-normalized') {
    void test('write and read complex query including circular reference [1]', () => {
      const cache = makeCache();

      const getUserByIdDocument = cache.transformDocument(GetUserByIdDocument);

      cache.writeQuery({
        query: getUserByIdDocument,
        data: {
          __typename: 'Query',
          ...dummyGetUserByIdData,
        },
        variables: { id: 1 },
      });

      const q1 = cache.readQuery({
        query: getUserByIdDocument,
        variables: { id: 1 },
      });
      expectToQueryValue(q1, dummyGetUserByIdData, getUserByIdDocument);
    });
    void test('write and read complex query including circular reference [2]', () => {
      const cache = makeCache();

      const getUserPostsDocument =
        cache.transformDocument(GetUserPostsDocument);

      cache.writeQuery({
        query: getUserPostsDocument,
        data: {
          __typename: 'Query',
          ...dummyGetUserPostsData,
        },
        variables: { id: 1 },
      });

      const q2 = cache.readQuery({
        query: getUserPostsDocument,
        variables: { id: 1 },
      });
      expectToQueryValue(q2, dummyGetUserPostsData, getUserPostsDocument);
    });
    void test('write and read complex query including circular reference [3]', () => {
      const cache = makeCache();

      const getAllUsersDocument = cache.transformDocument(GetAllUsersDocument);

      cache.writeQuery({
        query: getAllUsersDocument,
        data: {
          __typename: 'Query',
          ...dummyGetAllUsersData,
        },
      });

      const q3 = cache.readQuery({
        query: getAllUsersDocument,
      });
      expectToQueryValue(q3, dummyGetAllUsersData, getAllUsersDocument);
    });
  }

  if (cacheType === 'normalized') {
    void test('will return complete data if data with larger query is stored', () => {
      const cache = makeCache();

      const personDocument = cache.transformDocument(
        PersonDocument
      ) as typeof PersonDocument;
      const personSimpleDocument = cache.transformDocument(
        PersonSimpleDocument
      ) as typeof PersonSimpleDocument;

      const person = personsData[0]!;
      cache.writeQuery({
        query: personDocument,
        variables: { id: person.id },
        data: {
          __typename: 'Query',
          person,
        },
      });

      const q = cache.readQuery({
        query: personSimpleDocument,
        variables: { id: person.id },
      });
      expectToQueryValue(
        q,
        {
          person: {
            __typename: person.__typename,
            id: person.id,
            name: person.name,
          },
        },
        personSimpleDocument
      );
    });
  }

  void test('modify data and receive watch callback', () => {
    const cache = makeCache();

    const personDocument = cache.transformDocument(
      PersonDocument
    ) as typeof PersonDocument;

    const person = personsData[0]!;

    cache.writeQuery({
      query: personDocument,
      variables: { id: person.id },
      data: { __typename: 'Query', person },
    });

    const fn = mock.fn<Cache.WatchCallback<PersonQuery>>();
    cache.watch({
      query: personDocument,
      variables: { id: person.id },
      optimistic: false,
      callback: fn,
    });

    const id = cache.identify({ __typename: 'Person', id: person.id });
    if (id) {
      cache.modify({
        id,
        fields: {
          name: (value: string) => {
            return `Modified_${value}`;
          },
        },
      });
    } else {
      cache.modify({
        fields: {
          person: (value: unknown) => {
            if (!value || (value as PersonType).id !== person.id) {
              return value;
            }
            const newValue = { ...(value as PersonType) };
            newValue.name = `Modified_${newValue.name}`;
            return newValue;
          },
        },
      });
    }

    assert.ok(
      fn.mock.calls.some((call) =>
        isPartialDeepStrictEqualWithUnwrapProxy(call.arguments, [
          {
            complete: true,
            result: {
              person: { ...person, name: `Modified_${person.name}` },
            },
          },
          undefined,
        ])
      )
    );
  });

  void test('delete data and receive watch callback (returnPartialData = undefined)', () => {
    const cache = makeCache();

    const personDocument = cache.transformDocument(
      PersonDocument
    ) as typeof PersonDocument;

    const person = personsData[0]!;

    cache.writeQuery({
      query: personDocument,
      variables: { id: person.id },
      data: { __typename: 'Query', person },
    });

    const fn = mock.fn<Cache.WatchCallback<PersonQuery>>();
    cache.watch({
      query: personDocument,
      variables: { id: person.id },
      optimistic: false,
      callback: fn,
    });

    cache.modify({
      fields: {
        person: (value: unknown, details) => {
          if (!value) {
            return value;
          }
          if (
            details.readField('id', value as Reference | StoreObject) ===
            person.id
          ) {
            return details.DELETE;
          }
          return value;
        },
      },
    });

    assert.ok(
      fn.mock.calls.some((call) => {
        const arg = call.arguments[0];
        if (arg == null) {
          return false;
        }
        return (
          arg.complete === false &&
          arg.missing?.length === 1 &&
          arg.missing[0] instanceof MissingFieldError
        );
      })
    );
  });

  void test('delete data and receive watch callback (returnPartialData = false)', () => {
    const cache = makeCache();

    const personDocument = cache.transformDocument(
      PersonDocument
    ) as typeof PersonDocument;

    const person = personsData[0]!;

    cache.writeQuery({
      query: personDocument,
      variables: { id: person.id },
      data: { __typename: 'Query', person },
    });

    const fn = mock.fn();
    cache.watch({
      query: personDocument,
      variables: { id: person.id },
      optimistic: false,
      callback: fn,
      returnPartialData: false,
    });

    assert.throws(
      () =>
        cache.modify({
          fields: {
            person: (value: unknown, details) => {
              if (!value) {
                return value;
              }
              if (
                details.readField('id', value as Reference | StoreObject) ===
                person.id
              ) {
                return details.DELETE;
              }
              return value;
            },
          },
        }),
      MissingFieldError
    );
  });

  void test('delete entire data and will fail to read query (missing error)', () => {
    const cache = makeCache();

    const personDocument = cache.transformDocument(
      PersonDocument
    ) as typeof PersonDocument;

    const person = personsData[0]!;

    cache.writeQuery({
      query: personDocument,
      variables: { id: person.id },
      data: { __typename: 'Query', person },
    });

    cache.modify({
      fields: {
        person: (value: unknown, details) => {
          if (!value) {
            return value;
          }
          if (
            details.readField('id', value as Reference | StoreObject) ===
            person.id
          ) {
            return details.DELETE;
          }
          return value;
        },
      },
    });

    assert.throws(() => {
      cache.diff({
        query: personDocument,
        variables: { id: person.id },
        optimistic: false,
        returnPartialData: false,
      });
    }, MissingFieldError);
  });

  if (cacheType === 'normalized') {
    void test('delete field and will fail to read query (missing error)', () => {
      const cache = makeCache();

      const personDocument = cache.transformDocument(
        PersonDocument
      ) as typeof PersonDocument;

      const person = personsData[0]!;

      cache.writeQuery({
        query: personDocument,
        variables: { id: person.id },
        data: { __typename: 'Query', person },
      });

      cache.modify({
        id: cache.identify(person),
        fields: {
          name: (_, details) => {
            return details.DELETE;
          },
        },
      });
      assert.throws(() => {
        cache.diff({
          query: personDocument,
          variables: { id: person.id },
          optimistic: false,
          returnPartialData: false,
        });
      }, MissingFieldError);
    });

    void test('should remain read data after delete field', () => {
      const cache = makeCache();

      const personDocument = cache.transformDocument(
        PersonDocument
      ) as typeof PersonDocument;

      const person = personsData[0]!;

      cache.writeQuery({
        query: personDocument,
        variables: { id: person.id },
        data: { __typename: 'Query', person },
      });

      const readData = cache.readQuery({
        query: personDocument,
        variables: { id: person.id },
      });
      cloneDeep(readData);

      cache.modify({
        id: cache.identify(person),
        fields: {
          name: (_, details) => {
            return details.DELETE;
          },
        },
      });
      expectToQueryValue(
        readData,
        { __typename: 'Query', person },
        personDocument
      );
    });

    void test('should remain read data after delete entire data', () => {
      const cache = makeCache();

      const personDocument = cache.transformDocument(
        PersonDocument
      ) as typeof PersonDocument;

      const person = personsData[0]!;

      cache.writeQuery({
        query: personDocument,
        variables: { id: person.id },
        data: { __typename: 'Query', person },
      });

      const readData = cache.readQuery({
        query: personDocument,
        variables: { id: person.id },
      });
      cloneDeep(readData);

      cache.modify({
        fields: {
          person: (value: unknown, details) => {
            if (!value) {
              return value;
            }
            if (
              details.readField('id', value as Reference | StoreObject) ===
              person.id
            ) {
              return details.DELETE;
            }
            return value;
          },
        },
      });
      cache.gc();
      expectToQueryValue(
        readData,
        { __typename: 'Query', person },
        personDocument
      );
    });

    void test('evict data and receive watch callback', () => {
      const cache = makeCache();

      const personDocument = cache.transformDocument(
        PersonDocument
      ) as typeof PersonDocument;

      const person = personsData[0]!;

      cache.writeQuery({
        query: personDocument,
        variables: { id: person.id },
        data: { __typename: 'Query', person },
      });

      const fn = mock.fn<Cache.WatchCallback<PersonQuery>>();
      cache.watch({
        query: personDocument,
        variables: { id: person.id },
        optimistic: false,
        callback: fn,
      });

      cache.evict({ id: cache.identify(person) });

      assert.ok(
        fn.mock.calls.some((call) => {
          const arg = call.arguments[0];
          if (arg == null) {
            return false;
          }
          return (
            arg.complete === false &&
            arg.missing?.length === 1 &&
            arg.missing[0] instanceof MissingFieldError
          );
        })
      );
    });

    void test('evict data but not receive watch callback when broadcast = false', () => {
      const cache = makeCache();

      const personDocument = cache.transformDocument(
        PersonDocument
      ) as typeof PersonDocument;

      const person = personsData[0]!;

      cache.writeQuery({
        query: personDocument,
        variables: { id: person.id },
        data: { __typename: 'Query', person },
      });

      const fn = mock.fn();
      cache.watch({
        query: personDocument,
        variables: { id: person.id },
        optimistic: false,
        callback: fn,
      });

      cache.evict({ id: cache.identify(person), broadcast: false });

      assert.equal(fn.mock.callCount(), 0);
    });
  }

  void test('write and read query with fragment', () => {
    const cache = makeCache();

    const personDocumentWithFragment = cache.transformDocument(
      PersonDocumentWithFragment
    ) as typeof PersonDocumentWithFragment;

    const person = personsData[0]!;

    cache.writeQuery({
      query: personDocumentWithFragment,
      data: {
        __typename: 'Query',
        person,
      },
      variables: {
        id: person.id,
      },
    });

    const q1 = cache.readQuery({
      query: personDocumentWithFragment,
      variables: {
        id: person.id,
      },
    });
    assertPartialEqual(q1, {
      person,
    });
  });

  if (cacheType === 'normalized') {
    void test('write and read fragment', () => {
      const cache = makeCache();

      const personChunkFragment = cache.transformDocument(
        PersonChunkFragment
      ) as typeof PersonChunkFragment;

      const person = personsData[0]!;

      cache.writeFragment({
        fragment: personChunkFragment,
        data: person,
      });

      const q1 = cache.readFragment({
        fragment: personChunkFragment,
        id: cache.identify(person),
      });
      assertPartialEqual(q1, {
        __typename: 'Person',
        id: person.id,
        name: person.name,
        address: person.address,
      });
    });
    void test('write query and read fragment', () => {
      const cache = makeCache();

      const personDocument = cache.transformDocument(
        PersonDocument
      ) as typeof PersonDocument;
      const personChunkFragment = cache.transformDocument(
        PersonChunkFragment
      ) as typeof PersonChunkFragment;

      const person = personsData[0]!;

      cache.writeQuery({
        query: personDocument,
        data: {
          __typename: 'Query',
          person,
        },
        variables: {
          id: person.id,
        },
      });

      const q1 = cache.readFragment({
        fragment: personChunkFragment,
        id: cache.identify(person),
      });
      assertPartialEqual(q1, {
        __typename: 'Person',
        id: person.id,
        name: person.name,
        address: person.address,
      });
    });
  }
}
