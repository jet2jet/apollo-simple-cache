import { isReference } from '@apollo/client';

export default function isObjectUsing(
  object: unknown,
  id: string,
  current: unknown,
  isRoot: boolean
): boolean {
  if (!current || typeof current !== 'object') {
    return false;
  }
  if (current instanceof Array) {
    return current.some((x) => isObjectUsing(object, id, x, false));
  }
  if (object === current) {
    return true;
  }
  if (isReference(object)) {
    return object.__ref === id;
  }
  for (const key in current) {
    if (isRoot && key === id) {
      continue;
    }
    const val = (current as Record<string, unknown>)[key];
    if (isObjectUsing(object, id, val, false)) {
      return true;
    }
  }
  return false;
}
