import type { Accepts } from './acceptor.ts';
import { freshCopy } from './compile.ts';
import { hideValues } from './hidden-values.ts';
import { atPath, describeHidden, issueOf, rejectedIssue, shownValue } from './messages.ts';
import type { Write } from './plain-writers.ts';
import { plainValue } from './plain.ts';
import { Rejection } from './rejection.ts';
import { settings } from './settings.ts';
import type { StandardSchemaV1 } from './standard-spec.ts';

type Issues = StandardSchemaV1.Issue[] | undefined;

type Run = (input: unknown) => unknown;

/**
 * What a record checks: its keys and values, which keys it requires and how many keys it allows.
 *
 * @internal
 */
export interface RecordRules {
  /**
   * Runs the schema of a key: what the key becomes, or a `Rejection`.
   */
  readonly key: Run;
  /**
   * Runs the schema of a value.
   */
  readonly value: Run;
  /**
   * Whether a key whose value is `undefined`, or a key of `required` that is missing, is allowed.
   */
  readonly optional: boolean;
  /**
   * The keys that must be present, for a closed set of keys; empty otherwise.
   */
  readonly required: readonly string[];
  /**
   * The fewest keys allowed.
   */
  readonly min: number;
  /**
   * The most keys allowed.
   */
  readonly max: number;
}

/**
 * The text a key schema gave: the string itself, or the value of an instance.
 *
 * @internal
 */
export const keyText = (key: unknown): string =>
  String(typeof key === 'object' && key !== null ? Reflect.get(key, 'value') : key);

const keys = (count: number): string => (count === 1 ? '1 key' : `${count} keys`);

const countIssue = (min: number, max: number, count: number): StandardSchemaV1.Issue => {
  const few = count < min;
  const english =
    min === max
      ? `must have ${keys(min)} (was ${count})`
      : `must have ${few ? 'at least' : 'at most'} ${keys(few ? min : max)} (was ${count})`;

  return issueOf(few ? 'too_few_keys' : 'too_many_keys', english, {
    wording: {
      value: String(count),
      hiddenValue: String(count),
      min,
      max: max === Number.POSITIVE_INFINITY ? undefined : max,
    },
  });
};

const pushed = (issues: Issues, issue: StandardSchemaV1.Issue): StandardSchemaV1.Issue[] => {
  const all = issues ?? [];

  all.push(issue);

  return all;
};

const keyIssue = (key: string, rejection: Rejection): StandardSchemaV1.Issue => {
  const [first = { message: 'is not allowed' }] = rejection.issues;
  const english = `key ${first.message}`;

  return settings.writer === undefined
    ? { message: english, path: [key] }
    : issueOf('invalid_key', english, {
        hiddenEnglish: `key ${hideValues([first])[0]?.message ?? first.message}`,
        wording: { value: shownValue(key), hiddenValue: describeHidden(key) },
        path: [key],
      });
};

const valueIssues = (
  issues: Issues,
  key: string,
  rejection: Rejection,
): StandardSchemaV1.Issue[] => {
  const all = issues ?? [];

  for (const issue of rejection.issues) {
    all.push(atPath(issue, key));
  }

  return all;
};

