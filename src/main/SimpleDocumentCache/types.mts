import type { StoreObject } from '@apollo/client';
import { type DocumentNode } from 'graphql';

export type CacheKey = string;

export type CacheObject = Record<CacheKey, StoreObject>;

export interface SimpleDocumentCacheOptions {
  /**
   * The cache key generator function.
   * The key must be unique for `document` and `variables`.
   */
  getCacheKey?: <TVariables>(
    document: DocumentNode,
    variables: TVariables | undefined
  ) => CacheKey;
}
