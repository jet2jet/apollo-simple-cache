import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLString,
  GraphQLList,
  type GraphQLFieldConfig,
  GraphQLInterfaceType,
  type GraphQLNamedType,
  GraphQLInputObjectType,
} from 'graphql';
import cloneDeep from '../utilities/cloneDeep.mjs';
import { locationsData, personsData } from './dummyData.mjs';
import type {
  LocationType,
  PersonInputType,
  PersonType,
  QueryType,
} from './types.mjs';

const LocationType = new GraphQLInterfaceType({
  name: 'Location',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
  },
});

const PrefectureType = new GraphQLObjectType({
  name: 'Prefecture',
  interfaces: [LocationType],
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
    name: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const CityType = new GraphQLObjectType({
  name: 'City',
  interfaces: [LocationType],
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
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
    id: { type: new GraphQLNonNull(GraphQLInt) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    sha256: { type: new GraphQLNonNull(GraphQLString) },
    tags: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TagType))),
    },
    address: { type: LocationType },
  },
});

let mutablePersonsData: PersonType[];

export function resetPersonData(): void {
  mutablePersonsData = cloneDeep(personsData) as PersonType[];
}

resetPersonData();

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    persons: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PersonType))),
      resolve: (): readonly PersonType[] => mutablePersonsData,
    },
    person: {
      type: PersonType,
      args: {
        id: {
          type: new GraphQLNonNull(GraphQLInt),
        },
      },
      resolve: (_, args: { id: number }): PersonType | null => {
        const i = isNaN(Number(args.id)) ? -1 : Number(args.id);
        const p = mutablePersonsData.find((p) => p.id === i);
        return p || null;
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
          type: new GraphQLNonNull(GraphQLInt),
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

const PersonInputType = new GraphQLInputObjectType({
  name: 'PersonInput',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLInt) },
    name: { type: GraphQLString },
    sha256: { type: GraphQLString },
  },
});

const MutationType = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    changePerson: {
      type: PersonType,
      args: {
        input: {
          type: new GraphQLNonNull(PersonInputType),
        },
      },
      resolve: (_, args: { input: PersonInputType }): PersonType | null => {
        const i = isNaN(Number(args.input.id)) ? -1 : Number(args.input.id);
        const p = mutablePersonsData.find((p) => p.id === i);
        if (!p) {
          return null;
        }
        if (args.input.name != null) {
          p.name = args.input.name;
        }
        if (args.input.sha256 != null) {
          p.sha256 = args.input.sha256;
        }
        return p;
      },
    },
  },
});

const types: GraphQLNamedType[] = [
  LocationType,
  PrefectureType,
  CityType,
  TagType,
  PersonType,
  QueryType,
  PersonInputType,
  MutationType,
];

export const schema = new GraphQLSchema({
  query: QueryType,
  mutation: MutationType,
  types,
});
