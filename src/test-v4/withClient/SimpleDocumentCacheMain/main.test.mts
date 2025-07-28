import { registerTests } from '../common/tests.jsx';
import SimpleDocumentCache from '@/SimpleDocumentCache/index.mjs';

describe('SimpleDocumentCache', () => {
  registerTests(() => new SimpleDocumentCache(), 'document');
});
