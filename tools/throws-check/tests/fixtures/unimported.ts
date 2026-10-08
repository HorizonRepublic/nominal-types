import { StrictParseError } from './errors.ts';

/**
 * Links a type the file does not import, which the project exports once.
 *
 * @throws {@link ParseError} when the text is empty.
 */
export const strict = (text: string): string => {
  if (text === '') {
    throw new StrictParseError('empty');
  }

  return text;
};
