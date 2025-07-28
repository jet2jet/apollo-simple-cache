import type { Reference } from '@apollo/client';

// @internal
export default function makeReference(id: string): Reference {
  return { __ref: id };
}
