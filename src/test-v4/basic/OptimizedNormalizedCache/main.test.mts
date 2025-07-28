import { jest } from '@jest/globals';
import { registerTests } from '../common/basicTests.mjs';
import { personsData } from '@/data/dummyData.mjs';
import {
  PersonDocument,
  PersonsDocument,
  possibleTypes,
} from '@/data/simpleQueries.mjs';
import OptimizedNormalizedCache from '@/OptimizedNormalizedCache/index.mjs';

describe('OptimizedNormalizedCache without possibleTypes', () => {
  registerTests(() => new OptimizedNormalizedCache(), 'normalized');
});

describe('OptimizedNormalizedCache with possibleTypes', () => {
  registerTests(
    () => new OptimizedNormalizedCache({ possibleTypes }),
    'normalized'
  );

  test('will affect individual query if optimized', () => {
    const fn = jest.fn();
    const cache = new OptimizedNormalizedCache({
      possibleTypes,
      optimizedRead: {
        Query: (fieldName, existingValue, context) => {
          if (fieldName !== 'person' && fieldName !== 'location') {
            return existingValue;
          }
          if (existingValue != null) {
            return existingValue;
          }
          const id = context.effectiveArguments?.id;
          if (id == null) {
            return undefined;
          }
          const dataId = context.dataIdFromObject({
            __typename: fieldName === 'person' ? 'Person' : 'Prefecture',
            id,
          });
          if (dataId == null) {
            return undefined;
          }
          fn(id);
          return context.readFromId(dataId);
        },
      },
    });

    const personsDocument = cache.transformDocument(
      PersonsDocument
    ) as typeof PersonsDocument;
    const personDocument = cache.transformDocument(
      PersonDocument
    ) as typeof PersonDocument;

    cache.writeQuery({
      query: personsDocument,
      data: {
        __typename: 'Query',
        persons: personsData,
      },
    });

    for (const p of personsData) {
      fn.mockClear();
      const q = cache.readQuery({
        query: personDocument,
        variables: { id: p.id },
      });
      expect(q).toEqual(
        expect.objectContaining({
          person: p,
        })
      );
      expect(fn).toHaveBeenCalledWith(p.id);
    }
  });
});
