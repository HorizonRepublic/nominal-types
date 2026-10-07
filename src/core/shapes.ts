import type { StandardSchemaV1 } from '@standard-schema/spec';

import { boundsOf, countMessage } from './array-bounds.ts';
import type { ArrayOptions } from './array-bounds.ts';
import { mustBe } from './messages.ts';
import { Rejection } from './rejection.ts';
import type { Describe, Run } from './standard-props.ts';
import type { TextForm } from './text-form.ts';

/**
 * Internal: how a `schemaOf()` schema runs and describes itself, without `$schema`.
 */
export interface Shape<Output> {
  readonly run: Run<Output>;
  readonly describe: Describe;
}

const issuesAt = (
  index: number,
  issues: readonly StandardSchemaV1.Issue[],
): StandardSchemaV1.Issue[] =>
  issues.map((issue) => ({ message: issue.message, path: [index, ...(issue.path ?? [])] }));

/**
 * Internal: a frozen array of what `item` accepts, with its count checked first and every bad item
 * reported with its index.
 *
 * @throws TypeError for options `boundsOf` refuses.
 */
export const arrayShape = <Item>(
  item: Shape<Item>,
  options: ArrayOptions,
): Shape<readonly Item[]> => {
  const { min, max } = boundsOf(options);
  return {
    run: (input) => {
      if (!Array.isArray(input)) {
        return new Rejection([{ message: mustBe('an array', input) }]);
      }
      const list: readonly unknown[] = input;
      if (list.length < min || list.length > max) {
        return new Rejection([{ message: countMessage(options, list.length) }]);
      }
      const values: Item[] = [];
      let issues: StandardSchemaV1.Issue[] | undefined;
      const count = list.length;
      // An indexed loop: `entries()` allocates an iterator and a pair per item on the hot path.
      // oxlint-disable-next-line unicorn/no-for-loop
      for (let index = 0; index < count; index += 1) {
        const result = item.run(list[index]);
        if (result instanceof Rejection) {
          issues ??= [];
          issues.push(...issuesAt(index, result.issues));
        } else if (issues === undefined) {
          values.push(result);
        }
      }
      return issues === undefined ? Object.freeze(values) : new Rejection(issues);
    },
    describe: (side, options_) => ({
      type: 'array',
      items: item.describe(side, options_),
      ...(min > 0 ? { minItems: min } : {}),
      ...(max === Number.POSITIVE_INFINITY ? {} : { maxItems: max }),
    }),
  };
};

/**
 * Internal: `item`, or `undefined`.
 */
export const optionalShape = <Item>(item: Shape<Item>): Shape<Item | undefined> => ({
  run: (input) => (input === undefined ? undefined : item.run(input)),
  describe: item.describe,
});

/**
 * Internal: `item`, or `null`; OpenAPI 3.0 has no `null` type and marks the schema `nullable`.
 */
export const nullableShape = <Item>(item: Shape<Item>): Shape<Item | null> => ({
  run: (input) => (input === null ? null : item.run(input)),
  describe: (side, options) =>
    options.target === 'openapi-3.0'
      ? { ...item.describe(side, options), nullable: true }
      : { anyOf: [item.describe(side, options), { type: 'null' }] },
});

/**
 * Internal: `item`, reading a string through the type's text form first.
 */
export const textShape = <Item>(item: Shape<Item>, form: TextForm): Shape<Item> => ({
  run: (input) => item.run(typeof input === 'string' ? (form(input) ?? input) : input),
  describe: item.describe,
});
