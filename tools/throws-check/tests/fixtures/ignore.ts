import { ParseError } from './errors.ts';

export const constant = (): unknown => {
  // @throws-ignore the text is a constant
  const value: unknown = JSON.parse('{}');

  return value;
};

export const withoutReason = (): unknown => {
  // @throws-ignore
  const value: unknown = JSON.parse('{}'); // error: ignore-reason, undocumented

  return value;
};

// @throws-ignore a test helper that may throw anything
export const helper = (): never => {
  throw new ParseError('helper');
};

export class Service {
  // @throws-ignore the method is a stub
  public stub(): never {
    throw new ParseError('stub');
  }
}

/** @throws {@link ParseError} when the class refuses the text. */
export const reflected = (make: new (text: string) => object, text: string): object => {
  // @throws {@link ParseError} the class checks the text in its constructor
  return Reflect.construct(make, [text]);
};

export const reflectedSilently = (make: new (text: string) => object, text: string): object => {
  // @throws {@link ParseError} the class checks the text in its constructor
  return Reflect.construct(make, [text]); // error: undocumented
};
