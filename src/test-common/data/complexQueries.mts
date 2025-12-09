import { gql } from '@apollo/client';

export const GetUserByIdDocument = gql`
  query GetUserById($id: ID!) {
    user(id: $id) {
      id
      username
      fullName
      email
      follows {
        memo
        user {
          id
          username
          follows {
            date
          }
        }
      }
      posts {
        id
        title
      }
    }
  }
`;

export const GetUserPostsDocument = gql`
  query GetUserPosts($id: Int!) {
    user(id: $id) {
      id
      username
      posts {
        id
        title
        summary
        comments {
          id
          content
          likes
          author {
            id
            fullName
            profile {
              age
            }
          }
        }
      }
      # should be merged with posts[].comments[].author.profile
      profile {
        gender
      }
    }
  }
`;

export const GetAllUsersDocument = gql`
  query GetAllUsers {
    users {
      id
      username
      fullName
      profile {
        bio
        age
        gender
        address {
          city
          coordinates
        }
      }
    }
  }
`;
