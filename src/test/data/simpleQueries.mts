import { gql, type TypedDocumentNode } from '@apollo/client';
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

export const PersonsDocument = gql`
  query Persons {
    persons {
      id
      name
      sha256
      address {
        id
        name
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
      address {
        id
        name
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
      name
    }
  }
` as unknown as TypedDocumentNode<LocationsQuery, never>;

export const LocationDocument = gql`
  query Location($id: ID!) {
    location(id: $id) {
      id
      name
    }
  }
` as unknown as TypedDocumentNode<LocationQuery, LocationInputType>;
