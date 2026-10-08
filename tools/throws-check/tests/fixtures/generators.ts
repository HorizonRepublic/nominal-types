import { ParseError } from './errors.ts';

/** @throws {ParseError} at next() for an empty line. */
export function* lines(text: string): Generator<string> {
  for (const line of text.split('\n')) {
    if (line === '') {
      throw new ParseError('empty');
    }

    yield line;
  }
}

export function* silent(text: string): Generator<string> {
  if (text === '') {
    throw new ParseError('empty'); // error: undocumented
  }

  yield text;
}

export const count = (text: string): number => [...lines(text)].length; // error: undocumented

/** @throws {ParseError} from the generator. */
export const first = (text: string): string | undefined => lines(text).next().value;
