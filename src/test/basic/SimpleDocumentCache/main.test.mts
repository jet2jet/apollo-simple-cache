import assert from 'node:assert';
import test, { describe } from 'node:test';
import { registerTests } from '../common/basicTests.mts';
import SimpleDocumentCache from '#main-v3/SimpleDocumentCache/index.mts';
import { personsData } from '#test-common/data/dummyData.mts';
import {
  PersonDocument,
  PersonSimpleDocument,
} from '#test-common/data/simpleQueries.mts';

void describe('basic:SimpleDocumentCache', () => {
  registerTests(() => new SimpleDocumentCache(), 'document');

  void test('will not return complete data even if data with larger query is stored (for limitation of SimpleDocumentCache)', () => {
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
    assert.equal(q, null);
  });
});
