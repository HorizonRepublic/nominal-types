import type { Accepts } from './acceptor.ts';
import { countIssue } from './array-bounds.ts';
import type { ArrayOptions } from './array-bounds.ts';
import { freshCopy, generateFunction } from './compile.ts';
import { cappedIssues } from './issue-limit.ts';
import { atPath, rejectedIssue } from './messages.ts';
import type { Write } from './plain-writers.ts';
import { plainValue } from './plain.ts';
import { Rejection } from './rejection.ts';
import type { StandardSchemaV1 } from './standard-spec.ts';

type Issues = StandardSchemaV1.Issue[] | undefined;

type Run = (input: unknown) => unknown;

/**
 * What a tuple checks: one check per position, the check of any further items, and how many
 * items it allows.
 *
 * @internal
 */
export interface TupleRules<Check> {
  /**
   * The check of each position, in order.
   */
  readonly items: readonly Check[];
  /**
   * The check of each item past the declared positions, or `undefined` when there may be none.
   */
  readonly rest: Check | undefined;
  /**
   * The fewest items allowed: the positions up to the last one that may not be left out.
   */
  readonly min: number;
}

/**
 * The count options a tuple's issues are worded from: an exact length, or a range.
 *
 * @internal
 */
export const tupleCounts = ({ items, rest, min }: TupleRules<unknown>): ArrayOptions => {
  if (rest !== undefined) {
    return { min };
  }

  return min === items.length ? { length: min } : { min, max: items.length };
};

// What the functions of a tuple read besides its rules, passed in, since a copy of them is
// compiled outside this module.
const helpers = {
  Rejection,
  capped: cappedIssues,
  plain: plainValue,
  notArray: (input: unknown): Rejection =>
    new Rejection([rejectedIssue('not_an_array', 'an array', input)]),
  wrongCount: (counts: ArrayOptions, count: number): Rejection =>
    new Rejection([countIssue(counts, count)]),
  itemIssues: (issues: Issues, index: number, rejection: Rejection): StandardSchemaV1.Issue[] => {
    const all = issues ?? [];

    for (const issue of rejection.issues) {
      all.push(atPath(issue, index));
    }

    return all;
  },
};

type Helpers = typeof helpers;

const makeRun =
  (h: Helpers, rules: TupleRules<Run>, counts: ArrayOptions): Run =>
  (input) => {
    if (!Array.isArray(input)) {
      return h.notArray(input);
    }

    const list: readonly unknown[] = input;
    const { items, rest } = rules;

    if (list.length < rules.min || (rest === undefined && list.length > items.length)) {
      return h.wrongCount(counts, list.length);
    }

    const value: unknown[] = [];
    let issues: Issues;

    for (let index = 0; index < list.length; index += 1) {
      const run = index < items.length ? items[index] : rest;
      const result = run?.(list[index]);

      if (result instanceof h.Rejection) {
        issues = h.itemIssues(issues, index, result);
      } else {
        value.push(result);
      }
    }

    return issues === undefined ? value : new h.Rejection(h.capped(issues));
  };

const isFunction = (value: unknown): value is Run => typeof value === 'function';

// One statement per position, so each position calls its own schema from a call site of its own.
const runSource = ({ items, rest, min }: TupleRules<Run>): string => {
  const positions = items.map((_item, at) => {
    const check = `v${at} = run${at}(input[${at}]); if (v${at} instanceof h.Rejection) issues = h.itemIssues(issues, ${at}, v${at});`;

    return at < min ? check : `if (count > ${at}) { ${check} }`;
  });
  const values = items.map((_item, at) => (at < min ? `v${at}` : '')).filter(Boolean);
  const optional = items
    .map((_item, at) => (at < min ? '' : `if (count > ${at}) value.push(v${at});`))
    .join(' ');
  const restLoop =
    rest === undefined
      ? ''
      : `for (let index = ${items.length}; index < count; index += 1) { const result = runRest(input[index]); if (result instanceof h.Rejection) issues = h.itemIssues(issues, index, result); else value.push(result); }`;

  return `function parseTuple(input) {
  if (!Array.isArray(input)) return h.notArray(input);
  const count = input.length;
  if (count < ${min} || count > max) return h.wrongCount(counts, count);
  let issues; ${items.map((_item, at) => `let v${at};`).join(' ')}
  ${positions.join(' ')}
  const value = [${values.join(', ')}]; ${optional}
  ${restLoop}
  return issues === undefined ? value : new h.Rejection(h.capped(issues));
}`;
};

