import { ApolloCache, InMemoryCache } from '@apollo/client';
import type { Config } from './addTasks.mjs';

export const config: Config = {
  name: 'InMemoryCache(default)',
  makeCache: (): ApolloCache => {
    return new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            // for simple schema
            person: (existing, options): unknown => {
              if (existing != null) {
                return existing;
              }
              const id = options.args?.id;
              if (id == null) {
                return undefined;
              }
              return options.toReference({ __typename: 'Person', id });
            },
            location: (existing, options): unknown => {
              if (existing != null) {
                return existing;
              }
              const id = options.args?.id;
              if (id == null) {
                return undefined;
              }
              return options.toReference({ __typename: 'Location', id });
            },
            // for complex schema
            user: (existing, options): unknown => {
              if (existing != null) {
                return existing;
              }
              const id = options.args?.id;
              if (id == null) {
                return undefined;
              }
              return options.toReference({ __typename: 'User', id });
            },
          },
        },
      },
    });
  },
};
