import type { IssueCode, IssueDetails, Messages, NominalIssue } from './issue-codes.ts';
import { describeHidden, shownValue } from './messages.ts';
import { settings } from './settings.ts';
import type { Draft, IssueWriter } from './settings.ts';

// Kept only for issues a messages function wrote, so `hideValues` can have it write them again
// with the value hidden, which it can't find in a message it didn't write.
const drafts = new WeakMap<object, Draft>();

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

// With neither codes nor messages set, as after `n.configure()` puts them back, this writes the
// English message alone, as the code without a writer does.
const written = (draft: Draft, path?: Path): NominalIssue => {
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
 * Writes the issues of this package once codes or messages are set; `n.configure()` puts it in
 * the settings, so a bundle that never configures leaves it out.
 *
 * @internal
 */
export const issueWriter: IssueWriter = {
  write: written,
  rule: (rule, value, describe, typeName) =>
    written({
      code: rule.codeFor(value),
      english: rule.messageFor(value, describe),
      hiddenEnglish: rule.messageFor(value, describeHidden),
      wording: {
        description: rule.descriptionFor(value),
        value: shownValue(value, describe),
        hiddenValue: settings.values === 'hide' ? undefined : describeHidden(value),
        typeName,
      },
    }),
  atPath: (issue, path) => {
    const draft = settings.messages === undefined ? undefined : drafts.get(issue);

    return draft === undefined ? undefined : written(draft, path);
  },
  hidden: (issue) => {
    const draft = drafts.get(issue);

    return draft === undefined
      ? undefined
      : written(
          {
            ...draft,
            english: draft.hiddenEnglish,
            wording: { ...draft.wording, value: draft.wording.hiddenValue },
          },
          issue.path,
        );
  },
};
