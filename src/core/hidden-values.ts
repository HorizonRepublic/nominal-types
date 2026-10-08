import { charactersOf } from './messages.ts';
import { settings } from './settings.ts';
import type { StandardSchemaV1 } from './standard-spec.ts';

export { charactersOf, describeHidden } from './messages.ts';

const numberText = /^-?(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?|Infinity)$|^NaN$/u;
const bigintText = /^-?\d+n$/u;
// A long string, as a message cuts it: `a string of 30000 characters starting "abc"…`.
const cutText = /^a string of (\d+) characters starting (".*")…$/su;

// JSON text that opens with a quote parses to a string or not at all.
const lengthOf = (text: string): number | undefined => {
  try {
    return String(JSON.parse(text)).length;
  } catch {
    return undefined;
  }
};

/**
 * The value as a message names it, told by its kind only; `undefined` for a kind such as `object`,
 * which names no value.
 *
 * @param text - The value as the message writes it, such as `"jane"` or `42`.
 * @returns The kind of the value, such as `a string of 4 characters`, or `undefined`.
 */
const outlineOf = (text: string): string | undefined => {
  const cut = cutText.exec(text);

  if (cut?.[1] !== undefined && cut[2] !== undefined && lengthOf(cut[2]) !== undefined) {
    return charactersOf(Number(cut[1]));
  }

  if (text.startsWith('"')) {
    const length = lengthOf(text);

    if (length === undefined) {
      return 'a value';
    }

    return length === 0 ? 'an empty string' : charactersOf(length);
  }

  if (bigintText.test(text)) {
    return 'a bigint';
  }

  if (numberText.test(text)) {
    return 'a number';
  }

  return text === 'true' || text === 'false' ? 'a boolean' : undefined;
};

// Where a message names the value it rejected, at its end: `(was "x")`, as this package and
// ArkType write it, or `received "x"`, as Valibot does. The value may hold the marker itself, so
// the first place whose whole tail reads as a value wins.
const markers: ReadonlyArray<readonly [string, string]> = [
  [' (was ', ')'],
  ['received ', ''],
  ['Received ', ''],
];

const hiddenMessage = (message: string, leaveOut: boolean): string => {
  for (const [opening, closing] of markers) {
    if (!message.endsWith(closing)) {
      continue;
    }

    const end = message.length - closing.length;

    for (
      let at = message.indexOf(opening);
      at !== -1 && at + opening.length <= end;
      at = message.indexOf(opening, at + 1)
    ) {
      const outline = outlineOf(message.slice(at + opening.length, end));

      if (outline !== undefined) {
        return leaveOut && opening === ' (was '
          ? message.slice(0, at)
          : `${message.slice(0, at + opening.length)}${outline}${closing}`;
      }
    }
  }

  return message;
};

/**
 * The issues with the rejected values left out of their messages: a string becomes its length, a
 * number, bigint or boolean its kind.
 *
 * @remarks
 * Use it where messages leave the application, such as an API response or a log, and the values
 * may be personal data. It reads the value at the end of a message, as `(was "x")` written by this
 * package and ArkType, or `received "x"` written by Valibot. A message that names the value in
 * another way is left as it is.
 *
 * @param issues - The issues to rewrite, from this package or another Standard Schema library.
 * @returns The issues with the values left out of their messages.
 *
 * @example
 * ```ts
 * import { n } from '@horizon-republic/nominal-types';
 *
 * n.hideValues([{ message: 'must be an email address (was "jane@example")' }]);
 * // [{ message: 'must be an email address (was a string of 12 characters)' }]
 * ```
 */
export const hideValues = (
  issues: readonly StandardSchemaV1.Issue[],
): readonly StandardSchemaV1.Issue[] =>
  issues.map((issue) => {
    const rewritten = settings.writer?.hidden(issue);

    if (rewritten !== undefined) {
      return rewritten;
    }

    const message = hiddenMessage(issue.message, false);

    return message === issue.message ? issue : { ...issue, message };
  });

/**
 * The issues of a rule from another library as the `values` setting of `n.configure()`
 * asks: as they are, with values told by their length, or with the values left out where the
 * message ends in `(was …)`.
 *
 * @internal
 */
export const valuesAsConfigured = (
  issues: readonly StandardSchemaV1.Issue[],
): readonly StandardSchemaV1.Issue[] => {
  const mode = settings.values;

  if (mode === 'show') {
    return issues;
  }

  return mode === 'length'
    ? hideValues(issues)
    : issues.map((issue) => {
        const message = hiddenMessage(issue.message, true);

        return message === issue.message ? issue : { ...issue, message };
      });
};
