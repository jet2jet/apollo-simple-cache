import { before, beforeEach, mock } from 'node:test';
import * as ApolloClientRoot from '@apollo/client-v4';
import * as ApolloClientCache from '@apollo/client-v4/cache';
import * as ApolloClientDev from '@apollo/client-v4/dev';
import * as ApolloClientUtilities from '@apollo/client-v4/utilities';
import { JSDOM } from 'jsdom';
import { resetPersonData } from '#test-common/data/simpleSchemas.mts';

// JSDOM環境の初期化
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');

// Adds messages only in a dev environment
ApolloClientDev.loadDevMessages();
ApolloClientDev.loadErrorMessages();

before(() => {
  // グローバルスコープへの展開
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.window = dom.window as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.document = dom.window.document as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.navigator = dom.window.navigator as any;

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

beforeEach(() => {
  resetPersonData();
});
