// import * as path from 'path';
// import { fileURLToPath } from 'url';
import { createDefaultEsmPreset } from 'ts-jest';

// const thisDir = fileURLToPath(new URL('.', import.meta.url));

const presetConfig = createDefaultEsmPreset({
  tsconfig: 'src/test/tsconfig.json',
  diagnostics: {
    ignoreCodes: ['TS151001'],
  },
});

export default {
  ...presetConfig,
  clearMocks: true,
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/test/**/*.test.mts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTest.mts'],
  moduleNameMapper: {
    '^@/(.*)\\.mjs$': '<rootDir>/src/main/$1',
    '^@/(.*)$': '<rootDir>/src/main/$1',
    '(.+)\\.mjs': '$1',
    '(.+)\\.jsx': '$1',
  },
  globals: {
    __DEV__: true,
  },
};
