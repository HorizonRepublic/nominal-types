import { NetworkError, ParseError } from './errors.ts';

export const parserOf = (strict: boolean): ((text: string) => string) => {
  if (strict) {
    /** @throws {ParseError} when the text is empty. */
    return (text) => {
      if (text === '') {
        throw new ParseError('empty');
      }

      return text;
    };
  }

  return (text) => text;
};

export const curried =
  (prefix: string) =>
  /** @throws {ParseError} when the text is the prefix. */
  (text: string): string => {
    if (text === prefix) {
      throw new ParseError('same');
    }

    return prefix + text;
  };

export const silentFactory = (): (() => never) => () => {
  throw new ParseError('made'); // error: undocumented
};

/** @throws {ParseError} the maker never throws, and the made function documents its own. -- error: unused */
export const ownDocs =
  (): (() => never) =>
  /** @throws {NetworkError} documented on the made function. */
  () => {
    throw new NetworkError('own');
  };
