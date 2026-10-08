import type { StandardSchemaV1 } from '../core/standard-spec.ts';

/**
 * Internal: an issue path as plain keys, for libraries whose issues take keys only.
 */
export const plainPath = (path: NonNullable<StandardSchemaV1.Issue['path']>): PropertyKey[] =>
  path.map((segment) => (typeof segment === 'object' ? segment.key : segment));
