import { NetworkError, ParseError } from './errors.ts';

/** @throws {ParseError} on bad input. */
const parse = (text: string): number => {
  if (text === '') {
    throw new ParseError('empty');
  }

  return text.length;
};

/** @throws {ParseError} passed on from parse. */
export const caller = (text: string): number => parse(text);

export const silentCaller = (text: string): number => parse(text); // error: undocumented

export const optional = (target?: { readonly parse: typeof parse }): number | undefined =>
  target?.parse('x'); // error: undocumented

/** @throws {ParseError} for text. */
export function overloaded(value: string): number;
/** @throws {RangeError} for numbers. */
export function overloaded(value: number): number;
export function overloaded(value: string | number): number {
  if (typeof value === 'number') {
    throw new RangeError('number');
  }

  return parse(value);
}

/** @throws {ParseError} only the text overload. */
export const pickedOverload = (): number => overloaded('x');

/** @throws {RangeError} only the number overload. */
export const otherOverload = (): number => overloaded(1);

/** Overloads without tags fall back to the implementation. */
export function plain(value: string): number;
export function plain(value: number): number;
/** @throws {ParseError} from the implementation. */
export function plain(value: string | number): number {
  return parse(String(value));
}

export const viaImplementation = (): number => plain(1); // error: undocumented

export interface Reader {
  /** @throws {NetworkError} when the link drops. */
  read: () => string;
  /** @throws {ParseError} on bad bytes. */
  decode(bytes: string): string;
}

export const readAll = (reader: Reader): string => reader.decode(reader.read()); // error: undocumented, undocumented

export class Shape {
  /** @throws {RangeError} for a negative side. */
  public constructor(side: number) {
    if (side < 0) {
      throw new RangeError('negative');
    }
  }
}

export class Square extends Shape {
  /** @throws {RangeError} from the parent. */
  public constructor(side: number) {
    super(side);
  }
}

export class Rectangle extends Shape {
  public constructor(side: number) {
    super(side);

    if (side > 100) {
      throw new NetworkError('too big'); // error: undocumented
    }
  }
}

export class Cube extends Shape {}

export const buildRectangle = (): Shape => new Rectangle(1); // error: undocumented

export const buildCube = (): Shape => new Cube(1); // error: undocumented

export const build = (): Shape => new Square(1); // error: undocumented

/** @throws {ParseError} from the tag. */
const tag = (parts: TemplateStringsArray): string => parse(parts.join('')).toString();

export const tagged = (): string => tag`text`; // error: undocumented

export class Temperature {
  #celsius = 0;

  /** @throws {RangeError} below absolute zero. */
  public set celsius(value: number) {
    if (value < -273.15) {
      throw new RangeError('too cold');
    }

    this.#celsius = value;
  }

  /** @throws {NetworkError} when the sensor is gone. */
  public get celsius(): number {
    if (Number.isNaN(this.#celsius)) {
      throw new NetworkError('sensor');
    }

    return this.#celsius;
  }
}

export const write = (temperature: Temperature): void => {
  temperature.celsius = 1; // error: undocumented
};

export const read = (temperature: Temperature): number => temperature.celsius; // error: undocumented

export const update = (temperature: Temperature): void => {
  temperature.celsius += 1; // error: undocumented, undocumented
};

/** @throws {RangeError} from the setter. */
export const documentedWrite = (temperature: Temperature): void => {
  temperature.celsius = 2;
};
