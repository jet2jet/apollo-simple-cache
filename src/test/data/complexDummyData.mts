/* eslint-disable @typescript-eslint/no-explicit-any */

export const dummyUsers: any[] = [];
const dummyPosts: any[] = [];
const dummyComments: any[] = [];

for (let i = 0; i < 10; i++) {
  const user = {
    id: i + 1,
    username: `user${i + 1}`,
    fullName: `User ${i + 1}`,
    createdAt: '2025-01-01T12:00:00Z',
    lastLogin: '2025-07-13T09:00:00Z',
    email: `user${i + 1}@example.com`,
    phone: `123-456-78${90 + i}`,
    role: 'member',
    status: 'active',
    profile: {
      bio: `Bio of user ${i + 1}`,
      age: 25 + i,
      gender: i % 2 === 0 ? 'male' : 'female',
      phone: `123-456-78${90 + i}`,
      email: `user${i + 1}@personal.dev`,
      website: `https://user${i + 1}.dev`,
      twitterHandle: `@user${i + 1}`,
      address: {
        street: `${i + 1} GraphQL Ave`,
        city: 'Querytown',
        zipcode: `1000${i}`,
        country: 'Graphland',
        state: 'QL',
        apartment: `${i + 1}A`,
        coordinates: `35.68${i},139.69${i}`,
      },
    },
    posts: [],
    comments: [],
  };
  dummyUsers.push(user);
}

for (let i = 0; i < 20; i++) {
  const post = {
    id: 100 + i,
    title: `Post Title ${i + 1}`,
    body: `Body of post ${i + 1}`,
    summary: `Summary ${i + 1}`,
    publishedAt: '2025-06-01T09:00:00Z',
    viewCount: 1000 + i * 10,
    isFeatured: i % 2 === 0 ? 'yes' : 'no',
    comments: [],
    author: dummyUsers[i % dummyUsers.length],
  };
  dummyPosts.push(post);
  dummyUsers[i % dummyUsers.length].posts.push(post);
}

for (let i = 0; i < 30; i++) {
  const comment = {
    id: 5000 + i,
    content: `Comment ${i + 1}`,
    author: dummyUsers[i % dummyUsers.length],
    timestamp: '2025-06-02T10:00:00Z',
    likes: i * 3,
  };
  dummyComments.push(comment);
  const post = dummyPosts[i % dummyPosts.length];
  post.comments.push(comment);
  comment.author.comments.push(comment);
}

//

export const dummyGetUserByIdData = {
  user: {
    id: 1,
    username: 'user1',
    fullName: 'User 1',
    email: 'user1@example.com',
    posts: dummyUsers[0].posts.map((p: any) => ({
      id: p.id,
      title: p.title,
      __typename: 'Post',
    })),
    __typename: 'User',
  },
};

export const dummyGetUserPostsData = {
  user: {
    id: 1,
    username: 'user1',
    posts: dummyUsers[0].posts.map((post: any) => ({
      id: post.id,
      title: post.title,
      summary: post.summary,
      comments: post.comments.map((c: any) => ({
        id: c.id,
        content: c.content,
        likes: c.likes,
        author: {
          id: c.author.id,
          username: c.author.username,
          __typename: 'User',
        },
        __typename: 'Comment',
      })),
      __typename: 'Post',
    })),
    __typename: 'User',
  },
};

export const dummyGetAllUsersData = {
  users: dummyUsers.map((u: any) => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    profile: {
      bio: u.profile.bio,
      age: u.profile.age,
      gender: u.profile.gender,
      address: {
        city: u.profile.address.city,
        coordinates: u.profile.address.coordinates,
        __typename: 'Address',
      },
      __typename: 'Profile',
    },
    __typename: 'User',
  })),
};
