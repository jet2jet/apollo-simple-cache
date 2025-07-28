import type { ApolloCache } from '@apollo/client';
import type { Config } from './addTasks.mjs';
import SimpleDocumentCache from '@/SimpleDocumentCache/index.mjs';

export const config: Config = {
  name: 'SimpleDocumentCache',
  makeCache: (): ApolloCache => {
    return new SimpleDocumentCache();
  },
};
