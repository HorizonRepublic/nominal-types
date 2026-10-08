import type { IssueCode, IssueDetails, Messages, NominalIssue } from './issue-codes.ts';
import { settings } from './settings.ts';

const longestShown = 64;
const shownCharacters = 32;

// A cut through a surrogate pair would leave half a character, so the cut moves before it.
const startOf = (text: string): string =>
  text.slice(
    0,
    (text.codePointAt(shownCharacters - 1) ?? 0) > 0xff_ff ? shownCharacters - 1 : shownCharacters,
  );

const describeString = (text: string): string =>
  text.length <= longestShown
    ? JSON.stringify(text)
    : `a string of ${String(text.length)} characters starting ${JSON.stringify(startOf(text))}…`;

/**
 * How a rejected value appears in a message: a string quoted, a number, a bigint, a boolean or
 * `null` as written, an array as `array`, anything else by its kind.
 *
 * @remarks
 * A string longer than 64 characters is told by its length and its first 32 characters, so a
 * large input doesn't make a large message: `a string of 30000 characters starting "abc"…`.
 *
 * @internal
 */
export const describeValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return describeString(value);
  }

  if (typeof value === 'number') {
    return Object.is(value, -0) ? '-0' : String(value);
  }

  if (typeof value === 'bigint') {
    return `${value}n`;
  }

  if (typeof value === 'boolean' || value === null) {
    return String(value);
  }

  return Array.isArray(value) ? 'array' : typeof value;
};

/**
 * A string as a hidden value reads, by its length.
 *
 * @internal
 */
export const charactersOf = (count: number): string =>
  count === 1 ? 'a string of 1 character' : `a string of ${String(count)} characters`;

/**
 * A rejected value as the message of a sensitive type names it, by its kind only: what
 * `hideValues` makes of the value `describeValue` writes.
 *
 * @internal
 */
export const describeHidden = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.length === 0 ? 'an empty string' : charactersOf(value.length);
  }

  if (typeof value === 'number') {
    return 'a number';
  }

  if (typeof value === 'bigint') {
    return 'a bigint';
  }

  return typeof value === 'boolean' ? 'a boolean' : describeValue(value);
};

/**
 * The value as a message writes it under the `values` setting, written by `describe`
 * when values are shown; `undefined` when messages leave values out.
 *
 * @internal
 */
export const shownValue = (
  value: unknown,
  describe: (value: unknown) => string = describeValue,
): string | undefined => {
  const mode = settings.values;

  if (mode === 'show') {
    return describe(value);
  }

  return mode === 'length' ? describeHidden(value) : undefined;
};

const withValue = (head: string, shown: string | undefined): string =>
  shown === undefined ? head : `${head} (was ${shown})`;

/**
 * The message for a value a rule rejects: `must be <expected> (was <value>)`, with the value
 * written by `describe`, or as the `values` setting of `n.configure()` asks.
 *
 * @internal
 */
export const mustBe = (
  expected: string,
  value: unknown,
  describe: (value: unknown) => string = describeValue,
): string => withValue(`must be ${expected}`, shownValue(value, describe));

/**
 * What a message is written from, besides its code and English text.
 *
 * @internal
 */
export interface Wording {
  /**
   * What the value must be, completing "must be …".
   */
  readonly description?: string | undefined;
  /**
   * The value as the message shows it.
   */
  readonly value?: string | undefined;
  /**
   * The value told by its kind and length, for a message that hides it.
   */
  readonly hiddenValue?: string | undefined;
  /**
   * The name of the type whose rule rejected the value.
   */
  readonly typeName?: string | undefined;
  /**
   * The lowest count or length allowed.
   */
  readonly min?: number | undefined;
  /**
   * The highest count or length allowed.
   */
  readonly max?: number | undefined;
}

interface Draft {
  readonly code: IssueCode;
  readonly english: string;
  readonly hiddenEnglish: string;
  readonly wording: Wording;
}

// Kept only for issues a messages function wrote, so `hideValues` can have it write them again
// with the value hidden, which it can't find in a message it didn't write.
const drafts = new WeakMap<object, Draft>();

/**
 * Whether issues need more than the English message: a code, or a messages function.
 *
 * @internal
 */
export const customized = (): boolean => settings.codes || settings.messages !== undefined;

type Path = NominalIssue['path'];

const keysOf = (path: NonNullable<Path>): PropertyKey[] =>
  path.map((segment) => (typeof segment === 'object' ? segment.key : segment));

