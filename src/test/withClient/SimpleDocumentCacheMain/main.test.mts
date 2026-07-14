import { describe } from 'node:test';
import { registerTests } from '../common/tests.mts';
import SimpleDocumentCache from '#main-v3/SimpleDocumentCache/index.mts';

void describe('withClient:SimpleDocumentCache', () => {
  registerTests(() => new SimpleDocumentCache(), 'document');
});