// What the functions of a record read besides its rules, passed in, since a copy of them is
// compiled outside this module.
const helpers = {
  Rejection,
  isRecord: (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
  keyText,
  valueIssues,
  plain: plainValue,
  notObject: (input: unknown): Rejection =>
    new Rejection([rejectedIssue('not_an_object', 'an object', input)]),
  wrongCount: (min: number, max: number, count: number): Rejection =>
    new Rejection([countIssue(min, max, count)]),
  keyIssues: (issues: Issues, key: string, rejection: Rejection): StandardSchemaV1.Issue[] =>
    pushed(issues, keyIssue(key, rejection)),
  protoIssues: (issues: Issues, key: string): StandardSchemaV1.Issue[] =>
    pushed(issues, issueOf('not_allowed', 'is not allowed', { path: [key] })),
  missingIssues: (issues: Issues, key: string): StandardSchemaV1.Issue[] =>
    pushed(issues, issueOf('required', 'is required', { path: [key] })),
  missingKeys: (
    issues: Issues,
    input: Readonly<Record<string, unknown>>,
    required: readonly string[],
  ): Issues => {
    let all = issues;

    for (const key of required) {
      if ((Object.hasOwn(input, key) ? input[key] : undefined) === undefined) {
        all = pushed(all, issueOf('required', 'is required', { path: [key] }));
      }
    }

    return all;
  },
  repeatIssues: (issues: Issues, key: string): StandardSchemaV1.Issue[] =>
    pushed(issues, issueOf('not_unique', 'must not repeat a key', { path: [key] })),
  // An object turns into a dictionary as it grows past about 128 keys, which costs more than
  // starting as one, and an object without a prototype starts as one.
  emptyRecord: (large: boolean): Record<string, unknown> => {
    const empty: Record<string, unknown> = {};

    if (large) {
      Reflect.setPrototypeOf(empty, null);
    }

    return empty;
  },
  finished: (value: Record<string, unknown>, large: boolean): Record<string, unknown> => {
    if (large) {
      Reflect.setPrototypeOf(value, Object.prototype);
    }

    return value;
  },
};

type Helpers = typeof helpers;

// A closed set of keys reports a missing value once, among the required keys. A key that is or
// becomes `__proto__` is refused, since a large record gets its prototype only at the end.
const makeRun =
  (h: Helpers, rules: RecordRules): Run =>
  (input) => {
    if (!h.isRecord(input)) {
      return h.notObject(input);
    }

    const names = Object.keys(input);
    const missingHere = !rules.optional && rules.required.length === 0;

    if (names.length < rules.min || names.length > rules.max) {
      return h.wrongCount(rules.min, rules.max, names.length);
    }

    const large = names.length > 128;
    const value = h.emptyRecord(large);
    let issues: Issues;
    let changed = false;

    for (const key of names) {
      const name = key === '__proto__' ? undefined : rules.key(key);
      const raw = input[key];
      const result = name === undefined || raw === undefined ? undefined : rules.value(raw);
      const text = typeof name === 'string' ? name : h.keyText(name);

      if (name === undefined || text === '__proto__') {
        issues = h.protoIssues(issues, key);
      } else if (name instanceof h.Rejection) {
        issues = h.keyIssues(issues, key, name);
      } else if (raw === undefined) {
        issues = missingHere ? h.missingIssues(issues, key) : issues;
      } else if (result instanceof h.Rejection) {
        issues = h.valueIssues(issues, key, result);
      } else if (issues === undefined) {
        changed ||= text !== key;

        if (changed && Object.hasOwn(value, text)) {
          issues = h.repeatIssues(issues, key);
        } else {
          value[text] = result;
        }
      }
    }

    issues = rules.optional ? issues : h.missingKeys(issues, input, rules.required);

    return issues === undefined ? h.finished(value, large) : new h.Rejection(issues);
  };

/**
 * How a record runs: the key count first, then every key through its schema and every value
 * through its own, all issues collected with the key in their path. The result is a new object,
 * read-only by type.
 *
 * @remarks
 * A key that is `__proto__`, or that its schema turns into `__proto__`, is refused, so a value never
 * gets another prototype. A key schema that changes keys, such as one that trims, may make two keys
 * one; the second is refused.
 *
 * @internal
 */
export const recordRun = (rules: RecordRules, generate?: boolean): Run =>
  freshCopy(makeRun, generate)(helpers, rules);

// A key its schema changes may make two keys one, which only the run tells.
const makeAccepts =
  (h: Helpers, rules: RecordRules, accepts: Accepts, run: Run): Accepts =>
  (input) => {
    if (!h.isRecord(input)) {
      return false;
    }

    const names = Object.keys(input);

    if (names.length < rules.min || names.length > rules.max) {
      return false;
    }

    for (const key of names) {
      const name = key === '__proto__' ? new h.Rejection([]) : rules.key(key);
      const raw = input[key];

      if (name instanceof h.Rejection) {
        return false;
      }

      if ((typeof name === 'string' ? name : h.keyText(name)) !== key) {
        return !(run(input) instanceof h.Rejection);
      }

      if (raw === undefined ? !rules.optional : !accepts(raw)) {
        return false;
      }
    }

    return (
      rules.optional ||
      rules.required.every(
        (key) => (Object.hasOwn(input, key) ? input[key] : undefined) !== undefined,
      )
    );
  };

/**
 * Whether a record's run would accept an input, checking each value without building it.
 *
 * @internal
 */
export const recordAcceptor = (
  rules: RecordRules,
  accepts: Accepts,
  run: Run,
  generate?: boolean,
): Accepts => freshCopy(makeAccepts, generate)(helpers, rules, accepts, run);

// A key named `__proto__` is defined rather than set, so the copy keeps its prototype.
const makeWrite =
  (h: Helpers, write: Write): Write =>
  /**
   * The record written key by key.
   *
   * @throws {@link TypeError} when the value refers to itself, which JSON cannot write.
   *
   * @internal
   */
  (value) => {
    if (!h.isRecord(value)) {
      return h.plain(value);
    }

    const names = Object.keys(value);
    const large = names.length > 128;
    const copy = h.emptyRecord(large);

    for (const key of names) {
      const item = value[key];

      if (item !== undefined && key === '__proto__') {
        Object.defineProperty(copy, key, {
          value: write(item),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      } else if (item !== undefined) {
        copy[key] = write(item);
      }
    }

    return h.finished(copy, large);
  };

/**
 * A copy of a record with each value written by `write`; a key whose value is `undefined` is left
 * out, as JSON leaves it out.
 *
 * @internal
 */
export const recordWriter = (write: Write, generate?: boolean): Write =>
  freshCopy(makeWrite, generate)(helpers, write);
