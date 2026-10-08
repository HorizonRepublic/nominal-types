import type { SubtypeOf } from '../../core/contracts.ts';
import { matching } from '../../core/pattern-schema.ts';
import { satisfying } from '../../core/predicate-schema.ts';
import type { PredicateSchema } from '../../core/predicate-schema.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { AnyString } from './any-string.ts';
import { uuidV7Bytes } from './uuid-v7-bytes.ts';
import { Uuid } from './uuid.ts';

const alphabet = '0123456789abcdefghjkmnpqrstvwxyz';
const suffixLength = 26;
const prefixGrammar = '[a-z](?:[a-z_]{0,61}[a-z])?';
const pattern = new RegExp(`^(?:${prefixGrammar}_)?[0-7][0-9a-hjkmnp-tv-z]{25}$`, 'u');
const prefixPattern = new RegExp(`^(?:${prefixGrammar})?$`, 'u');
const uuidText = /^[\dA-Fa-f]{8}-[\dA-Fa-f]{4}-[\dA-Fa-f]{4}-[\dA-Fa-f]{4}-[\dA-Fa-f]{12}$/u;

const TypeIdBase: SubtypeOf<typeof AnyString, 'nominal.TypeId'> = AnyString.subtype(
  'nominal.TypeId',
  matching(pattern, 'a TypeID', {
    minLength: suffixLength,
    maxLength: 90,
    examples: ['user_01h455vb4pex5vsknk084sn02q'],
  }),
);

// 128 bits behind two zero bits, five bits to a character.
const encode = (bytes: Uint8Array): string => {
  let text = '';
  let bits = 0;
  let width = 2;

  for (const byte of bytes) {
    bits = (bits << 8) | byte;
    width += 8;

    while (width >= 5) {
      width -= 5;
      text += alphabet.charAt((bits >> width) & 31);
    }

    bits &= (1 << width) - 1;
  }

  return text;
};

const decode = (suffix: string): Uint8Array => {
  const bytes = new Uint8Array(16);
  let bits = 0;
  let width = -2;
  let at = 0;

  for (const character of suffix) {
    bits = (bits << 5) | alphabet.indexOf(character);
    width += 5;

    if (width >= 8) {
      width -= 8;
      bytes[at] = (bits >> width) & 0xff;
      at += 1;
    }

    bits &= (1 << Math.max(width, 0)) - 1;
  }

  return bytes;
};

