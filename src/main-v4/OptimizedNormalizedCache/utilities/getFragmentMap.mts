import { Kind, type DocumentNode } from 'graphql';
import type { FragmentMap } from '../internalTypes.mjs';

const SYMBOL_CACHED_FRAGMENT_MAP = Symbol('snc:cachedFragmentMap');

type DocumentNodeWithCachedFragmentMap = DocumentNode & {
  [SYMBOL_CACHED_FRAGMENT_MAP]?: FragmentMap;
};

function makeFragmentMap(query: DocumentNode) {
  const map: FragmentMap = { __proto__: null } as unknown as FragmentMap;
  for (const def of query.definitions) {
    if (def.kind === Kind.FRAGMENT_DEFINITION) {
      map[def.name.value] = def;
    }
  }
  return map;
}

// @internal
export default function getFragmentMap(query: DocumentNode): FragmentMap {
  const q = query as DocumentNodeWithCachedFragmentMap;
  return (
    q[SYMBOL_CACHED_FRAGMENT_MAP] ??
    (q[SYMBOL_CACHED_FRAGMENT_MAP] = makeFragmentMap(query))
  );
}
