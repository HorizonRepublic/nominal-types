import { NetworkError, ParseError } from './errors.ts';

/** @throws ParseError when the text is empty, in plain words. */
export const bare = (text: string): string => {
  if (text === '') {
    throw new ParseError('empty');
  }

  return text;
};

/** @throws {@link ParseError} when the text is empty, as a link. */
export const linked = (text: string): string => {
  if (text === '') {
    throw new ParseError('empty');
  }

  return text;
};

/**
 * A tag without a type.
 *
 * @throws when the text is empty. -- error: malformed
 */
export const untyped = (text: string): string => {
  if (text === '') {
    throw new ParseError('empty'); // error: undocumented
  }

  return text;
};

/**
 * A tag that names nothing in scope.
 *
 * @throws {MissingError} when the text is empty. -- error: malformed
 */
export const missing = (text: string): string => {
  if (text === '') {
    throw new ParseError('empty'); // error: undocumented
  }

  return text;
};

/** @throws {@link ParseError} | {@link NetworkError} as a TSDoc union of links. */
export const linkedUnion = (text: string): string => {
  if (text === '') {
    throw new ParseError('empty');
  }

  if (text === 'offline') {
    throw new NetworkError('offline');
  }

  return text;
};

/**
 * One link per tag, with a label.
 *
 * @throws {@link ParseError | the parse error} when the text is empty.
 * @throws {@link NetworkError} when the link drops. -- error: unused
 */
export const linkedLabel = (text: string): string => {
  if (text === '') {
    throw new ParseError('empty');
  }

  return text;
};

/** @throws {@link ParseError} | {@link MissingError} with one name out of scope. -- error: malformed */
export const linkedMissing = (text: string): string => {
  if (text === '') {
    throw new ParseError('empty');
  }

  return text;
};

/**
 * A link and its caller.
 *
 * @throws {@link ParseError} from linkedLabel.
 */
export const linkedCaller = (text: string): string => linkedLabel(text); // error: undocumented

export const linkedCallerSilently = (text: string): string => linkedUnion(text); // error: undocumented, undocumented
