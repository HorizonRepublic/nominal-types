import type { Accepts } from './acceptor.ts';
import { generateFunction } from './compile.ts';
import { mustBe } from './messages.ts';
import type { Write } from './plain-writers.ts';
import { plainValue } from './plain.ts';
import { Rejection } from './rejection.ts';

/**
 * Internal: a variant of an `n.union()` schema as its dispatch sees it.
 */
export interface UnionVariant {
  readonly tag: string;
  readonly run: (input: unknown) => unknown;
  readonly accepts: Accepts;
  readonly write: Write;
}

type Dispatch = (input: unknown) => unknown;

const isDispatch = (value: unknown): value is Dispatch => typeof value === 'function';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// One function per union: a `switch` on the tag with a call site of its own for each variant.
const dispatchSource = (key: string, tags: readonly string[], fallback: string): string => {
  const name = JSON.stringify(key);
  const cases = tags.map(
    (tag, index) => `case ${JSON.stringify(tag)}: return each${String(index)}(input);`,
  );

  return `function dispatch(input) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return notRecord(input);
    const tag = hasOwn.call(input, ${name}) ? input[${name}] : undefined;
    switch (tag) {
      ${cases.join('\n')}
      default: return ${fallback}(tag, input);
    }
  }`;
};

const dispatchOf = (
  key: string,
  variants: readonly UnionVariant[],
  each: (variant: UnionVariant) => Dispatch,
  notRecord: Dispatch,
  otherTag: (tag: unknown, input: unknown) => unknown,
  generate?: boolean,
): Dispatch => {
  const built = generateFunction(
    [
      'hasOwn',
      'notRecord',
      'otherTag',
      ...variants.map((_variant, index) => `each${String(index)}`),
    ],
    dispatchSource(
      key,
      variants.map(({ tag }) => tag),
      'otherTag',
    ),
    [
      Reflect.get(Object.prototype, 'hasOwnProperty'),
      notRecord,
      otherTag,
      ...variants.map((variant) => each(variant)),
    ],
    generate,
  );

  if (isDispatch(built)) {
    return built;
  }

  const byTag = new Map(variants.map((variant) => [variant.tag, each(variant)]));

  return (input) => {
    if (!isRecord(input)) {
      return notRecord(input);
    }

    const tag = Object.hasOwn(input, key) ? input[key] : undefined;
    const run = typeof tag === 'string' ? byTag.get(tag) : undefined;

    return run === undefined ? otherTag(tag, input) : run(input);
  };
};

const notObject: Dispatch = (input) => new Rejection([{ message: mustBe('an object', input) }]);

/**
 * Internal: how an `n.union()` schema runs, checks and writes a value: the tag picks the variant,
 * which does the rest.
 *
 * @remarks
 * A missing tag, or one no variant has, is one issue under the key, in the words of `n.oneOf()`.
 */
export const unionPaths = (
  key: string,
  variants: readonly UnionVariant[],
  expected: string,
  generate?: boolean,
): { readonly run: Dispatch; readonly accepts: Accepts; readonly write: Write } => {
  const otherTag = (tag: unknown): Rejection =>
    new Rejection([{ message: mustBe(expected, tag), path: [key] }]);
  const run = dispatchOf(key, variants, (variant) => variant.run, notObject, otherTag, generate);
  const accepts = dispatchOf(
    key,
    variants,
    (variant) => variant.accepts,
    () => false,
    () => false,
    generate,
  );
  const write = dispatchOf(
    key,
    variants,
    (variant) => variant.write,
    plainValue,
    (_tag, value) => plainValue(value),
    generate,
  );

  return {
    run,
    // The dispatch returns what a variant's check returns, or false.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    accepts: accepts as Accepts,
    write,
  };
};
