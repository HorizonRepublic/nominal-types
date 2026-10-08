import type { StandardSchemaV1 } from './standard-spec.ts';

/**
 * Every issue code, to check the keys of a messages map.
 *
 * @internal
 */
export const issueCodes = [
  'not_a_string',
  'pattern',
  'invalid',
  'not_one_of',
  'not_an_object',
  'not_an_array',
  'too_few_items',
  'too_many_items',
  'too_few_keys',
  'too_many_keys',
  'invalid_key',
  'not_unique',
  'required',
  'not_allowed',
  'constraint',
  'too_many_issues',
] as const;

/**
 * What went wrong, as a stable name for each kind of issue this package reports: for translating
 * messages, and for code that reacts to one kind of issue.
 *
 * @remarks
 * Messages may change wording between versions; codes don't. Issues carry their code when
 * `n.configure({ codes: true })` is set, and a messages function always receives it.
 */
export type IssueCode = (typeof issueCodes)[number];

/**
 * A code of an issue: one of this package's, or one a rule of your own gives, such as
 * `duplicate_sku`.
 */
export type AnyIssueCode = IssueCode | (string & Record<never, never>);

/**
 * An issue as this package reports it: a Standard Schema issue, with its code when
 * `n.configure({ codes: true })` is set or a rule gave one.
 */
export interface NominalIssue extends StandardSchemaV1.Issue {
  /**
   * What went wrong, such as `pattern` or `required`. Present when
   * `n.configure({ codes: true })` is set, and always when a rule of your own gave the code.
   */
  readonly code?: AnyIssueCode;
}

/**
 * What a messages function given to `n.configure()` receives for each issue this package reports,
 * to write the message in its place.
 *
 * @remarks
 * `value` is the rejected value as the English message writes it, with the `values` setting and a
 * sensitive type already applied, so a translated message never shows more than the English one.
 */
export interface IssueDetails {
  /**
   * What went wrong, such as `pattern` or `required`, or the code a rule of your own gave.
   */
  readonly code: AnyIssueCode;
  /**
   * The message in English, as the package writes it without a messages function.
   */
  readonly message: string;
  /**
   * What the value must be, such as `an email address`, for the codes that have one.
   */
  readonly description?: string;
  /**
   * The rejected value as the English message writes it: `"jane"`, `42`,
   * `a string of 4 characters`.
   */
  readonly value?: string;
  /**
   * The type whose rule refused the value, when a type's own rule did.
   */
  readonly typeName?: string;
  /**
   * Where the value sits in the checked input, such as `['address', 'city']`; missing at the top.
   */
  readonly path?: readonly PropertyKey[];
  /**
   * The fewest items an array may have, or keys a record, for `too_few_items`, `too_many_items`,
   * `too_few_keys` and `too_many_keys`.
   */
  readonly min?: number;
  /**
   * The most items an array may have, or keys a record, when there is a limit; for
   * `too_many_issues`, the number of issues kept.
   */
  readonly max?: number;
  /**
   * What a rule of your own gave with the issue, such as the row a value repeats, as it gave it.
   */
  readonly params?: Readonly<Record<string, unknown>>;
}

/**
 * A message function given to `n.configure()`: writes the message for an issue, or returns
 * `undefined` to keep the English one.
 */
export type MessageFunction = (issue: IssueDetails) => string | undefined;

/**
 * Messages by issue code, given to `n.configure()` for a language or wording of your own: a code
 * maps to its message, or to a function that writes it. A code left out keeps the English message.
 *
 * @remarks
 * The codes of this package are listed for autocompletion; the codes your own rules give are
 * accepted too.
 */
export type MessageMap = Readonly<Partial<Record<IssueCode, string | MessageFunction>>> &
  Readonly<Record<string, string | MessageFunction | undefined>>;

/**
 * What the `messages` option of `n.configure()` takes: one function for every issue, or a map by
 * issue code.
 */
export type Messages = MessageFunction | MessageMap;
