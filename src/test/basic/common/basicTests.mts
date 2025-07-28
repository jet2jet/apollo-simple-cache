import {
  MissingFieldError,
  type ApolloCache,
  type Cache,
  type Reference,
  type StoreObject,
} from '@apollo/client';
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
  LocationNamesDocument,
  LocationsDocument,
  PersonChunkFragment,
  PersonDocument,
  type PersonFragment,
  PersonsDocument,
  PersonSimpleDocument,
  type PersonQuery,
  type PersonsQuery,
  PersonDocumentWithFragment,
} from '../../data/simpleQueries.mjs';
import type { PersonType } from '../../data/types.mjs';

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
    const q3 = cache.readQuery({ query: locationNamesDocument });
    expect(q3).toEqual(
      expect.objectContaining({
        locationNames,
      })
    );
  });

  test('write and extract/restore query', () => {
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
      expect(() => JSON.stringify(serializedObject)).not.toThrow();
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

    fn.mockClear();

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
    expect(fn).not.toHaveBeenCalled();
    // but data is changed
    const q = cache.readQuery({ query: personsDocument });
    expect(q).toEqual(
      expect.objectContaining({
        persons: newPersonsData,
      })
    );
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

  test('will not affect list and individual query', async () => {
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

  test('modify data and receive watch callback', () => {
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

    const fn = jest.fn();
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

    expect(fn).toHaveBeenCalledWith<
      Parameters<Cache.WatchCallback<PersonQuery>>
    >(
      {
        complete: true,
        result: expect.objectContaining({
          person: { ...person, name: `Modified_${person.name}` },
        }),
      },
      undefined
    );
  });

  test('delete data and receive watch callback (returnPartialData = undefined)', () => {
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

    const fn = jest.fn();
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

    expect(fn).toHaveBeenCalledWith<
      Parameters<Cache.WatchCallback<PersonQuery>>
    >(
      {
        complete: false,
        missing: [expect.any(MissingFieldError)],
        result: expect.toBeOneOf([expect.anything(), undefined]),
      },
      undefined
    );
  });

  test('delete data and receive watch callback (returnPartialData = false)', () => {
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

    const fn = jest.fn();
    cache.watch({
      query: personDocument,
      variables: { id: person.id },
      optimistic: false,
      callback: fn,
      returnPartialData: false,
    });

    expect(() =>
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
      })
    ).toThrow(MissingFieldError);
  });

  test('delete entire data and will fail to read query (missing error)', () => {
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

    expect(() => {
      cache.diff({
        query: personDocument,
        variables: { id: person.id },
        optimistic: false,
        returnPartialData: false,
      });
    }).toThrow(MissingFieldError);
  });

  if (cacheType === 'normalized') {
    test('delete field and will fail to read query (missing error)', () => {
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
      expect(() => {
        cache.diff({
          query: personDocument,
          variables: { id: person.id },
          optimistic: false,
          returnPartialData: false,
        });
      }).toThrow(MissingFieldError);
    });

    test('evict data and receive watch callback', () => {
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

      const fn = jest.fn();
      cache.watch({
        query: personDocument,
        variables: { id: person.id },
        optimistic: false,
        callback: fn,
      });

      cache.evict({ id: cache.identify(person) });

      expect(fn).toHaveBeenCalledWith<
        Parameters<Cache.WatchCallback<PersonQuery>>
      >(
        {
          complete: false,
          missing: [expect.any(MissingFieldError)],
          result: expect.toBeOneOf([expect.anything(), undefined]),
        },
        undefined
      );
    });

    test('evict data but not receive watch callback when broadcast = false', () => {
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

      const fn = jest.fn();
      cache.watch({
        query: personDocument,
        variables: { id: person.id },
        optimistic: false,
        callback: fn,
      });

      cache.evict({ id: cache.identify(person), broadcast: false });

      expect(fn).not.toHaveBeenCalled();
    });
  }

  test('write and read query with fragment', () => {
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
    expect(q1).toEqual(
      expect.objectContaining({
        person,
      })
    );
  });

  if (cacheType === 'normalized') {
    test('write and read fragment', () => {
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
      expect(q1).toEqual<PersonFragment>({
        __typename: 'Person',
        id: person.id,
        name: person.name,
        address: person.address,
      });
    });
    test('write query and read fragment', () => {
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
      expect(q1).toEqual<PersonFragment>({
        __typename: 'Person',
        id: person.id,
        name: person.name,
        address: person.address,
      });
    });
  }
}
