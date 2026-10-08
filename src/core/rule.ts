import type { AnyIssueCode, NominalIssue } from './issue-codes.ts';
import { cappedIssues, maxIssues } from './issue-limit.ts';
import { Rejection } from './rejection.ts';
import { settings } from './settings.ts';

/**
 * An issue a rule reports through `report()`: where it is, its code, its message and what a
 * message written for the code reads.
 */
export interface RuleIssue {
  /**
   * Where the problem is inside the checked value, such as `[3, 'sku']` for the `sku` of the
   * fourth row; the schema puts the path of the value in front.
   *
   * @defaultValue The `path` of the rule's options, or the value itself.
   */
  readonly path?: readonly PropertyKey[];
  /**
   * What went wrong, as a name of your own such as `duplicate_sku`, to translate the message and
   * to react to the issue in code. The issue always carries it.
   *
   * @defaultValue The `code` of the rule's options; without one, the issue has the code
   * `constraint`, which it carries only with `n.configure({ codes: true })`.
   */
  readonly code?: string;
  /**
   * The message, unless `n.configure()` has a message for the code.
   *
   * @defaultValue The `message` of the rule's options, or `is invalid`.
   */
  readonly message?: string;
  /**
   * Values a message written for the code reads, such as the row a value repeats; they reach the
   * messages of `n.configure()` and stay out of the issue.
   *
   * @defaultValue None.
   */
  readonly params?: Readonly<Record<string, unknown>>;
}

/**
 * Reports one issue of a rule; call it as often as there are problems.
 *
 * @param issue - Where the problem is, its code, message and params.
 */
export type Report = (issue: RuleIssue) => void;

/**
 * What a rule's check answers besides its reports: `true` or nothing when the value passes,
 * `false` for one issue with the rule's message, or the message of that issue.
 */
// The check may return nothing, after it reported every problem with `report()`.
// oxlint-disable-next-line typescript/no-invalid-void-type
export type RuleVerdict = boolean | string | void;

/**
 * The check of a rule: reads the value, already checked by its schema, and reports what is wrong.
 *
 * @typeParam Value - The value the rule checks.
 * @param value - The value, with instances where the schema makes them.
 * @param report - Reports one issue; call it for each problem.
 * @returns `true` or nothing when the value passes, `false` for one issue with the rule's message,
 * or the message of that issue.
 */
export type RuleCheck<Value> = (value: Value, report: Report) => RuleVerdict;

/**
 * Options of `n.rule()`: the defaults of the issues the rule makes.
 */
export interface RuleOptions {
  /**
   * Where an issue belongs when it doesn't say.
   *
   * @defaultValue The value itself, with an empty path.
   */
  readonly path?: readonly PropertyKey[];
  /**
   * The code of an issue that doesn't give one.
   *
   * @defaultValue `constraint`, carried only with `n.configure({ codes: true })`.
   */
  readonly code?: string;
  /**
   * The message of an issue that doesn't give one, and of the issue for `false`.
   *
   * @defaultValue `is invalid`
   */
  readonly message?: string;
}

const fallbackMessage = 'is invalid';

const none: readonly NominalIssue[] = Object.freeze([]);

const ruleMark = Symbol.for('@horizon-republic/nominal-types/rule');

/**
 * Throws when the options of a rule have the wrong shape.
 *
 * @throws {@link TypeError} when the check is not a function, or an option has the wrong type.
 *
 * @internal
 */
const checkedOptions = (check: unknown, options: unknown): RuleOptions => {
  if (typeof check !== 'function') {
    throw new TypeError('n.rule(): the check must be a function');
  }

  if (typeof options !== 'object' || options === null) {
    throw new TypeError('n.rule(): the options must be an object');
  }

  const { path, code, message }: { path?: unknown; code?: unknown; message?: unknown } = options;

  if (path !== undefined && !Array.isArray(path)) {
    throw new TypeError('n.rule(): path must be an array of keys');
  }

  if (code !== undefined && (typeof code !== 'string' || code === '')) {
    throw new TypeError('n.rule(): code must be a non-empty string');
  }

  if (message !== undefined && typeof message !== 'string') {
    throw new TypeError('n.rule(): message must be a string');
  }

  return options;
};

/**
 * A check of a whole value that reports any number of issues, each with its own path, code and
 * message: what `n.rule()` returns, for `check()` of a schema.
 *
 * @remarks
 * Reach for it when a problem is found by looking at the value as a whole: the same SKU in two
 * rows of an import, dates that overlap. Fields and items are checked first; the rule runs only
 * when all of them pass, so it reads instances.
 *
 * @typeParam Value - The value the rule checks.
 *
 * @example
 * ```ts
 * import { n, NonEmptyString } from '@horizon-republic/nominal-types';
 *
 * const distinct = n.rule((names: readonly NonEmptyString[], report) => {
 *   const seen = new Set<string>();
 *
 *   names.forEach((name, index) => {
 *     if (seen.has(name.value)) report({ path: [index], code: 'repeated_name' });
 *     seen.add(name.value);
 *   });
 * });
 *
 * const Names = n.of(NonEmptyString).array().check(distinct);
 * ```
 */
export class Rule<in Value> {
  readonly #check: RuleCheck<Value>;
  readonly #path: readonly PropertyKey[];
  readonly #code: string | undefined;
  readonly #message: string;

  /**
   * Built by `n.rule()`.
   *
   * @throws {@link TypeError} when the check is not a function, or an option has the wrong type.
   *
   * @internal
   */
  public constructor(check: RuleCheck<Value>, options: RuleOptions) {
    const { path = [], code, message = fallbackMessage } = checkedOptions(check, options);

    this.#check = check;
    this.#path = [...path];
    this.#code = code;
    this.#message = message;
    Object.defineProperty(this, ruleMark, { value: true });
  }

