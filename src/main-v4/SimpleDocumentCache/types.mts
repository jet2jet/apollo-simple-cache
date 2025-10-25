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
  /**
   * Specify whether `__typename` field will be added to each fields when requesting the query.
   * **Default is `true`** (`true` is used when `addTypenameToDocument` is nullish)
   */
  addTypenameToDocument?: boolean | undefined;
}
