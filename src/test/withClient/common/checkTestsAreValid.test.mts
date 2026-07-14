import { describe } from 'node:test';
import { InMemoryCache } from '@apollo/client';
import { registerTests } from './tests.mts';
import { possibleTypes } from '#test-common/data/simpleQueries.mts';

void describe('withClient:check tests for document cache', () => {
  registerTests(
    () =>
      new InMemoryCache({
        typePolicies: {
          __All: {
            keyFields: false,
            merge: false,
          },
        },
        possibleTypes: {
          __All: ['.*'],
        },
      }),
    'no-normalized'
  );
});

void describe('withClient:check tests for normalized cache', () => {
  registerTests(() => new InMemoryCache(), 'normalized');
});

void describe('withClient:check tests for normalized cache with possibleTypes', () => {
  registerTests(() => new InMemoryCache({ possibleTypes }), 'normalized');
});