const detailsOf = (draft: Draft, path: Path): IssueDetails => {
  const { description, value, typeName, min, max } = draft.wording;

  return {
    code: draft.code,
    message: draft.english,
    ...(description === undefined ? {} : { description }),
    ...(value === undefined ? {} : { value }),
    ...(typeName === undefined ? {} : { typeName }),
    ...(path === undefined || path.length === 0 ? {} : { path: keysOf(path) }),
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  };
};

const formatted = (format: Messages, details: IssueDetails): string | undefined => {
  const write = typeof format === 'function' ? format : format[details.code];

  return typeof write === 'string' ? write : write?.(details);
};

const issueWith = (code: IssueCode, message: string, path: Path): NominalIssue => {
  if (!settings.codes) {
    return path === undefined ? { message } : { message, path };
  }

  return path === undefined ? { code, message } : { code, message, path };
};

const written = (draft: Draft, path: Path): NominalIssue => {
  const format = settings.messages;
  const message =
    format === undefined
      ? draft.english
      : (formatted(format, detailsOf(draft, path)) ?? draft.english);
  const issue = issueWith(draft.code, message, path);

  if (format !== undefined) {
    drafts.set(issue, draft);
  }

  return issue;
};

/**
 * An issue of this package, with its code when `codes` is set and its message written
 * by the messages function when one is set; `hiddenEnglish` is the English message without the
 * value, which `hideValues` uses.
 *
 * @internal
 */
export const issueOf = (
  code: IssueCode,
  english: string,
  options: {
    readonly hiddenEnglish?: string;
    readonly wording?: Wording;
    readonly path?: Path;
  } = {},
): NominalIssue => {
  const { hiddenEnglish = english, wording = {}, path } = options;

  if (!customized()) {
    return path === undefined ? { message: english } : { message: english, path };
  }

  return written({ code, english, hiddenEnglish, wording }, path);
};

/**
 * The issue for a rejected value, `<head> (was <value>)`, the value written by `describe`
 * or as the `values` setting asks.
 *
 * @internal
 */
export const valueIssue = (
  code: IssueCode,
  head: string,
  value: unknown,
  options: {
    readonly describe?: (value: unknown) => string;
    readonly description?: string;
    readonly typeName?: string | undefined;
    readonly path?: Path;
  } = {},
): NominalIssue => {
  const { describe = describeValue, description, typeName, path } = options;
  const shown = shownValue(value, describe);
  const english = withValue(head, shown);

  if (!customized()) {
    return path === undefined ? { message: english } : { message: english, path };
  }

  const hiddenValue = settings.values === 'hide' ? undefined : describeHidden(value);

  return written(
    {
      code,
      english,
      hiddenEnglish: withValue(head, hiddenValue),
      wording: { description, value: shown, hiddenValue, typeName },
    },
    path,
  );
};

/**
 * The issue for a value a rule rejects, `must be <description> (was <value>)`.
 *
 * @internal
 */
export const rejectedIssue = (
  code: IssueCode,
  description: string,
  value: unknown,
  options: { readonly path?: Path } = {},
): NominalIssue =>
  valueIssue(code, `must be ${description}`, value, {
    ...options,
    description,
  });

/**
 * The issue written again with its value hidden, for `hideValues`, when a messages
 * function wrote it; `undefined` for any other issue.
 *
 * @internal
 */
export const rewrittenHidden = (issue: NominalIssue): NominalIssue | undefined => {
  const draft = drafts.get(issue);

  if (draft === undefined) {
    return undefined;
  }

  return written(
    {
      ...draft,
      english: draft.hiddenEnglish,
      wording: { ...draft.wording, value: draft.wording.hiddenValue },
    },
    issue.path,
  );
};

/**
 * An issue of a field or an item, with `key` in front of its path, keeping its code; a
 * messages function writes it again, for the longer path.
 *
 * @internal
 */
export const atPath = (issue: NominalIssue, key: PropertyKey): NominalIssue => {
  const path = [key, ...(issue.path ?? [])];

  if (settings.messages !== undefined) {
    const draft = drafts.get(issue);

    if (draft !== undefined) {
      return written(draft, path);
    }
  }

  const { code } = issue;

  return code === undefined
    ? { message: issue.message, path }
    : { code, message: issue.message, path };
};

/**
 * A value as JSON text, with bigints written as decimal strings.
 *
 * @internal
 */
export const jsonText = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) => (typeof item === 'bigint' ? String(item) : item));
