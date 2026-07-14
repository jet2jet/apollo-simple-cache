import { describe } from 'node:test';
import { registerTests } from '../common/tests.mts';
import OptimizedNormalizedCache from '#main-v3/OptimizedNormalizedCache/index.mts';
import { possibleTypes } from '#test-common/data/simpleQueries.mts';

void describe('withClient:OptimizedNormalizedCache without possibleTypes', () => {
  registerTests(() => new OptimizedNormalizedCache(), 'normalized');
});

void describe('withClient:OptimizedNormalizedCache with possibleTypes', () => {
  registerTests(
    () => new OptimizedNormalizedCache({ possibleTypes }),
    'normalized'
  );
});
