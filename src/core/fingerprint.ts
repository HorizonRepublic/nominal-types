import type { NominalSchema } from './contracts.ts';

/**
 * What tells two rules apart when two types share a name: the pattern, the description
 * or the vendor of the rule.
 *
 * @internal
 */
export const fingerprintOf = (rule: NominalSchema | undefined): string => {
  if (rule === undefined) {
    return '';
  }

  const pattern: unknown = Reflect.get(rule, 'pattern');

  if (pattern instanceof RegExp) {
    return `pattern:/${pattern.source}/${pattern.flags}`;
  }

  const description: unknown = Reflect.get(rule, 'description');

  return typeof description === 'string'
    ? `rule:${description}`
    : `schema:${rule['~standard'].vendor}`;
};
