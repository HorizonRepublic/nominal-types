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
 * The message for a value a rule rejects: `must be <expected> (was <value>)`.
 */
export const mustBe = (expected: string, value: unknown): string =>
  `must be ${expected} (was ${describeValue(value)})`;

/**
 * Internal: a value as JSON text, with bigints written as decimal strings.
 */
export const jsonText = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) => (typeof item === 'bigint' ? String(item) : item));
