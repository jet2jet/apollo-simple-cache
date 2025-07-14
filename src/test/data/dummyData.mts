import * as crypto from 'crypto';
import { DUMMY_ADDRESSES, DUMMY_NAMES } from './dummyDataList.mjs';
import type { LocationType, PersonType } from './types.mjs';

export const personsData: ReadonlyArray<Readonly<PersonType>> = DUMMY_NAMES.map(
  (name, i) => {
    const j = i % DUMMY_ADDRESSES.length;
    return {
      __typename: 'Person',
      id: i,
      name,
      sha256: crypto.hash('sha256', `${i}:${name}`, 'base64'),
      tags: [
        { __typename: 'Tag', name: 'a' },
        { __typename: 'Tag', name: 'b' },
        { __typename: 'Tag', name: 'c' },
      ],
      address: { __typename: 'Location', id: j, name: DUMMY_ADDRESSES[j]! },
    };
  }
);

export const locationsData: ReadonlyArray<Readonly<LocationType>> =
  DUMMY_ADDRESSES.map((name, i) => {
    return {
      __typename: 'Location',
      id: i,
      name,
    };
  });