const hexOf = (bytes: Uint8Array): string => {
  let hex = '';

  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const bytesOf = (uuid: string): Uint8Array => {
  const hex = uuid.replaceAll('-', '');

  return Uint8Array.from({ length: 16 }, (_, at) =>
    Number.parseInt(hex.slice(at * 2, at * 2 + 2), 16),
  );
};

const prefixes = new WeakMap<object, string>();

const checkPrefix = (method: string, prefix: string): void => {
  if (typeof prefix !== 'string' || !prefixPattern.test(prefix)) {
    throw new TypeError(
      `${method}: a TypeID prefix is up to 63 of a-z and _, not starting or ending with _ (was ${JSON.stringify(prefix)})`,
    );
  }
};

// The prefix `withPrefix()` fixed for a type or a type above it.
const fixedPrefixOf = (type: unknown): string | undefined => {
  for (let level = type; typeof level === 'function'; level = Object.getPrototypeOf(level)) {
    const rule: unknown = Object.hasOwn(level, 'rule') ? Reflect.get(level, 'rule') : undefined;
    const prefix = typeof rule === 'object' && rule !== null ? prefixes.get(rule) : undefined;

    if (prefix !== undefined) {
      return prefix;
    }
  }

  return undefined;
};

const joined = (prefix: string, suffix: string): string =>
  prefix === '' ? suffix : `${prefix}_${suffix}`;

/**
 * An id with its kind in front, such as `user_01h455vb4pex5vsknk084sn02q`, as the TypeID
 * specification (version 0.3.0, github.com/jetify-com/typeid) writes it: a prefix, `_`, and a
 * UUID in 26 characters of base32.
 *
 * @remarks
 * The prefix is up to 63 lowercase letters and `_`, starting and ending with a letter; it may be
 * left out together with its `_`. The suffix is lowercase only, from the alphabet
 * `0123456789abcdefghjkmnpqrstvwxyz`, and its first character is `0` to `7`, so it fits in 128
 * bits. Any 128 bits pass, as the specification asks; `generate()` always makes a version 7 UUID.
 * For one kind of id, declare a subtype with `withPrefix()`.
 *
 * @example
 * ```ts
 * class UserId extends TypeId.subtype('shop.UserId', TypeId.withPrefix('user')) {}
 *
 * const id = UserId.generate();
 * id.prefix; // 'user'
 * ```
 */
export class TypeId extends TypeIdBase {
  declare public static readonly '~standard': StandardOf<typeof TypeId>;

  /**
   * A TypeID with or without a prefix, in the lowercase the specification requires.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The rule of a subtype whose ids all carry this prefix, for
   * `TypeId.subtype('shop.UserId', TypeId.withPrefix('user'))`. An empty prefix makes a type of
   * ids without one.
   *
   * @throws TypeError when the prefix breaks the grammar of the specification.
   */
  public static withPrefix(prefix: string): PredicateSchema<string> {
    checkPrefix('withPrefix()', prefix);

    const start = joined(prefix, '');
    const length = start.length + suffixLength;
    const rule = satisfying(
      (value: unknown): value is string =>
        typeof value === 'string' && value.length === length && value.startsWith(start),
      prefix === '' ? 'a TypeID without a prefix' : `a TypeID with the prefix ${prefix}`,
      {
        type: 'string',
        pattern: `^${start}.{${suffixLength}}$`,
        examples: [joined(prefix, '01h455vb4pex5vsknk084sn02q')],
      },
    );

    prefixes.set(rule, prefix);

    return rule;
  }

  /**
   * A new id around a new version 7 UUID, with the prefix the type fixes, or the one given.
   *
   * @remarks
   * Ids made by one process sort by the time they were made, also within one millisecond.
   *
   * @throws TypeError when the prefix breaks the grammar of the specification.
   * @throws NominalError when the type refuses the id, such as a prefix other than its own.
   */
  public static generate<Type extends new (input: string) => TypeId>(
    this: Type,
    prefix: string = fixedPrefixOf(this) ?? '',
  ): InstanceType<Type> {
    checkPrefix('generate()', prefix);

    // A class built from a nominal type makes instances of itself.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return new this(joined(prefix, encode(uuidV7Bytes()))) as InstanceType<Type>;
  }

  /**
   * The id of a UUID that exists already, such as one a database made, with the prefix the type
   * fixes, or the one given. Any 128 bits in the 8-4-4-4-12 form pass, in either case.
   *
   * @throws TypeError when the UUID is not in the 8-4-4-4-12 form, or the prefix breaks the grammar.
   * @throws NominalError when the type refuses the id, such as a prefix other than its own.
   */
  public static fromUuid<Type extends new (input: string) => TypeId>(
    this: Type,
    uuid: Uuid | string,
    prefix: string = fixedPrefixOf(this) ?? '',
  ): InstanceType<Type> {
    const text = typeof uuid === 'string' ? uuid : uuid.value;

    if (!uuidText.test(text)) {
      throw new TypeError(
        `fromUuid(): a UUID is 8-4-4-4-12 hex digits (was ${JSON.stringify(text)})`,
      );
    }

    checkPrefix('fromUuid()', prefix);

    // A class built from a nominal type makes instances of itself.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return new this(joined(prefix, encode(bytesOf(text)))) as InstanceType<Type>;
  }

  /**
   * The kind of id in front of the last `_`; `''` for an id without one.
   */
  public get prefix(): string {
    return this.value.slice(0, Math.max(this.value.length - suffixLength - 1, 0));
  }

  /**
   * The last 26 characters: the UUID in base32.
   */
  public get suffix(): string {
    return this.value.slice(-suffixLength);
  }

  /**
   * The moment the id was made, from the first 48 bits of its UUID, when that UUID is version 7;
   * `undefined` for any other.
   */
  public get timestamp(): Date | undefined {
    const uuid = hexOf(decode(this.suffix));

    if (uuid.charAt(14) !== '7' || !'89ab'.includes(uuid.charAt(19))) {
      return undefined;
    }

    return new Date(Number.parseInt(uuid.slice(0, 8) + uuid.slice(9, 13), 16));
  }

  /**
   * The UUID inside, in lowercase.
   *
   * @throws NominalError when the 128 bits are not a UUID `Uuid` accepts, such as the
   * specification's test id `00000000000000000000000001`: version 1 to 8 with the RFC 9562
   * variant, nil or max.
   */
  public toUuid(): Uuid {
    return new Uuid(hexOf(decode(this.suffix)));
  }
}
