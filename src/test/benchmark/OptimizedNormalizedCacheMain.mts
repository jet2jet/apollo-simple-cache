import type { ApolloCache } from '@apollo/client';
import type { Config } from './addTasks.mjs';
import OptimizedNormalizedCache from '@/OptimizedNormalizedCache/index.mjs';

export const config: Config = {
  name: 'OptimizedNormalizedCache',
  makeCache: (): ApolloCache<unknown> => {
    return new OptimizedNormalizedCache({
      optimizedRead: {
        Query: (fieldName, existingValue, context) => {
          // for simple schema
          if (fieldName === 'person' || fieldName === 'location') {
            if (existingValue != null) {
              return existingValue;
            }
            const id = context.effectiveArguments?.id;
            if (id == null) {
              return undefined;
            }
            const dataId = context.dataIdFromObject({
              __typename: fieldName === 'person' ? 'Person' : 'Location',
              id,
            });
            if (dataId == null) {
              return undefined;
            }
            return context.readFromId(dataId);
          }
          // for complex schema
          else if (fieldName === 'user') {
            if (existingValue != null) {
              return existingValue;
            }
            const id = context.effectiveArguments?.id;
            if (id == null) {
              return undefined;
            }
            const dataId = context.dataIdFromObject({
              __typename: 'User',
              id,
            });
            if (dataId == null) {
              return undefined;
            }
            return context.readFromId(dataId);
          }
          return existingValue;
        },
      },
    });
  },
};
