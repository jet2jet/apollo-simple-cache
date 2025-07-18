import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLID,
  GraphQLNonNull,
  GraphQLString,
  GraphQLList,
  type GraphQLFieldConfig,
  GraphQLInterfaceType,
} from 'graphql';
import { locationsData, personsData } from './dummyData.mjs';
import type { LocationType, PersonType, QueryType } from './types.mjs';

const LocationType = new GraphQLInterfaceType({
  name: 'Location',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
  },
});

const PrefectureType = new GraphQLObjectType({
  name: 'Prefecture',
  interfaces: [LocationType],
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
  },
});

// @ts-expect-error: currently unused
const CityType = new GraphQLObjectType({
  name: 'City',
  interfaces: [LocationType],
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    prefecture: { type: new GraphQLNonNull(PrefectureType) },
  },
});

const TagType = new GraphQLObjectType({
  name: 'Tag',
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const PersonType = new GraphQLObjectType({
  name: 'Person',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    sha256: { type: new GraphQLNonNull(GraphQLString) },
    tags: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TagType))),
    },
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
    locationNames: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(GraphQLString))
      ),
      resolve: (): readonly string[] => {
        return locationsData
          .map((l) => ('name' in l ? (l.name as string) : null))
          .filter((x) => x != null);
      },
    },
  } satisfies Record<
    Exclude<keyof QueryType, '__typename'>,
    GraphQLFieldConfig<unknown, unknown>
  >,
});

export const schema = new GraphQLSchema({ query: QueryType });
