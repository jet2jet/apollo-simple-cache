import * as crypto from 'crypto';
import { DUMMY_ADDRESSES, DUMMY_NAMES } from './dummyDataList.mjs';
import type { LocationType, PersonType } from './types.mjs';

export const personsData: readonly PersonType[] = DUMMY_NAMES.map((name, i) => {
  const j = i % DUMMY_ADDRESSES.length;
  return {
    __typename: 'Person',
    id: i,
    name,
    sha256: crypto.hash('sha256', `${i}:${name}`, 'base64'),
    address: { __typename: 'Location', id: j, name: DUMMY_ADDRESSES[j]! },
  };
});

export const locationsData: readonly LocationType[] = DUMMY_ADDRESSES.map(
  (name, i) => {
    return {
      __typename: 'Location',
      id: i,
      name,
    };
  }
);
