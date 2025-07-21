import { loadErrorMessages, loadDevMessages } from '@apollo/client/dev';
import matchers from 'jest-extended';
import { resetPersonData } from './data/simpleSchemas.mjs';

expect.extend(matchers);

// Adds messages only in a dev environment
loadDevMessages();
loadErrorMessages();

beforeEach(() => {
  resetPersonData();
});
