/** @throws {SyntaxError} for text that is not JSON. */
export const parseJson = (text: string): unknown => JSON.parse(text);

export const parseSilently = (text: string): unknown => JSON.parse(text); // error: undocumented

/** @throws {SyntaxError} for text BigInt refuses. */
export const toBigInt = (text: string): bigint => BigInt(text);

/** @throws {SyntaxError | RangeError | TypeError} for anything BigInt refuses. */
export const anyToBigInt = (value: unknown): bigint => BigInt(value as string);

export const textToBigIntSilently = (text: string): bigint => BigInt(text); // error: undocumented

export const numberToBigIntSilently = (value: number): bigint => BigInt(value); // error: undocumented

export const openToBigIntSilently = (value: object): bigint => BigInt(value as unknown as string); // error: undocumented, undocumented, undocumented

export const safeBigInts = (flag: boolean, value: bigint): readonly bigint[] => [
  BigInt(flag),
  BigInt(value),
  BigInt(42),
];

export const unsafeLiteral = (): bigint => BigInt(1.5); // error: undocumented

interface Row {
  readonly id: string;
  readonly count: number;
  readonly tags: readonly string[];
  readonly at: Date;
  readonly nested: { readonly flag: boolean | null };
  readonly skip?: () => void;
}

export const plainJson = (row: Row, list: readonly number[]): string =>
  JSON.stringify({ row, list, total: 1 });

export const bigJson = (value: { readonly id: bigint }): string => JSON.stringify(value); // error: undocumented

export const openJson = (value: unknown): string => JSON.stringify(value); // error: undocumented

export const recordJson = (value: Readonly<Record<string, unknown>>): string =>
  JSON.stringify(value); // error: undocumented

class Money {
  public constructor(private readonly minor: bigint) {}

  public toJSON(): bigint {
    return this.minor;
  }
}

export const customJson = (value: Money): string => JSON.stringify(value); // error: undocumented

/** @throws {TypeError} for a bigint in the value. */
export const documentedJson = (value: bigint | string): string => JSON.stringify([value]);

export const pattern = (source: string): RegExp => new RegExp(source); // error: undocumented

/** @throws {URIError} for a broken escape. */
export const decode = (text: string): string => decodeURIComponent(text);

export const normalize = (text: string): string => text.normalize('NFC') + text.normalize();

export const normalizeWith = (text: string, form: string): string => text.normalize(form); // error: undocumented

export const repeated = (text: string, count: number): string =>
  text.repeat(2) + text.repeat(count); // error: undocumented

export const fixed = (value: number): string => value.toFixed(2);

export const fixedWith = (value: number, digits: number): string => value.toFixed(digits); // error: undocumented

/** @throws {RangeError | TypeError} for a date Temporal refuses. */
export const date = (text: string): Temporal.PlainDate => Temporal.PlainDate.from(text);

export const dateSilently = (): Temporal.PlainDate => new Temporal.PlainDate(2026, 1, 1); // error: undocumented, undocumented

export const safe = (text: string): string => text.trim().toUpperCase();
