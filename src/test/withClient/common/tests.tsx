import {
  ApolloCache,
  useApolloClient,
  useMutation,
  useQuery,
} from '@apollo/client';
import { cloneDeep } from '@apollo/client/utilities';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { makeWrapper } from './utililites.jsx';
import { personsData } from '@/data/dummyData.mjs';
import {
  ChangePersonMutationDocument,
  ChangePersonOnlyMutationDocument,
  PersonDocument,
  PersonsDocument,
  type PersonQuery,
} from '@/data/simpleQueries.mjs';
import type { PersonType } from '@/data/types.mjs';

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

  test('modify cache and re-retrieve', async () => {
    const cache = makeCache();

    const person = personsData[0]!;
    const personWithoutTypename = cloneObjectWithoutTypename(person);

    const PERSON_ID = person.id;

    interface TestStepData {
      testStep: number;
      doNextStep: () => void;
      data: PersonQuery | null;
    }

    const { result } = renderHook(
      (): TestStepData => {
        const [testStep, setTestStep] = useState(0);
        const refIsFirstOnStep = useRef(true);
        const doNextStep = useCallback(() => {
          setTestStep((prev) => prev + 1);
          refIsFirstOnStep.current = true;
        }, []);
        const client = useApolloClient();
        const r = useQuery(PersonDocument, { variables: { id: PERSON_ID } });
        const [mutate] = useMutation(ChangePersonOnlyMutationDocument);
        const [result, setResult] = useState<Exclude<
          typeof r.data,
          undefined
        > | null>(null);
        useEffect(() => {
          switch (testStep) {
            case 0:
              setResult(r.data ?? null);
              break;
            case 1: {
              if (!refIsFirstOnStep.current) {
                break;
              }
              void mutate({
                variables: {
                  input: {
                    id: PERSON_ID,
                    name: 'Hello',
                  },
                },
                update: (cache) => {
                  const id = cache.identify({
                    __typename: 'Person',
                    id: PERSON_ID,
                  });
                  if (id) {
                    cache.modify({
                      id,
                      fields: {
                        name: (_, details) => details.DELETE,
                      },
                    });
                  } else {
                    cache.modify({
                      fields: {
                        person: (value: unknown, details) => {
                          if (
                            !value ||
                            (value as PersonType).id !== PERSON_ID
                          ) {
                            return value;
                          }
                          // Mark as deleted for entire entity
                          return details.DELETE;
                        },
                      },
                    });
                  }
                },
              });
              setResult(r.data ?? null);
              break;
            }
            case 2:
              setResult(r.data ?? null);
              break;
          }
          refIsFirstOnStep.current = false;
        }, [client, r.data, testStep]);
        return {
          testStep,
          doNextStep,
          data: result,
        };
      },
      {
        wrapper: makeWrapper(cache),
      }
    );

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    act(() => {
      result.current.doNextStep();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(
        expect.objectContaining({
          person: expect.toBeOneOf([person, personWithoutTypename]),
        })
      );
    });

    act(() => {
      result.current.doNextStep();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(
        expect.objectContaining({
          person: expect.toBeOneOf([
            { ...person, name: 'Hello' },
            { ...personWithoutTypename, name: 'Hello' },
          ]),
        })
      );
    });
  });
}
