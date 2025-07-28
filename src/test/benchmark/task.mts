import { InMemoryCache, type ApolloCache } from '@apollo/client';
import {
  dummyGetAllUsersData,
  dummyGetUserByIdData,
  dummyGetUserPostsData,
} from '@/data/complexDummyData.mjs';
import {
  GetAllUsersDocument,
  GetUserByIdDocument,
  GetUserPostsDocument,
} from '@/data/complexQueries.mjs';
import { locationsData, personsData } from '@/data/dummyData.mjs';
import {
  LocationDocument,
  LocationsDocument,
  PersonDocument,
  PersonsDocument,
  PersonSimpleDocument,
} from '@/data/simpleQueries.mjs';
import { OptimizedNormalizedCache } from '@/index.mjs';
import cloneDeep from '@/utilities/cloneDeep.mjs';

export function taskReadWrite(cache: ApolloCache<unknown>): void {
  let o;
  // Read query without data
  o = cache.readQuery({ query: PersonsDocument });
  cloneDeep(o);

  // Write query
  cache.writeQuery({
    query: PersonsDocument,
    data: {
      __typename: 'Query',
      persons: personsData,
    },
  });
  // Read query with data
  o = cache.readQuery({ query: PersonsDocument });
  cloneDeep(o);

  // Write query with same data
  cache.writeQuery({
    query: PersonsDocument,
    data: {
      __typename: 'Query',
      persons: personsData,
    },
  });
  // Read query with data
  o = cache.readQuery({ query: PersonsDocument });
  cloneDeep(o);

  // Write query with different data
  cache.writeQuery({
    query: PersonsDocument,
    data: {
      __typename: 'Query',
      persons: personsData.map((p) => ({ ...p, name: p.name + '2' })),
    },
  });
  // Read query with data
  o = cache.readQuery({ query: PersonsDocument });
  cloneDeep(o);

  // Write another query
  cache.writeQuery({
    query: LocationsDocument,
    data: {
      __typename: 'Query',
      locations: locationsData,
    },
  });
  // Read query with data
  o = cache.readQuery({ query: LocationsDocument });
  cloneDeep(o);
}

export function taskReadSameQuery(cache: ApolloCache<unknown>): void {
  // Write query
  cache.writeQuery({
    query: PersonsDocument,
    data: {
      __typename: 'Query',
      persons: personsData,
    },
  });

  for (let i = 0; i < 20; ++i) {
    // Read query with data
    const o = cache.readQuery({ query: PersonsDocument });
    cloneDeep(o);
  }
}

export function taskReadSameQueryWithGc(cache: ApolloCache<unknown>): void {
  // Write query
  cache.writeQuery({
    query: PersonsDocument,
    data: {
      __typename: 'Query',
      persons: personsData,
    },
  });

  for (let i = 0; i < 20; ++i) {
    if (
      cache instanceof InMemoryCache ||
      cache instanceof OptimizedNormalizedCache
    ) {
      cache.gc({ resetResultCache: true });
    } else {
      cache.gc();
    }
    // Read query with data
    const o = cache.readQuery({ query: PersonsDocument });
    cloneDeep(o);
  }
}

export function taskReadSimilarQuery(cache: ApolloCache<unknown>): void {
  // Write query
  cache.writeQuery({
    query: PersonsDocument,
    data: {
      __typename: 'Query',
      persons: personsData,
    },
  });

  for (const p of personsData) {
    // Read query with data
    const o = cache.readQuery({
      query: PersonDocument,
      variables: { id: p.id },
    });
    cloneDeep(o);
  }

  for (const p of personsData) {
    // Read query with data
    const o = cache.readQuery({
      query: PersonSimpleDocument,
      variables: { id: p.id },
    });
    cloneDeep(o);
  }
}

export function taskWriteEntireAndWriteIndividual(
  cache: ApolloCache<unknown>
): void {
  // Write query
  cache.writeQuery({
    query: PersonsDocument,
    data: {
      __typename: 'Query',
      persons: personsData,
    },
  });

  for (const p of personsData) {
    // Write individual data
    cache.writeQuery({
      query: PersonDocument,
      data: {
        __typename: 'Query',
        person: p,
      },
      variables: { id: p.id },
    });
  }
}

export function taskWriteReadEntireAndWriteReadIndividual(
  cache: ApolloCache<unknown>
): void {
  let o;

  // Write query
  cache.writeQuery({
    query: PersonsDocument,
    data: {
      __typename: 'Query',
      persons: personsData,
    },
  });
  // Read query with data
  o = cache.readQuery({ query: PersonsDocument });
  cloneDeep(o);

  for (const p of personsData) {
    // Write individual data
    cache.writeQuery({
      query: PersonDocument,
      data: {
        __typename: 'Query',
        person: p,
      },
      variables: { id: p.id },
    });
    // Read query with data
    o = cache.readQuery({ query: PersonDocument, variables: { id: p.id } });
    cloneDeep(o);
  }
}

export function taskWriteEntireAndWriteAndReadIndividual(
  cache: ApolloCache<unknown>
): void {
  // Write query
  cache.writeQuery({
    query: PersonsDocument,
    data: {
      __typename: 'Query',
      persons: personsData,
    },
  });
  for (const p of personsData) {
    // Write individual data
    cache.writeQuery({
      query: PersonDocument,
      data: {
        __typename: 'Query',
        person: p,
      },
      variables: { id: p.id },
    });
  }
  cache.writeQuery({
    query: LocationsDocument,
    data: {
      __typename: 'Query',
      locations: locationsData,
    },
  });

  for (const p of personsData) {
    // Read query with data
    const o = cache.readQuery({
      query: PersonDocument,
      variables: { id: p.id },
    });
    cloneDeep(o);
  }

  for (const l of locationsData) {
    // Read query with data
    const o = cache.readQuery({
      query: LocationDocument,
      variables: { id: l.id },
    });
    cloneDeep(o);
  }
}

export function taskWriteComplexData(cache: ApolloCache<unknown>): void {
  // Write query
  cache.writeQuery({
    query: GetUserByIdDocument,
    data: {
      __typename: 'Query',
      ...dummyGetUserByIdData,
    },
    variables: { id: 1 },
  });
  cache.writeQuery({
    query: GetUserPostsDocument,
    data: {
      __typename: 'Query',
      ...dummyGetUserPostsData,
    },
    variables: { id: 1 },
  });
  cache.writeQuery({
    query: GetAllUsersDocument,
    data: {
      __typename: 'Query',
      ...dummyGetAllUsersData,
    },
  });

  let o;

  o = cache.readQuery({
    query: GetUserByIdDocument,
    variables: { id: 1 },
  });
  cloneDeep(o);

  o = cache.readQuery({
    query: GetUserByIdDocument,
    variables: { id: 2 },
  });
  cloneDeep(o);

  o = cache.readQuery({
    query: GetUserByIdDocument,
    variables: { id: 3 },
  });
  cloneDeep(o);
}
