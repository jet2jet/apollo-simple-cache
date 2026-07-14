import canonicalStringify from './canonicalStringify.mts';

// @internal
export default function variablesToString(variables: unknown): string {
  if (!variables) {
    return '';
  }
  return canonicalStringify(variables) || '';
}
