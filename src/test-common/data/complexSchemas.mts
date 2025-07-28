import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLList,
  GraphQLID,
} from 'graphql';
import { dummyUsers } from './complexDummyData.mjs';

// Forward declarations for circular references
// Disable eslint rule
/* eslint-disable prefer-const */
let UserType: GraphQLObjectType;
let PostType: GraphQLObjectType;
let CommentType: GraphQLObjectType;

const AddressType = new GraphQLObjectType({
  name: 'Address',
  fields: {
    street: { type: new GraphQLNonNull(GraphQLString) },
    city: { type: new GraphQLNonNull(GraphQLString) },
    zipcode: { type: new GraphQLNonNull(GraphQLString) },
    country: { type: new GraphQLNonNull(GraphQLString) },
    state: { type: new GraphQLNonNull(GraphQLString) },
    apartment: { type: new GraphQLNonNull(GraphQLString) },
    coordinates: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const ProfileType = new GraphQLObjectType({
  name: 'Profile',
  fields: {
    bio: { type: new GraphQLNonNull(GraphQLString) },
    age: { type: new GraphQLNonNull(GraphQLInt) },
    gender: { type: new GraphQLNonNull(GraphQLString) },
    phone: { type: new GraphQLNonNull(GraphQLString) },
    email: { type: new GraphQLNonNull(GraphQLString) },
    website: { type: new GraphQLNonNull(GraphQLString) },
    twitterHandle: { type: new GraphQLNonNull(GraphQLString) },
    address: { type: new GraphQLNonNull(AddressType) },
  },
});

CommentType = new GraphQLObjectType({
  name: 'Comment',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    content: { type: new GraphQLNonNull(GraphQLString) },
    author: { type: new GraphQLNonNull(UserType) },
    timestamp: { type: new GraphQLNonNull(GraphQLString) },
    likes: { type: new GraphQLNonNull(GraphQLInt) },
  }),
});

PostType = new GraphQLObjectType({
  name: 'Post',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    title: { type: new GraphQLNonNull(GraphQLString) },
    body: { type: new GraphQLNonNull(GraphQLString) },
    summary: { type: new GraphQLNonNull(GraphQLString) },
    publishedAt: { type: new GraphQLNonNull(GraphQLString) },
    viewCount: { type: new GraphQLNonNull(GraphQLInt) },
    isFeatured: { type: new GraphQLNonNull(GraphQLString) },
    comments: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(CommentType))
      ),
    },
    author: { type: new GraphQLNonNull(UserType) },
  }),
});

UserType = new GraphQLObjectType({
  name: 'User',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    username: { type: new GraphQLNonNull(GraphQLString) },
    fullName: { type: new GraphQLNonNull(GraphQLString) },
    createdAt: { type: new GraphQLNonNull(GraphQLString) },
    lastLogin: { type: new GraphQLNonNull(GraphQLString) },
    email: { type: new GraphQLNonNull(GraphQLString) },
    phone: { type: new GraphQLNonNull(GraphQLString) },
    role: { type: new GraphQLNonNull(GraphQLString) },
    status: { type: new GraphQLNonNull(GraphQLString) },
    profile: { type: new GraphQLNonNull(ProfileType) },
    posts: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(PostType))),
    },
    comments: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(CommentType))
      ),
    },
  }),
});

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    users: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
      resolve: (): unknown => dummyUsers,
    },
    user: {
      type: new GraphQLNonNull(UserType),
      args: {
        id: {
          type: new GraphQLNonNull(GraphQLID),
        },
      },
      resolve: (_, args: { id: number }): unknown => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return dummyUsers.find((u) => u.id === args.id) ?? null;
      },
    },
  },
});

export const schema = new GraphQLSchema({
  query: QueryType,
});
