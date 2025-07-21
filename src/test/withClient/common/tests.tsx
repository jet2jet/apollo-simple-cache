import {
  ApolloCache,
  useApolloClient,
  useMutation,
  useQuery,
} from '@apollo/client';
import { cloneDeep } from '@apollo/client/utilities';
import { renderHook, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { personsData } from '../../data/dummyData.mjs';
import {
  ChangePersonMutationDocument,
  PersonDocument,
  PersonsDocument,
} from '../../data/simpleQueries.mjs';
import { makeWrapper } from './utililites.jsx';

function cloneObjectWithoutTypename<T>(value: Readonly<T>): T;
function cloneObjectWithoutTypename<T>(value: T): T;

function cloneObjectWithoutTypename<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Array) {
    return value.map((x): unknown => cloneObjectWithoutTypename(x)) as T;
  }
  const newObj: T = {} as T;
  for (const key of Object.getOwnPropertyNames(value)) {
    if (key === '__typename') {
      continue;
    }
    (newObj as Record<string, unknown>)[key] = cloneObjectWithoutTypename(
      (value as Record<string, unknown>)[key]
    );
  }
  return newObj;
}

export function registerTests(
  makeCache: () => ApolloCache<unknown>,
  _cacheType: 'normalized' | 'document' | 'no-normalized'
): void {
  test('read query', async () => {
    const cache = makeCache();

    const personsWithoutTypename = cloneObjectWithoutTypename(personsData);

    const { result } = renderHook(
      () => {
        const r = useQuery(PersonsDocument);
        return r.data ?? null;
      },
      {
        wrapper: makeWrapper(cache),
      }
    );

    await waitFor(() => {
      expect(result.current).toEqual(
        expect.objectContaining({
          persons: expect.toBeOneOf([personsData, personsWithoutTypename]),
        })
      );
    });
  });

  test('execute mutation with update data', async () => {
    const cache = makeCache();

    const person = personsData[0]!;
    const personWithoutTypename = cloneObjectWithoutTypename(person);

    const PERSON_ID = person.id;

    const { result } = renderHook(
      () => {
        const refResults = useRef<object[]>([]);
        const refMutated = useRef(false);
        const client = useApolloClient();
        const r = useQuery(PersonDocument, { variables: { id: PERSON_ID } });
        const [mutate] = useMutation(ChangePersonMutationDocument);
        useEffect(() => {
          if (r.data) {
            refResults.current.push(cloneDeep(r.data.person!));
          }
        }, [r.data]);
        useEffect(() => {
          if (r.loading) {
            return;
          }
          if (refMutated.current) {
            return;
          }
          refMutated.current = true;
          void mutate({
            variables: {
              input: {
                id: PERSON_ID,
                name: 'Hello',
              },
            },
            onCompleted: (data) => {
              client.writeQuery({
                query: PersonDocument,
                data: {
                  __typename: 'Query',
                  person: data.changePerson,
                },
                variables: {
                  id: data.changePerson?.id ?? -1,
                },
              });
            },
          });
        }, [client, mutate, r.loading]);
        return refResults.current;
      },
      {
        wrapper: makeWrapper(cache),
      }
    );

    await waitFor(() => {
      expect(result.current).toEqual(
        expect.toBeOneOf([
          [person, { ...person, name: 'Hello' }],
          [personWithoutTypename, { ...personWithoutTypename, name: 'Hello' }],
        ])
      );
    });
  });
}
