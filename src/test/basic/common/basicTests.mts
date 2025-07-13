import type { ApolloCache, Cache } from '@apollo/client';
import { jest } from '@jest/globals';
import {
  dummyGetAllUsersData,
  dummyGetUserByIdData,
  dummyGetUserPostsData,
} from '../../data/complexDummyData.mjs';
import {
  GetAllUsersDocument,
  GetUserByIdDocument,
  GetUserPostsDocument,
} from '../../data/complexQueries.mjs';
import { locationsData, personsData } from '../../data/dummyData.mjs';
import {
  LocationsDocument,
  PersonDocument,
  PersonsDocument,
  PersonSimpleDocument,
  type PersonsQuery,
} from '../../data/simpleQueries.mjs';

export function registerTests(
  makeCache: () => ApolloCache<unknown>,
  cacheType: 'normalized' | 'document' | 'no-normalized'
): void {
  test('write and read query', () => {
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

    const q1 = cache.readQuery({ query: personsDocument });
    expect(q1).toEqual(
      expect.objectContaining({
        persons: personsData,
      })
    );
    const q2 = cache.readQuery({ query: locationsDocument });
    expect(q2).toEqual(
      expect.objectContaining({
        locations: locationsData,
      })
    );
  });

  test('write and extract/restore query', () => {
    let serializedObject;
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
      expect(() => JSON.stringify(serializedObject)).not.toThrow();
    }
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
      expect(q1).toEqual(
        expect.objectContaining({
          persons: personsData,
        })
      );
      const q2 = cache.readQuery({ query: locationsDocument });
      expect(q2).toEqual(
        expect.objectContaining({
          locations: locationsData,
        })
      );
    }
  });

  test('write and read query with only variable differences', () => {
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
      expect(q).toEqual(
        expect.objectContaining({
          person: p,
        })
      );
    }
  });

  test('watch and write query', () => {
    const fn = jest.fn();
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

    expect(fn).toHaveBeenCalledWith<
      Parameters<Cache.WatchCallback<PersonsQuery>>
    >(
      {
        complete: true,
        result: expect.objectContaining({
          persons: personsData,
        }),
      },
      undefined
    );

    fn.mockClear();

    // If same data is written, watcher callback will not be called
    cache.writeQuery({
      query: personsDocument,
      data: {
        __typename: 'Query',
        persons: personsData,
      },
    });
    expect(fn).not.toHaveBeenCalled();
  });

  test('watch and write query with transaction', () => {
    const fn = jest.fn();
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
      expect(fn).not.toHaveBeenCalled();
    });

    expect(fn).toHaveBeenCalledWith<
      Parameters<Cache.WatchCallback<PersonsQuery>>
    >(
      {
        complete: true,
        result: expect.objectContaining({
          persons: personsData,
        }),
      },
      undefined
    );
  });

  test('will not affect list and individual query', () => {
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
      expect(q).toBeNull();
    }

    cache.reset();

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
    expect(q).toBeNull();
  });

  if (cacheType !== 'no-normalized') {
    test('write and read complex query including circular reference', () => {
      const cache = makeCache();

      const getUserByIdDocument = cache.transformDocument(GetUserByIdDocument);
      const getUserPostsDocument =
        cache.transformDocument(GetUserPostsDocument);
      const getAllUsersDocument = cache.transformDocument(GetAllUsersDocument);

      cache.writeQuery({
        query: getUserByIdDocument,
        data: {
          __typename: 'Query',
          ...dummyGetUserByIdData,
        },
        variables: { id: 1 },
      });
      cache.writeQuery({
        query: getUserPostsDocument,
        data: {
          __typename: 'Query',
          ...dummyGetUserPostsData,
        },
        variables: { id: 1 },
      });
      cache.writeQuery({
        query: getAllUsersDocument,
        data: {
          __typename: 'Query',
          ...dummyGetAllUsersData,
        },
      });

      const q1 = cache.readQuery({
        query: getUserByIdDocument,
        variables: { id: 1 },
      });
      expect(q1).toEqual(expect.objectContaining(dummyGetUserByIdData));
      const q2 = cache.readQuery({
        query: getUserPostsDocument,
        variables: { id: 1 },
      });
      expect(q2).toEqual(expect.objectContaining(dummyGetUserPostsData));
      const q3 = cache.readQuery({
        query: getAllUsersDocument,
      });
      expect(q3).toEqual(expect.objectContaining(dummyGetAllUsersData));
    });
  }

  if (cacheType === 'normalized') {
    test('will return complete data if data with larger query is stored', () => {
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
      expect(q).toEqual(
        expect.objectContaining({
          person: {
            __typename: person.__typename,
            id: person.id,
            name: person.name,
          },
        })
      );
    });
  }
}
