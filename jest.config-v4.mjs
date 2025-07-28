// import * as path from 'path';
// import { fileURLToPath } from 'url';
import { createDefaultEsmPreset } from 'ts-jest';

// const thisDir = fileURLToPath(new URL('.', import.meta.url));

const presetConfig = createDefaultEsmPreset({
  tsconfig: 'src/test-v4/tsconfig.json',
  diagnostics: {
    ignoreCodes: ['TS151001'],
  },
});

export default {
  ...presetConfig,
  clearMocks: true,
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/test-v4/**/*.test.mts'],
  setupFilesAfterEnv: ['<rootDir>/src/test-v4/setupTest.mts'],
  moduleNameMapper: {
    '^@apollo/client$':
      '<rootDir>/node_modules/@apollo/client-v4/__cjs/core/index.cjs',
    '^@apollo/client/(.*)$':
      '<rootDir>/node_modules/@apollo/client-v4/__cjs/$1',
    '^@/(.*)\\.mjs$': [
      '<rootDir>/src/main-v4/$1',
      '<rootDir>/src/test-common/$1',
    ],
    '^@/(.*)$': ['<rootDir>/src/main-v4/$1', '<rootDir>/src/test-common/$1'],
    '(.+)\\.mjs': '$1',
    '(.+)\\.jsx': '$1',
  },
  globals: {
    __DEV__: true,
  },
};
