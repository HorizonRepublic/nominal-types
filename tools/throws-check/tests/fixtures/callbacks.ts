import { ParseError } from './errors.ts';

/** @throws {ParseError} on bad input. */
const parse = (text: string): number => {
  if (text === '') {
    throw new ParseError('empty');
  }

  return text.length;
};

/** @throws {ParseError} from the mapper. */
export const mapped = (lines: readonly string[]): readonly number[] =>
  lines.map((line) => parse(line));

export const mappedSilently = (lines: readonly string[]): readonly number[] =>
  lines.map((line) => parse(line)); // error: undocumented

export const byReference = (lines: readonly string[]): readonly number[] => lines.map(parse); // error: undocumented

export const forEach = (lines: string[]): void => {
  lines.forEach((line) => {
    parse(line); // error: undocumented
  });
};

export const sorted = (lines: string[]): string[] =>
  lines.sort((left, right) => parse(left) - parse(right)); // error: undocumented, undocumented

export const fromMapper = (lines: readonly string[]): number[] => Array.from(lines, parse); // error: undocumented

export const replaced = (text: string): string =>
  text.replace(/a/gu, (match) => String(parse(match))); // error: undocumented

export const reviver = (text: string): unknown =>
  // error-next: undocumented
  JSON.parse(text, (_key, value: unknown) => {
    if (value === null) {
      throw new ParseError('null'); // error: undocumented
    }

    return value;
  });

export const asyncCallback = (lines: readonly string[]): readonly Promise<number>[] =>
  lines.map(async (line) => parse(line));

const later = (callback: () => void): void => {
  void callback;
};

export const eitherCallback = (flag: boolean): void => {
  later(
    flag
      ? () => {
          parse('');
        }
      : () => undefined,
  );
};

export const syncEither = (lines: readonly string[], flag: boolean): readonly number[] =>
  lines.map(flag ? (line) => parse(line) : (line) => line.length); // error: undocumented

export const unknownCaller = (): void => {
  later(() => {
    parse('');
  });
};

/**
 * Runs the callback before it returns.
 *
 * @rethrows callback
 */
const run = <T>(callback: () => T): T => callback();

export const throughRethrows = (): number => run(() => parse('')); // error: undocumented

/** @throws {ParseError} documented for the callback. */
export const throughRethrowsDocumented = (): number => run(() => parse(''));
