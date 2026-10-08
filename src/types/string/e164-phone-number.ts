import type { SubtypeOf } from '../../core/contracts.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { stringOnly } from '../../core/string-rule.ts';
import { AnyString } from './any-string.ts';
import { callingCodes } from './calling-codes.ts';
import { SeparatedRule } from './separated-rule.ts';

const assigned = new Set(callingCodes);

// `+`, a digit other than 0, and up to 14 more: at most 15 digits, as E.164 §6.1 allows.
const pattern = /^\+[1-9]\d{1,14}$/u;

const separators = /[\s().-]/u;

const callingCodeOf = (text: string): string | undefined => {
  for (let length = 1; length <= 3; length += 1) {
    const code = text.slice(1, 1 + length);

    if (assigned.has(code)) {
      return code;
    }
  }

  return undefined;
};

const isPhoneNumberText = (value: unknown): value is string => {
  if (typeof value !== 'string' || !pattern.test(value)) {
    return false;
  }

  const code = callingCodeOf(value);

  return code !== undefined && value.length > code.length + 1;
};

const E164PhoneNumberBase: SubtypeOf<typeof AnyString, 'nominal.E164PhoneNumber'> =
  AnyString.subtype(
    'nominal.E164PhoneNumber',
    stringOnly(
      new SeparatedRule(
        isPhoneNumberText,
        'a phone number in E.164 format',
        {
          separators,
          description: 'a phone number in E.164 format, without spaces, dashes or brackets',
        },
        {
          type: 'string',
          pattern: pattern.source,
          minLength: 3,
          maxLength: 16,
          examples: ['+14155552671'],
        },
      ),
    ),
    { sensitive: true },
  );

/**
 * A phone number in the international format of ITU-T E.164, such as `+14155552671`: `+`, the
 * country calling code and the number in that country, 15 digits at most.
 *
 * @remarks
 * Only the format is checked: the country calling code must be one ITU-T has assigned, from a
 * table the package carries, and at least one digit must follow it. Whether the rest is a number
 * that country uses is not known without the numbering plans of every country; check it with
 * libphonenumber-js in a rule of your own where that matters. Spaces, dashes, dots and brackets
 * are refused with their own message, rather than dropped. A phone number is personal data, so
 * messages leave it out.
 *
 * @example
 * ```ts
 * const phone = new E164PhoneNumber('+380441234567');
 * phone.countryCallingCode; // '380'
 * phone.nationalNumber; // '441234567'
 * ```
 */
export class E164PhoneNumber extends E164PhoneNumberBase {
  declare public static readonly '~standard': StandardOf<typeof E164PhoneNumber>;

  /**
   * Every country calling code the type accepts, without `+`, in the order of ITU-T's list.
   */
  public static readonly countryCallingCodes: readonly string[] = callingCodes;

  /**
   * The shape of a number in E.164 format, which the JSON Schema carries; the country calling
   * code is checked apart from it.
   */
  public static readonly pattern: RegExp = pattern;

  /**
   * The country calling code, without `+`: `'1'` for the United States and Canada, `'380'` for
   * Ukraine, `'800'` for an international freephone number.
   */
  public get countryCallingCode(): string {
    return callingCodeOf(this.value) ?? '';
  }

  /**
   * The digits after the country calling code: the number within that country or service.
   */
  public get nationalNumber(): string {
    return this.value.slice(1 + this.countryCallingCode.length);
  }

  /**
   * Every digit of the number, without `+`, as a dialling string or an SMS gateway takes it.
   */
  public get digits(): string {
    return this.value.slice(1);
  }
}
