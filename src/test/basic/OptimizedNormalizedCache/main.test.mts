import { personsData } from '../../data/dummyData.mjs';
import { PersonDocument, PersonsDocument } from '../../data/simpleQueries.mjs';
import { registerTests } from '../common/basicTests.mjs';
import OptimizedNormalizedCache from '@/OptimizedNormalizedCache/index.mjs';

registerTests(() => new OptimizedNormalizedCache(), 'normalized');

test('will affect individual query if optimized', () => {
  const cache = new OptimizedNormalizedCache({
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
          __typename: fieldName === 'person' ? 'Person' : 'Location',
          id,
        });
        if (dataId == null) {
          return undefined;
        }
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
    const q = cache.readQuery({
      query: personDocument,
      variables: { id: p.id },
    });
    expect(q).toEqual(
      expect.objectContaining({
        person: p,
      })
    );
  }
});
