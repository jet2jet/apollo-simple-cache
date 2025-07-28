import equal from '../../utilities/equal.mjs';

// @internal
export default function isMatchArguments(
  recordArgs: Record<string, unknown>,
  targetArgs: Record<string, unknown>
): boolean {
  for (const key in recordArgs) {
    if (!equal(recordArgs[key], targetArgs[key])) {
      return false;
    }
  }
  return true;
}
