import { planOf, registerPaths } from './fast-paths.ts';
import { describeField } from './field-json.ts';
import { foreignRunner } from './foreign-runner.ts';
import { describeValue, rejectedIssue } from './messages.ts';
import { keptPresence, objectParts } from './object-helpers.ts';
import { isObjectSchema } from './object-of.ts';
import { ObjectSchema } from './object-schema.ts';
import { writerOf } from './plain-writers.ts';
import { Rejection } from './rejection.ts';
import { runnableSchema } from './runner.ts';
import { fieldAcceptor } from './shape-acceptors.ts';
import type { StandardSchemaV1 } from './standard-spec.ts';
import { TypeSchema } from './type-schema.ts';
import { unionPaths } from './union-shape.ts';
import type { UnionVariant } from './union-shape.ts';

/**
 * The variants of an `n.union()` schema: each tag to the `n.object()` schema of its shape.
 */
export type UnionVariants = Readonly<Record<string, ObjectSchema<unknown, unknown>>>;

type Simplify<Shape> = { [Key in keyof Shape]: Shape[Key] };

type Tags<Variants> = Extract<keyof Variants, string>;

/**
 * What an `n.union()` schema accepts: for each tag, the input of its variant with the tag under
 * the key.
 *
 * @typeParam Key - The field that holds the tag.
 * @typeParam Variants - Each tag to the `n.object()` schema of its shape.
 */
export type UnionInput<Key extends string, Variants extends UnionVariants> = {
  [Tag in Tags<Variants>]: Variants[Tag] extends ObjectSchema<infer Input, unknown>
    ? Simplify<Readonly<Record<Key, Tag>> & Omit<Input, Key>>
    : never;
}[Tags<Variants>];

/**
 * What an `n.union()` schema gives: for each tag, the value of its variant with the tag under the
 * key, so checking the key narrows the value to one variant.
 *
 * @typeParam Key - The field that holds the tag.
 * @typeParam Variants - Each tag to the `n.object()` schema of its shape.
 */
export type UnionValue<Key extends string, Variants extends UnionVariants> = {
  [Tag in Tags<Variants>]: Variants[Tag] extends ObjectSchema<unknown, infer Output>
    ? Simplify<Readonly<Record<Key, Tag>> & Omit<Output, Key>>
    : never;
}[Tags<Variants>];

// The tag as a field of its variant: it accepts the tag only, and describes itself as a constant.
const tagField = (tag: string): StandardSchemaV1 => {
  const field = runnableSchema<string, string>(
    (value) =>
      value === tag
        ? tag
        : new Rejection([rejectedIssue('not_one_of', JSON.stringify(tag), value)]),
    (_side, options) =>
      options.target === 'openapi-3.0' ? { type: 'string', enum: [tag] } : { const: tag },
  );

  registerPaths(field, {
    accepts: (value) => value === tag,
    write: (value) => value,
    plan: { kind: 'tag', tag },
  });

  return field;
};

// The variant with the tag as its first field, replacing a field of that name; a variant from
// another copy of the package adds it through its own `extend()`.
const taggedVariant = (
  variant: ObjectSchema<unknown, unknown>,
  key: string,
  tag: string,
): ObjectSchema<unknown, unknown> => {
  const parts = objectParts.get(variant);
  const field = tagField(tag);

  if (parts === undefined) {
    // @throws-ignore the key passed checkedVariants(), and the other fields passed their own schema
    return variant.extend({ [key]: field });
  }

  const { [key]: _replaced, ...rest } = parts.source;

  // @throws-ignore the key passed checkedVariants(), and the other fields passed their own schema
  return new ObjectSchema(
    { [key]: field, ...rest },
    parts.constraints,
    parts.strict,
    parts.hidden,
    keptPresence(parts.presence, new Set(Object.keys(rest))),
  );
};

/**
 * The key and the variants of `n.union()`, once they are known to be usable.
 *
 * @throws {@link TypeError} when the key is not a string other than `__proto__`, there are no
 * variants, or a variant is not an `n.object()` schema.
 *
 * @internal
 */
const checkedVariants = (
  key: unknown,
  variants: unknown,
): ReadonlyArray<readonly [string, ObjectSchema<unknown, unknown>]> => {
  if (typeof key !== 'string' || key === '__proto__') {
    throw new TypeError(
      `n.union(): the key must be a string other than __proto__ (was ${describeValue(key)})`,
    );
  }

  const entries = typeof variants === 'object' && variants !== null ? Object.entries(variants) : [];

  if (entries.length === 0) {
    throw new TypeError('n.union(): list at least one variant');
  }

  return entries.map(([tag, variant]: [string, unknown]) => {
    if (!isObjectSchema(variant) || typeof Reflect.get(variant, 'extend') !== 'function') {
      throw new TypeError(
        `n.union(): the variant ${JSON.stringify(tag)} must be an n.object() schema (was ${describeValue(variant)})`,
      );
    }

    return [tag, variant] as const;
  });
};

