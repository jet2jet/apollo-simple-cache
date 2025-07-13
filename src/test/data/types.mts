export interface LocationType {
  __typename: 'Location';
  id: number;
  name: string;
}

export interface PersonType {
  __typename: 'Person';
  id: number;
  name: string;
  sha256: string;
  address?: LocationType | null;
}

export interface PersonSimpleType {
  __typename: 'Person';
  id: number;
  name: string;
  sha256: string;
  address?: LocationType | null;
}

export interface PersonInputType {
  id: number;
}

export interface LocationInputType {
  id: number;
}

export interface QueryType {
  __typename: 'Query';
  persons: readonly PersonType[];
  person: PersonType | null;
  locations: readonly LocationType[];
  location: LocationType | null;
}
