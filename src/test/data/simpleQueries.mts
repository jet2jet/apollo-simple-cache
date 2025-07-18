import {
  gql,
  type PossibleTypesMap,
  type TypedDocumentNode,
} from '@apollo/client';
import type {
  LocationInputType,
  PersonInputType,
  PersonType,
  QueryType,
} from './types.mjs';

export type PersonsQuery = Pick<QueryType, '__typename' | 'persons'>;
export type PersonQuery = Pick<QueryType, '__typename' | 'person'>;
export type PersonSimpleQuery = Pick<QueryType, '__typename'> & {
  person: Pick<PersonType, '__typename' | 'id' | 'name'>;
};
export type LocationsQuery = Pick<QueryType, '__typename' | 'locations'>;
export type LocationQuery = Pick<QueryType, '__typename' | 'location'>;
export type LocationNamesQuery = Pick<
  QueryType,
  '__typename' | 'locationNames'
>;

export type PersonFragment = Pick<
  PersonType,
  '__typename' | 'id' | 'name' | 'address'
>;
export interface PersonsQueryWithFragment {
  readonly __typename: QueryType['__typename'];
  readonly persons: ReadonlyArray<
    Pick<PersonType, 'id' | 'sha256' | 'tags'> & PersonFragment
  >;
}
export interface PersonQueryWithFragment {
  readonly __typename: QueryType['__typename'];
  readonly person:
    | (Pick<PersonType, 'id' | 'sha256' | 'tags'> & PersonFragment)
    | null;
}

export const PersonsDocument = gql`
  query Persons {
    persons {
      id
      name
      sha256
      tags {
        name
      }
      address {
        id
        ... on Prefecture {
          name
        }
        ... on City {
          name
          prefecture {
            id
            name
          }
        }
      }
    }
  }
` as unknown as TypedDocumentNode<PersonsQuery, never>;

export const PersonDocument = gql`
  query Person($id: ID!) {
    person(id: $id) {
      id
      name
      sha256
      tags {
        name
      }
      address {
        id
        ... on Prefecture {
          name
        }
        ... on City {
          name
          prefecture {
            id
            name
          }
        }
      }
    }
  }
` as unknown as TypedDocumentNode<PersonQuery, PersonInputType>;

export const PersonSimpleDocument = gql`
  query PersonSimple($id: ID!) {
    person(id: $id) {
      id
      name
    }
  }
` as unknown as TypedDocumentNode<PersonSimpleQuery, PersonInputType>;

export const LocationsDocument = gql`
  query Locations {
    locations {
      id
      ... on Prefecture {
        name
      }
      ... on City {
        name
        prefecture {
          id
          name
        }
      }
    }
  }
` as unknown as TypedDocumentNode<LocationsQuery, never>;

export const LocationDocument = gql`
  query Location($id: ID!) {
    location(id: $id) {
      id
      ... on Prefecture {
        name
      }
      ... on City {
        name
        prefecture {
          id
          name
        }
      }
    }
  }
` as unknown as TypedDocumentNode<LocationQuery, LocationInputType>;

export const LocationNamesDocument = gql`
  query LocationNames {
    locationNames
  }
` as unknown as TypedDocumentNode<LocationNamesQuery, never>;

export const PersonChunkFragment = gql`
  fragment PersonChunk on Person {
    id
    name
    address {
      id
      ... on Prefecture {
        name
      }
      ... on City {
        name
        prefecture {
          id
          name
        }
      }
    }
  }
` as unknown as TypedDocumentNode<PersonFragment, never>;

export const PersonsDocumentWithFragment = gql`
  query Persons {
    persons {
      id
      sha256
      tags {
        name
      }
      ...PersonChunk
    }
  }
  ${PersonChunkFragment}
` as unknown as TypedDocumentNode<PersonsQueryWithFragment, never>;

export const PersonDocumentWithFragment = gql`
  query Person($id: ID!) {
    person(id: $id) {
      id
      sha256
      tags {
        name
      }
      ...PersonChunk
    }
  }
  ${PersonChunkFragment}
` as unknown as TypedDocumentNode<PersonQueryWithFragment, PersonInputType>;

export const possibleTypes: PossibleTypesMap = {
  Location: ['Prefecture', 'City'],
};