// What the tag must be, completing "must be …".
const expectedTags = (tags: readonly string[]): string =>
  tags.length === 1
    ? JSON.stringify(tags[0])
    : `one of ${tags.map((tag) => JSON.stringify(tag)).join(', ')}`;

/**
 * One of several object shapes told apart by a tag, such as a payment by card or by bank
 * transfer: what `n.union()` returns.
 *
 * @remarks
 * It is a `TypeSchema`, so `array()`, `optional()` and `nullable()` build on it, `n.object()` takes
 * it as a field, and a nominal type takes it as its rule.
 *
 * @typeParam Input - What the schema accepts.
 * @typeParam Output - What the schema gives back.
 *
 * @example
 * ```ts
 * import { Email, n, NonBlankString } from '@horizon-republic/nominal-types';
 *
 * const Payment = n.union('method', {
 *   card: n.object({ token: NonBlankString }),
 *   invoice: n.object({ email: Email }),
 * });
 *
 * Payment.key; // 'method'
 * Payment.tags; // ['card', 'invoice']
 * ```
 */
export class UnionSchema<Input, Output> extends TypeSchema<Input, Output> {
  /**
   * The field that holds the tag.
   */
  public readonly key: string;
  /**
   * The tags, in the order the variants were listed.
   */
  public readonly tags: readonly string[];

  /**
   * Built by `n.union()`.
   *
   * @throws {@link TypeError} when the key is not a string other than `__proto__`, there are no
   * variants, or a variant is not an `n.object()` schema.
   *
   * @internal
   */
  public constructor(key: string, variants: UnionVariants) {
    const entries = checkedVariants(key, variants);
    const tagged = entries.map(
      ([tag, variant]) => [tag, taggedVariant(variant, key, tag)] as const,
    );
    const tags = entries.map(([tag]) => tag);
    const expected = expectedTags(tags);
    const members: UnionVariant[] = tagged.map(([tag, variant]) => ({
      tag,
      run: foreignRunner(variant, 'n.union()'),
      accepts: fieldAcceptor(variant, 'n.union()'),
      write: writerOf(variant),
    }));
    const paths = unionPaths(key, members, expected);

    super(
      {
        shape: {
          // The variant a tag picks gives its value, which is what Output describes.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          run: paths.run as (input: unknown) => Output | Rejection,
          describe: (side, options) => ({
            oneOf: tagged.map(([, variant]) => describeField(variant, side, options, 'union')),
            ...(options.target === 'openapi-3.0' ? { discriminator: { propertyName: key } } : {}),
          }),
          sensitive: tagged.some(([, variant]) => objectParts.get(variant)?.hidden === true),
        },
        paths: {
          accepts: paths.accepts,
          write: paths.write,
          plan: {
            kind: 'union',
            key,
            variants: tagged.map(([tag, variant]) => ({ tag, plan: planOf(variant) })),
            write: paths.write,
          },
          parts: {
            kind: 'union',
            key,
            variants: tagged.map(([tag, variant]) => ({ tag, variant })),
          },
        },
      },
      { name: 'n.union()' },
    );
    this.key = key;
    this.tags = Object.freeze(tags);
  }
}

/**
 * Builds a schema for an object that takes one of several shapes, told apart by the value of one
 * field: a payment by card or by bank transfer, an event of one of several kinds.
 *
 * @remarks
 * The tag under `key` picks the variant, and only that variant checks the object. A missing tag, or
 * one no variant lists, is one issue under the key: `must be one of "card", "invoice" (was "cash")`.
 * The value holds the tag under the key, whether or not the variant declares that field; a field
 * the variant declares under the key is replaced by the tag. Tags are strings, compared with `===`.
 *
 * @typeParam Key - The field that holds the tag.
 * @typeParam Variants - Each tag to the `n.object()` schema of its shape.
 * @param key - The field that holds the tag.
 * @param variants - Each tag to the `n.object()` schema of its shape.
 * @returns The schema of the union.
 * @throws {@link TypeError} when the key is not a string or is `__proto__`, no variant is given,
 * or a variant is not an `n.object()` schema.
 *
 * @example
 * ```ts
 * import { Email, n, NonBlankString } from '@horizon-republic/nominal-types';
 *
 * const Payment = n.union('method', {
 *   card: n.object({ token: NonBlankString }),
 *   invoice: n.object({ email: Email }),
 * });
 *
 * Payment.parse({ method: 'card', token: 'tok_1' });
 * // { ok: true, value: { method: 'card', token: NonBlankString } }
 * ```
 */
export const union = <const Key extends string, const Variants extends UnionVariants>(
  key: Key,
  variants: Variants,
): UnionSchema<UnionInput<Key, Variants>, UnionValue<Key, Variants>> =>
  new UnionSchema(key, variants);
