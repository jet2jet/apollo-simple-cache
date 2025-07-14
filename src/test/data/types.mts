export interface LocationType {
  __typename: 'Location';
  id: number;
  name: string;
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

export interface PersonInputType {
  id: number;
}

export interface LocationInputType {
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
