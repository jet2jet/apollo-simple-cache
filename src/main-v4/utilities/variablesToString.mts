import canonicalStringify from './canonicalStringify.mjs';

// @internal
export default function variablesToString(variables: unknown): string {
  if (!variables) {
    return '';
  }
  return canonicalStringify(variables) || '';
}
