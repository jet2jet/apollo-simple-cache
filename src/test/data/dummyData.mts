import * as crypto from 'crypto';
import { DUMMY_ADDRESSES, DUMMY_NAMES } from './dummyDataList.mjs';
import type {
  CityType,
  LocationType,
  PersonType,
  PrefectureType,
} from './types.mjs';

const prefecturesData: ReadonlyArray<Readonly<PrefectureType>> =
  DUMMY_ADDRESSES.map((name, i) => {
    return {
      __typename: 'Prefecture',
      id: i,
      name,
    };
  });

export const citiesData: ReadonlyArray<Readonly<CityType>> = [
  {
    __typename: 'City',
    id: 1001,
    name: '札幌',
    prefecture: prefecturesData.find((p) => p.name === '北海道')!,
  },
  {
    __typename: 'City',
    id: 2001,
    name: '青森',
    prefecture: prefecturesData.find((p) => p.name === '青森')!,
  },
  {
    __typename: 'City',
    id: 14001,
    name: '横浜',
    prefecture: prefecturesData.find((p) => p.name === '神奈川')!,
  },
];

export const locationsData: ReadonlyArray<Readonly<LocationType>> = (
  [] as ReadonlyArray<Readonly<LocationType>>
)
  .concat(prefecturesData)
  .concat(citiesData);

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
      address:
        i === 0
          ? citiesData[0]
          : { __typename: 'Prefecture', id: j, name: DUMMY_ADDRESSES[j]! },
    };
  }
);