/**
 * How a tuple runs: the item count first, then each item through the schema of its position,
 * all issues collected with the index in their path. The result is a new array, read-only by type.
 *
 * @internal
 */
export const tupleRun = (rules: TupleRules<Run>, generate?: boolean): Run => {
  const counts = tupleCounts(rules);
  const generated = generateFunction(
    ['h', 'counts', 'max', 'runRest', ...rules.items.map((_item, at) => `run${at}`)],
    runSource(rules),
    [
      helpers,
      counts,
      rules.rest === undefined ? rules.items.length : Number.POSITIVE_INFINITY,
      rules.rest,
      ...rules.items,
    ],
    generate,
  );

  return isFunction(generated) ? generated : makeRun(helpers, rules, counts);
};

const makeAccepts =
  (rules: TupleRules<Accepts>): Accepts =>
  (input) => {
    if (!Array.isArray(input)) {
      return false;
    }

    const list: readonly unknown[] = input;
    const { items, rest } = rules;

    if (list.length < rules.min || (rest === undefined && list.length > items.length)) {
      return false;
    }

    for (let index = 0; index < list.length; index += 1) {
      const accepts = index < items.length ? items[index] : rest;

      if (accepts?.(list[index]) !== true) {
        return false;
      }
    }

    return true;
  };

/**
 * Whether a tuple's run would accept an input, checking each item without building it.
 *
 * @internal
 */
export const tupleAcceptor = (rules: TupleRules<Accepts>, generate?: boolean): Accepts => {
  const { items, rest, min } = rules;
  const checks = items.map((_item, at) =>
    at < min
      ? `if (!accepts${at}(input[${at}])) return false;`
      : `if (count > ${at} && !accepts${at}(input[${at}])) return false;`,
  );
  const restLoop =
    rest === undefined
      ? ''
      : `for (let index = ${items.length}; index < count; index += 1) if (!acceptsRest(input[index])) return false;`;
  const generated = generateFunction(
    ['max', 'acceptsRest', ...items.map((_item, at) => `accepts${at}`)],
    `function acceptsTuple(input) {
  if (!Array.isArray(input)) return false;
  const count = input.length;
  if (count < ${min} || count > max) return false;
  ${checks.join(' ')} ${restLoop}
  return true;
}`,
    [rest === undefined ? items.length : Number.POSITIVE_INFINITY, rest, ...items],
    generate,
  );

  // The source above returns a boolean for any input.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return isFunction(generated) ? (generated as Accepts) : makeAccepts(rules);
};

const makeWrite =
  (h: Helpers, rules: TupleRules<Write>): Write =>
  /**
   * The tuple written item by item.
   *
   * @throws {@link TypeError} when the value refers to itself, which JSON cannot write.
   *
   * @internal
   */
  (value) => {
    if (!Array.isArray(value)) {
      return h.plain(value);
    }

    const list: readonly unknown[] = value;
    const { items, rest = h.plain } = rules;
    const copy: unknown[] = [];

    for (let index = 0; index < list.length; index += 1) {
      const write = index < items.length ? items[index] : rest;

      copy.push(write === undefined ? list[index] : write(list[index]));
    }

    return copy;
  };

/**
 * A copy of a tuple with each item written by the writer of its position.
 *
 * @internal
 */
export const tupleWriter = (rules: TupleRules<Write>, generate?: boolean): Write =>
  freshCopy(makeWrite, generate)(helpers, rules);
