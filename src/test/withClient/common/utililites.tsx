import {
  ApolloCache,
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  Observable,
} from '@apollo/client';
import { graphql, print } from 'graphql';
import { type JSX, type ReactNode, useMemo } from 'react';
import { schema } from '@/data/simpleSchemas.mjs';

function delay(wait: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, wait));
}

function createApolloClient(cache: ApolloCache<unknown>) {
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
  cache: ApolloCache<unknown>
): ({ children }: { children: ReactNode }) => JSX.Element {
  return ({ children }) => {
    const client = useMemo(() => createApolloClient(cache), [cache]);
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}
