import {
  ApolloCache,
  ApolloClient,
  ApolloLink,
  Observable,
} from '@apollo/client-v4';
import { ApolloProvider } from '@apollo/client-v4/react';
import { graphql, print } from 'graphql';
import { createElement, type JSX, type ReactNode, useMemo } from 'react';
import { schema } from '#test-common/data/simpleSchemas.mts';

function delay(wait: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, wait));
}

function createApolloClient(cache: ApolloCache) {
  const link = new ApolloLink((operation) => {
    return new Observable((observer) => {
      void (async () => {
        const { query, operationName, variables } = operation;
        await delay(100);
        try {
          const result = await graphql({
            schema,
            source: print(query),
            variableValues: variables,
            operationName,
          });
          observer.next(result);
          observer.complete();
        } catch (err) {
          observer.error(err);
        }
      })();
    });
  });

  return new ApolloClient({
    cache,
    link,
  });
}

export function makeWrapper(
  cache: ApolloCache
): ({ children }: { children: ReactNode }) => JSX.Element {
  return ({ children }) => {
    const client = useMemo(() => createApolloClient(cache), [cache]);
    // eslint-disable-next-line react/no-children-prop
    return createElement(ApolloProvider, { client, children });
  };
}
