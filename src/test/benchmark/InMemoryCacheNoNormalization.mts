import { ApolloCache, InMemoryCache } from '@apollo/client';
import type { Config } from './addTasks.mjs';

export const config: Config = {
  name: 'InMemoryCache(no normalization)',
  makeCache: (): ApolloCache<unknown> => {
    return new InMemoryCache({
      typePolicies: {
        __All: {
          keyFields: false,
          merge: false,
        },
      },
      possibleTypes: {
        __All: ['.*'],
      },
    });
  },
};
