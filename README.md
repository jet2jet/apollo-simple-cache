# apollo-simple-cache

Simplified cache classes for Apollo Client.

> Note: Version 4 of Apollo Client is not supported but there is a plan to support. Version 2 of Apollo Client is out-of-scope and not supported.

## Install

```
npm install apollo-simple-cache
```

## Usage

There are two cache classes in this package.

### `SimpleDocumentCache`

This is a very simple cache, writing data per each query (i.e. document cache). This is fastest but may increase query requests.

```ts
import { SimpleDocumentCache } from 'apollo-simple-cache';

const cache = new SimpleDocumentCache();
const client = new ApolloClient({ cache });
```

**To use with default options, the GraphQL document must have an operation name (stored in `DocumentNode.<OperationDefinitionNode>.name.value`).**

Note that `SimpleDocumentCache` does not support 'optimistic' processings.

#### constructor options

`SimpleDocumentCache` constructor accepts one optional parameter typed `SimpleDocumentCacheOptions`.

##### `getCacheKey?: <TVariables>(document: DocumentNode, variables: TVariables | undefined) => CacheKey`

A callback function to generate key from document and variables (`CacheKey` is equal to `string`). If the GraphQL document cannot have an operation name, you must implement this function.

### `OptimizedNormalizedCache`

This aims to make performance faster than Apollo's `InMemoryCache`. In some cases `OptimizedNormalizedCache` is slower than `InMemoryCache`, but in many cases `OptimizedNormalizedCache` is faster than `InMemoryCache`.

```ts
import { OptimizedNormalizedCache } from 'apollo-simple-cache';

const cache = new OptimizedNormalizedCache();
const client = new ApolloClient({ cache });
```

#### constructor options

`OptimizedNormalizedCache` constructor accepts one optional parameter typed `OptimizedNormalizedCacheOptions`.

##### `keyFields?: KeyFields | undefined`

Specifies the key (field) names to treat as 'ID'. An array of names or map object including typename referring an array of names can be specified. This is the same for `InMemoryCache`'s option.

##### `possibleTypes?: PossibleTypesMap | undefined`

Specifies the type map which indicates the type is extended by some types. This is the same for `InMemoryCache`'s option.

##### `optimizedRead?: OptimizedReadMap | undefined`

Specifies for optimized read operation. The value must be the map of type names and functions typed `OptimizedReadFunction`, which receives `fieldName`, `existingValue`, and `context: OptimizedReadContext`, and should return the value for actual field value.

Example:

```ts
const cache = new OptimizedNormalizedCache({
  optimizedRead: {
    Query: (fieldName, existingValue, context) => {
      if (fieldName !== 'person') {
        return existingValue;
      }
      if (existingValue != null) {
        return existingValue;
      }
      const id = context.effectiveArguments?.id;
      if (id == null) {
        return undefined;
      }
      const dataId = context.dataIdFromObject({
        __typename: 'Person',
        id,
      });
      if (dataId == null) {
        return undefined;
      }
      return context.readFromId(dataId);
    },
  },
});
```

##### `writeToCacheMap?: WriteToCacheMap | undefined`

Specifies for touching values during write operation. The value must be the map of type names and functions typed `WriteToCacheFunction`, which receives `fieldName`, `existingValue`, `incomingValue`, and `context: WriteToCacheContext`, and should return the value to write to the cache.

##### `dataIdFromObject?: DataIdFromObjectFunction | undefined`

Specifies the function to make unique ID for the object. By default `<typename>:<id>` is used.

##### `rootTypes?: { Query?: string, Mutation?: string, Subscription?: string }`

Overrides root type names for `Query`, `Mutation`, and `Subscription`.

##### Notes

- You can make `keyFields`, `possibleTypes`, `optimizedRead`, and `writeToCacheMap` more strictly typed for type names by extending `CustomDefinition` interface as follows:

```ts
declare module 'apollo-simple-cache' {
  export interface CustomDefinition {
    // Include your typenames (defined in the schema) into Array type
    typenames: Array<'Person' | 'Prefecture' | 'City'>;
  }
}
```

- `OptimizedNormalizedCache` assumes the results (returned by the cache) to be immutable and writing to the results have no effect. If modifying the result is necessary, deep-cloning is required.
  - You can pass `assumeImmutableResults: true` safely to `ApolloClient`'s constructor.

## License

[MIT License](./LICENSE)
