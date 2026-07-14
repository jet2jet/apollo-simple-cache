import { InMemoryCache, type ApolloCache } from '@apollo/client';
import { OptimizedNormalizedCache } from '#main-v4/index.mts';
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
import { locationsData, personsData } from '#test-common/data/dummyData.mts';
import {
  LocationDocument,
  LocationsDocument,
  PersonDocument,
  PersonsDocument,
  PersonSimpleDocument,
} from '#test-common/data/simpleQueries.mts';
import cloneDeep from '#test-common/utilities/cloneDeep.mts';

export function taskReadWrite(cache: ApolloCache): void {
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

export function taskReadSameQuery(cache: ApolloCache): void {
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

export function taskReadSameQueryWithGc(cache: ApolloCache): void {
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

export function taskReadSimilarQuery(cache: ApolloCache): void {
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

export function taskWriteEntireAndWriteIndividual(cache: ApolloCache): void {
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
  cache: ApolloCache
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
  cache: ApolloCache
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

export function taskWriteComplexData(cache: ApolloCache): void {
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
