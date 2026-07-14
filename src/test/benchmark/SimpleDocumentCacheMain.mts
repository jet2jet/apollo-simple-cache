import type { ApolloCache } from '@apollo/client';
import type { Config } from './addTasks.mts';
import SimpleDocumentCache from '#main-v3/SimpleDocumentCache/index.mts';

export const config: Config = {
  name: 'SimpleDocumentCache',
  makeCache: (): ApolloCache<unknown> => {
    return new SimpleDocumentCache();
  },
};
