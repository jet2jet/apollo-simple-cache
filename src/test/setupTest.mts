import { createRequire } from 'node:module';
import { before, beforeEach, mock } from 'node:test';
import { loadErrorMessages, loadDevMessages } from '@apollo/client/dev';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);

// JSDOM環境の初期化
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');

// Adds messages only in a dev environment
loadDevMessages();
loadErrorMessages();

before(() => {
  // グローバルスコープへの展開
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.window = dom.window as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.document = dom.window.document as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.navigator = dom.window.navigator as any;

  // Register modules as mocks to use CommonJS modules as ES modules

  const ApolloClientRoot = require('@apollo/client');
  const ApolloClientCache = require('@apollo/client/cache');
  const ApolloClientUtilities = require('@apollo/client/utilities');
  const ApolloClientDev = require('@apollo/client/dev');

  mock.module('@apollo/client', {
    namedExports: ApolloClientRoot,
  });
  mock.module('@apollo/client/cache', {
    namedExports: ApolloClientCache,
  });
  // mock.module("@apollo/client/cache/core/types/common", {
  //       namedExports: await import("@apollo/client-v4/cache/core/types")
  // });
  // mock.module('@apollo/client/core', {
  //   namedExports: ApolloClientRoot,
  // });
  // mock.module('@apollo/client/react', {
  //   namedExports: ApolloClientReact,
  // });
  mock.module('@apollo/client/utilities', {
    namedExports: ApolloClientUtilities,
  });
  mock.module('@apollo/client/dev', {
    namedExports: ApolloClientDev,
  });
});

beforeEach(async () => {
  const { resetPersonData } = await import(
    '#test-common/data/simpleSchemas.mts'
  );
  resetPersonData();
});
