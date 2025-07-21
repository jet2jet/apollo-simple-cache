import { possibleTypes } from '../../data/simpleQueries.mjs';
import { registerTests } from '../common/tests.jsx';
import OptimizedNormalizedCache from '@/OptimizedNormalizedCache/index.mjs';

describe('OptimizedNormalizedCache without possibleTypes', () => {
  registerTests(() => new OptimizedNormalizedCache(), 'normalized');
});

describe('OptimizedNormalizedCache with possibleTypes', () => {
  registerTests(
    () => new OptimizedNormalizedCache({ possibleTypes }),
    'normalized'
  );
});
