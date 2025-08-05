export interface LocationType {
  id: number;
}

export interface PrefectureType extends LocationType {
  __typename: 'Prefecture';
  id: number;
  name: string;
}

export interface CityType extends LocationType {
  __typename: 'City';
  id: number;
  name: string;
  prefecture: PrefectureType;
}

export interface TagType {
  __typename: 'Tag';
  name: string;
}

export interface PersonType {
  __typename: 'Person';
  id: number;
  name: string;
  sha256: string;
  tags: ReadonlyArray<Readonly<TagType>>;
  address?: Readonly<LocationType> | null;
}

export interface PersonSimpleType {
  __typename: 'Person';
  id: number;
  name: string;
  sha256: string;
  address?: Readonly<LocationType> | null;
}

export interface PersonVariablesType {
  id: number;
}

export interface LocationVariablesType {
  id: number;
}

export interface QueryType {
  __typename: 'Query';
  persons: ReadonlyArray<Readonly<PersonType>>;
  person: Readonly<PersonType> | null;
  locations: ReadonlyArray<Readonly<LocationType>>;
  location: Readonly<LocationType> | null;
  locationNames: readonly string[];
}

export interface PersonInputType {
  id: number;
  name?: string | null;
  sha256?: string | null;
}

export interface ChangePersonVariablesType {
  input: PersonInputType;
}

export interface ChangePersonOnlyVariablesType {
  input: PersonInputType;
}

export interface MutationType {
  __typename: 'Mutation';
  changePerson: Readonly<PersonType> | null;
  changePersonOnly: string | null;
}
