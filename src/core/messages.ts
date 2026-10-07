/**
 * How a rejected value appears in a message: a string quoted, a number, a bigint or a boolean as written,
 * anything else by its kind.
 */
export const describeValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    return Object.is(value, -0) ? '-0' : String(value);
  }

  if (typeof value === 'bigint') {
    return `${value}n`;
  }

  return typeof value === 'boolean' ? String(value) : typeof value;
};

/**
 * The message for a value a rule rejects: `must be <expected> (was <value>)`.
 */
export const mustBe = (expected: string, value: unknown): string =>
  `must be ${expected} (was ${describeValue(value)})`;
