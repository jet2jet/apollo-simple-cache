import { InMemoryCache } from '@apollo/client';
import { possibleTypes } from '../../data/simpleQueries.mjs';
import { registerTests } from './tests.jsx';

describe('check tests for document cache', () => {
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

describe('check tests for normalized cache', () => {
  registerTests(() => new InMemoryCache(), 'normalized');
});

describe('check tests for normalized cache with possibleTypes', () => {
  registerTests(() => new InMemoryCache({ possibleTypes }), 'normalized');
});
