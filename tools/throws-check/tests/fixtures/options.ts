/**
 * A wider type listed next to the narrow one.
 *
 * @throws {TypeError} when the flag is set.
 * @throws {Error} as well.
 */
export const redundant = (flag: boolean): void => {
  if (flag) {
    throw new TypeError('flag');
  }
};

export const root = (value: number): number => Math.sqrt(value);

/** @throws {SyntaxError} for text that is not JSON. */
export const parsed = (text: string): unknown => JSON.parse(text);

export const immediate = (): number =>
  now(() => {
    throw new RangeError('now');
  });
