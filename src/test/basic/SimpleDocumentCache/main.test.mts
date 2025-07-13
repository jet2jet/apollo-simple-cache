import { personsData } from '../../data/dummyData.mjs';
import {
  PersonDocument,
  PersonSimpleDocument,
} from '../../data/simpleQueries.mjs';
import { registerTests } from '../common/basicTests.mjs';
import SimpleDocumentCache from '@/SimpleDocumentCache/index.mjs';

registerTests(() => new SimpleDocumentCache(), 'document');

test('will not return complete data even if data with larger query is stored (for limitation of SimpleDocumentCache)', () => {
  const cache = new SimpleDocumentCache();

  const personDocument = cache.transformDocument(
    PersonDocument
  ) as typeof PersonDocument;
  const personSimpleDocument = cache.transformDocument(
    PersonSimpleDocument
  ) as typeof PersonSimpleDocument;

  const person = personsData[0]!;
  cache.writeQuery({
    query: personDocument,
    variables: { id: person.id },
    data: {
      __typename: 'Query',
      person,
    },
  });

  const q = cache.readQuery({
    query: personSimpleDocument,
    variables: { id: person.id },
  });
  expect(q).toBeNull();
});