  /**
   * The issues of a value its schema has accepted, in the order the rule made them; none when it
   * passes.
   *
   * @internal
   */
  public issuesOf(value: Value): readonly NominalIssue[] {
    const most = maxIssues();
    let issues: NominalIssue[] | undefined;

    const report: Report = (issue) => {
      issues ??= [];

      if (issues.length <= most) {
        issues.push(this.#issue(issue));
      }
    };

    const verdict = this.#check(value, report);

    if (verdict === false || typeof verdict === 'string') {
      issues ??= [];
      issues.push(this.#issue(typeof verdict === 'string' ? { message: verdict } : {}));
    }

    return issues ?? none;
  }

  #issue(given: RuleIssue): NominalIssue {
    const { path = this.#path, code = this.#code, message = this.#message, params } = given;
    const at = path.length === 0 ? undefined : [...path];
    const { writer } = settings;

    if (writer !== undefined) {
      return writer.write(
        {
          code: code ?? 'constraint',
          own: code !== undefined,
          english: message,
          hiddenEnglish: message,
          wording: { params },
        },
        at,
      );
    }

    const issue: { code?: AnyIssueCode; message: string; path?: PropertyKey[] } =
      code === undefined ? { message } : { code, message };

    if (at !== undefined) {
      issue.path = at;
    }

    return issue;
  }
}

/**
 * Whether a value is a rule built by `n.rule()`, also by another copy of this package.
 *
 * @internal
 */
export const isRule = (value: unknown): value is Rule<never> =>
  typeof value === 'object' && value !== null && Reflect.get(value, ruleMark) === true;

/**
 * A rule given to `check()`, or a check written in place, as a rule.
 *
 * @throws {@link TypeError} when the value is neither a rule nor a function.
 *
 * @internal
 */
export const ruleOf = <Value>(given: Rule<Value> | RuleCheck<Value>): Rule<Value> => {
  if (isRule(given)) {
    return given;
  }

  if (typeof given !== 'function') {
    throw new TypeError('check(): pass a rule built by n.rule(), or a function');
  }

  return new Rule(given, {});
};

/**
 * The issues the rules find in a value, in order, the rules after the most issues one check
 * reports left out; `undefined` when every rule passes.
 *
 * @internal
 */
export const ruleIssues = <Value>(
  rules: ReadonlyArray<Rule<Value>>,
  value: Value,
): NominalIssue[] | undefined => {
  let issues: NominalIssue[] | undefined;

  for (const each of rules) {
    const found = each.issuesOf(value);

    if (found.length > 0) {
      issues ??= [];
      issues.push(...found);

      if (issues.length > maxIssues()) {
        break;
      }
    }
  }

  return issues;
};

/**
 * Runs `run`, then the rules on the value it gave.
 *
 * @internal
 */
export const checkedRun =
  <Value>(
    run: (input: unknown) => Value | Rejection,
    rules: ReadonlyArray<Rule<Value>>,
  ): ((input: unknown) => Value | Rejection) =>
  /**
   * The value, or a Rejection with the issues of the schema or the rules.
   *
   * @param input - The value to check.
   * @returns The value the schema gave, or a Rejection.
   */
  (input) => {
    const value = run(input);

    if (value instanceof Rejection) {
      return value;
    }

    const issues = ruleIssues(rules, value);

    return issues === undefined ? value : new Rejection(cappedIssues(issues));
  };

/**
 * Builds a check of a whole value that reports any number of issues, each with its own path, code
 * and message: for problems found across rows or items, such as a SKU used in two rows of a
 * spreadsheet.
 *
 * @remarks
 * Give the rule to `check()` of an array, `n.object()`, `n.record()` or `n.tuple()` schema, or of
 * any schema `n.of()` builds. It runs only when the value passed its schema, so it reads instances,
 * and rules run in the order given. Call `report()` for each problem, or return `false` or a
 * message for one issue. A code you give is always on the issue; a message set for it with
 * `n.configure({ messages })` replaces the rule's own. Rules are synchronous and add nothing to
 * the JSON Schema.
 *
 * @typeParam Value - The value the rule checks.
 * @param check - Reads the value and reports what is wrong with it.
 * @param options - The path, code and message of an issue that doesn't give its own.
 * @returns The rule, to give to `check()`.
 * @throws {@link TypeError} when the check is not a function, or an option has the wrong type.
 *
 * @example
 * ```ts
 * import { n, Nominal, NonEmptyString, PositiveInteger } from '@horizon-republic/nominal-types';
 *
 * class Row extends Nominal(
 *   'shop.Row',
 *   n.object({ sku: NonEmptyString, quantity: PositiveInteger }),
 * ) {}
 *
 * const uniqueSku = n.rule((rows: readonly Row[], report) => {
 *   const seen = new Map<string, number>();
 *
 *   rows.forEach((row, index) => {
 *     const first = seen.get(row.sku.value);
 *
 *     if (first === undefined) seen.set(row.sku.value, index);
 *     else report({ path: [index, 'sku'], code: 'duplicate_sku', params: { row: first + 1 } });
 *   });
 * });
 *
 * const Sheet = n.of(Row).array({ max: 10_000 }).check(uniqueSku);
 * ```
 */
export const rule = <Value>(check: RuleCheck<Value>, options: RuleOptions = {}): Rule<Value> =>
  new Rule(check, options);
