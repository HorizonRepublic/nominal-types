import { NetworkError, ParseError, StrictParseError } from './errors.ts';

/** @throws {ParseError} on bad input. */
export const documented = (text: string): string => {
  if (text === '') {
    throw new ParseError('empty');
  }

  return text;
};

export const undocumented = (text: string): string => {
  if (text === '') {
    throw new ParseError('empty'); // error: undocumented
  }

  return text;
};

/** @throws {ParseError | NetworkError} on bad input or a lost link. */
export function union(text: string): string {
  if (text === '') {
    throw new ParseError('empty');
  }

  if (text === 'offline') {
    throw new NetworkError('offline');
  }

  return text;
}

/** @throws {ParseError} covers its subclasses. */
export function supertype(text: string): string {
  if (text === '') {
    throw new StrictParseError('empty');
  }

  return text;
}

/** @throws {StrictParseError} does not cover its parent. -- error: unused */
export function subtype(text: string): string {
  if (text === '') {
    throw new ParseError('empty'); // error: undocumented
  }

  return text;
}

/**
 * Errors with the same shape stay apart.
 *
 * @throws {TypeError} is not a RangeError. -- error: unused
 */
export function sameShape(value: number): number {
  if (value < 0) {
    throw new RangeError('negative'); // error: undocumented
  }

  return value;
}

/**
 * Nothing throws here.
 *
 * @throws {ParseError} never happens. -- error: unused
 */
export function neverThrows(): number {
  return 1;
}

/**
 * Both members of the union are listed.
 *
 * @throws {ParseError | NetworkError} only the first one happens. -- error: unused
 */
export function halfUnion(): never {
  throw new ParseError('always');
}

/** @throws {Error} documents everything. */
export function wide(flag: boolean): void {
  if (flag) {
    throw new TypeError('flag');
  }

  throw new ParseError('always');
}

export const conditional = (flag: boolean): never => {
  throw flag ? new ParseError('a') : new NetworkError('b'); // error: undocumented, undocumented
};

/** @throws {string} a plain message. */
export const message = (): never => {
  throw 'failed';
};

export class Box {
  /** @throws {RangeError} for a negative size. */
  public constructor(size: number) {
    if (size < 0) {
      throw new RangeError('negative');
    }
  }

  public static make(size: number): Box {
    if (size > 10) {
      throw new RangeError('big'); // error: undocumented
    }

    return new Box(size); // error: undocumented
  }
}

export function outer(): () => void {
  const inner = (): void => {
    throw new ParseError('inner'); // error: undocumented
  };

  return inner;
}
