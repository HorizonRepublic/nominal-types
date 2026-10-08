import { boundsOf, countIssue } from './array-bounds.ts';
import type { ArrayOptions } from './array-bounds.ts';
import { generateFunction } from './compile.ts';
import { hideValues } from './hidden-values.ts';
import { cappedIssues, maxIssues } from './issue-limit.ts';
import { atPath, rejectedIssue, valueIssue } from './messages.ts';
import { Rejection } from './rejection.ts';
import { repeatedValue, repeatsIn } from './repeats.ts';
import type { Describe, Run } from './standard-props.ts';
import type { StandardSchemaV1 } from './standard-spec.ts';
import type { TextForm } from './text-form.ts';

/**
 * How a `n.of()` schema runs and describes itself, without `$schema`.
 *
 * @internal
 */
export interface Shape<Output> {
  /**
   * Runs the schema: the value, or a `Rejection`.
   */
  readonly run: Run<Output>;

  /**
   * The JSON Schema of the schema for one side and target, without its `$schema`.
   *
   * @throws {@link TypeError} when a rule can't describe itself; the message names the type.
   */
  readonly describe: Describe;

  /**
   * Whether messages about the value leave it out, as the messages of a sensitive type do.
   */
  readonly sensitive?: boolean;
}

const issuesAt = (
  index: number,
  issues: readonly StandardSchemaV1.Issue[],
): StandardSchemaV1.Issue[] => issues.map((issue) => atPath(issue, index));

const arraySource = `function parseArray(input) {
  if (!Array.isArray(input)) return notArray(input);
  const count = input.length;
  if (count < min || count > max) return wrongCount(count);
  const values = [];
  let issues;
  for (let index = 0; index < count; index += 1) {
    const result = run(input[index]);
    if (result instanceof Rejection) {
      issues = itemIssues(issues, index, result);
      if (issues.length > maxIssues()) break;
    } else if (issues === undefined) values.push(result);
  }
  return issues === undefined ? values : new Rejection(cappedIssues(issues));
}`;

const itemIssues = (
  issues: StandardSchemaV1.Issue[] | undefined,
  index: number,
  rejection: Rejection,
): StandardSchemaV1.Issue[] => {
  const all = issues ?? [];

  all.push(...issuesAt(index, rejection.issues));

  return all;
};

const notArray = (input: unknown): Rejection =>
  new Rejection([rejectedIssue('not_an_array', 'an array', input)]);

const isRun = (value: unknown): value is (input: unknown) => unknown => typeof value === 'function';

const loopRun =
  <Item>(
    run: (input: unknown) => Item | Rejection,
    min: number,
    max: number,
    wrongCount: (count: number) => Rejection,
  ): ((input: unknown) => readonly Item[] | Rejection) =>
  (input) => {
    if (!Array.isArray(input)) {
      return notArray(input);
    }

    const list: readonly unknown[] = input;

    if (list.length < min || list.length > max) {
      return wrongCount(list.length);
    }

    const values: Item[] = [];
    let issues: StandardSchemaV1.Issue[] | undefined;

    for (const [index, value] of list.entries()) {
      const result = run(value);

      if (result instanceof Rejection) {
        issues = itemIssues(issues, index, result);

        if (issues.length > maxIssues()) {
          break;
        }
      } else if (issues === undefined) {
        values.push(result);
      }
    }

    return issues === undefined ? values : new Rejection(cappedIssues(issues));
  };

const arrayRun = <Item>(
  run: (input: unknown) => Item | Rejection,
  options: ArrayOptions,
  min: number,
  max: number,
  generate?: boolean,
): ((input: unknown) => readonly Item[] | Rejection) => {
  const wrongCount = (count: number): Rejection => new Rejection([countIssue(options, count)]);
  const generated = generateFunction(
    [
      'run',
      'min',
      'max',
      'Rejection',
      'notArray',
      'wrongCount',
      'itemIssues',
      'maxIssues',
      'cappedIssues',
    ],
    arraySource,
    [run, min, max, Rejection, notArray, wrongCount, itemIssues, maxIssues, cappedIssues],
    generate,
  );

  if (isRun(generated)) {
    // The source above returns a new array of what `run` gave, or a Rejection.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return generated as (input: unknown) => readonly Item[] | Rejection;
  }

  return loopRun(run, min, max, wrongCount);
};

// Repeats are looked for once every item is valid, so they are compared as the values they became.
const uniqueRun =
  <Item>(
    run: (input: unknown) => readonly Item[] | Rejection,
    sensitive: boolean,
  ): ((input: unknown) => readonly Item[] | Rejection) =>
  (input) => {
    const values = run(input);

    if (values instanceof Rejection) {
      return values;
    }

    const repeats = repeatsIn(values);

    if (repeats === undefined) {
      return values;
    }

    const issues = repeats.map((index) =>
      valueIssue('not_unique', 'must not repeat an item', repeatedValue(values[index]), {
        path: [index],
      }),
    );

    return new Rejection(cappedIssues(sensitive ? hideValues(issues) : issues));
  };

/**
 * A new array of what `item` accepts, with its count checked first and every bad item
 * reported with its index, then, with `unique`, every item that repeats an earlier one. It is
 * read-only by type; a nominal type built on it freezes it.
 *
 * @remarks
 * Each array schema runs a loop generated for it, so V8 sees one item schema at its call.
 *
 * @throws {@link TypeError} when the options hold bounds that `boundsOf` refuses.
 *
 * @internal
 */
export const arrayShape = <Item>(
  item: Shape<Item>,
  options: ArrayOptions,
  generate?: boolean,
): Shape<readonly Item[]> => {
  const { min, max } = boundsOf(options);
  const run = arrayRun(item.run, options, min, max, generate);
  const unique = options.unique === true;

  return {
    run: unique ? uniqueRun(run, item.sensitive === true) : run,
    describe: (side, options_) => ({
      type: 'array',
      items: item.describe(side, options_),
      ...(min > 0 ? { minItems: min } : {}),
      ...(max === Number.POSITIVE_INFINITY ? {} : { maxItems: max }),
      ...(unique ? { uniqueItems: true } : {}),
    }),
  };
};

/**
 * `item`, or `undefined`.
 *
 * @internal
 */
export const optionalShape = <Item>(item: Shape<Item>): Shape<Item | undefined> => ({
  run: (input) => (input === undefined ? undefined : item.run(input)),
  describe: item.describe,
  sensitive: item.sensitive === true,
});

/**
 * `item`, or `null`; OpenAPI 3.0 has no `null` type and marks the schema `nullable`.
 *
 * @internal
 */
export const nullableShape = <Item>(item: Shape<Item>): Shape<Item | null> => ({
  run: (input) => (input === null ? null : item.run(input)),
  describe: (side, options) =>
    options.target === 'openapi-3.0'
      ? { ...item.describe(side, options), nullable: true }
      : { anyOf: [item.describe(side, options), { type: 'null' }] },
  sensitive: item.sensitive === true,
});

/**
 * `item`, reading a string through the type's text form first.
 *
 * @internal
 */
export const textShape = <Item>(item: Shape<Item>, form: TextForm): Shape<Item> => ({
  run: (input) => item.run(typeof input === 'string' ? (form(input) ?? input) : input),
  describe: item.describe,
  sensitive: item.sensitive === true,
});
