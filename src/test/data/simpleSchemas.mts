import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLID,
  GraphQLNonNull,
  GraphQLString,
  GraphQLList,
  type GraphQLFieldConfig,
} from 'graphql';
import { locationsData, personsData } from './dummyData.mjs';
import type { LocationType, PersonType, QueryType } from './types.mjs';

const LocationType = new GraphQLObjectType({
  name: 'Location',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const PersonType = new GraphQLObjectType({
  name: 'Person',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    sha256: { type: new GraphQLNonNull(GraphQLString) },
    address: { type: LocationType },
  },
});

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    persons: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PersonType))),
      resolve: (): readonly PersonType[] => personsData,
    },
    person: {
      type: PersonType,
      args: {
        id: {
          type: new GraphQLNonNull(GraphQLID),
        },
      },
      resolve: (_, args: { id: number }): PersonType | null => {
        const i = isNaN(Number(args.id)) ? -1 : Number(args.id);
        if (i < 0 || i >= personsData.length) {
          return null;
        }
        return personsData[i]!;
      },
    },
    locations: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(LocationType))
      ),
      resolve: (): readonly LocationType[] => locationsData,
    },
    location: {
      type: LocationType,
      args: {
        id: {
          type: new GraphQLNonNull(GraphQLID),
        },
      },
      resolve: (_, args: { id: number }): LocationType | null => {
        const i = isNaN(Number(args.id)) ? -1 : Number(args.id);
        if (i < 0 || i >= locationsData.length) {
          return null;
        }
        return locationsData[i]!;
      },
    },
  } satisfies Record<
    Exclude<keyof QueryType, '__typename'>,
    GraphQLFieldConfig<unknown, unknown>
  >,
});

export const schema = new GraphQLSchema({ query: QueryType });
