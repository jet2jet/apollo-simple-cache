import { loadErrorMessages, loadDevMessages } from '@apollo/client/dev';
import matchers from 'jest-extended';
expect.extend(matchers);

// Adds messages only in a dev environment
loadDevMessages();
loadErrorMessages();
