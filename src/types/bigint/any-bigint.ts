import type { NominalSchema, NominalType } from '../../core/contracts.ts';
import { forTarget } from '../../core/json-target.ts';
import { rejectedIssue } from '../../core/messages.ts';
import { Nominal } from '../../core/nominal.ts';
import { Rejection } from '../../core/rejection.ts';
import { runnableSchema } from '../../core/runner.ts';
import type { StandardOf } from '../../core/standard-schema.ts';
import { asText, defineTextForm } from '../../core/text-form.ts';
import { bigintJsonOf } from './bigint-rule.ts';

const longestText = 1000;
const integerText = /^(?:0|-?[1-9]\d*)$/u;

const toBigInt = (value: unknown): bigint | Rejection => {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'string' && value.length <= longestText && integerText.test(value)) {
    // @throws-ignore the text is an integer, checked just above
    return BigInt(value);
  }

  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    // @throws-ignore the number is a safe integer, checked just above
    return BigInt(value);
  }

  // A number beyond 2^53 - 1 may already have lost digits, so it is refused rather than guessed.
  const expected = Number.isInteger(value)
    ? 'a bigint or an integer string, since a number this large may have lost digits'
    : 'a bigint, an integer string or a safe integer';

  return new Rejection([rejectedIssue('invalid', expected, value)]);
};

const json = {
  string: { type: 'string', pattern: integerText.source, maxLength: longestText },
  integer: {
    type: 'integer',
    minimum: Number.MIN_SAFE_INTEGER,
    maximum: Number.MAX_SAFE_INTEGER,
  },
};

const anyBigIntRule: NominalSchema<bigint | string | number, bigint> = runnableSchema<
  bigint | string | number,
  bigint
>(toBigInt, (side, options) =>
  forTarget(options, { ...bigintJsonOf(json, side), description: 'an integer' }),
);

const AnyBigIntBase: NominalType<
  'nominal.AnyBigInt',
  NominalSchema<bigint | string | number, bigint>
> = Nominal('nominal.AnyBigInt', anyBigIntRule);

/**
 * Any integer as a `bigint`: the root of the integer types that outgrow `number`, such as
 * database `bigint` columns.
 *
 * @remarks
 * JSON has no bigint, so the type also takes the integer as a decimal string, `'-42'`, or as a
 * number up to 2^53 - 1 either way, and writes a string back from `toJSON`. A larger number is
 * refused, since it may already have lost digits. A string is refused beyond 1000 characters
 * before it is converted, since conversion slows down faster than the length grows.
 *
 * @example
 * ```ts
 * import { AnyBigInt } from '@horizon-republic/nominal-types';
 *
 * new AnyBigInt('9007199254740993').value; // 9007199254740993n
 * new AnyBigInt(42).value; // 42n
 * JSON.stringify({ id: new AnyBigInt(42n) }); // '{"id":"42"}'
 * ```
 */
export class AnyBigInt extends AnyBigIntBase {
  /**
   * The Standard Schema of the class, typed with its own instances, so a validator that reads
   * Standard Schema takes the class itself.
   */
  declare public static readonly '~standard': StandardOf<typeof AnyBigInt>;

  /**
   * The integer in decimal, since `JSON.stringify` can't write a bigint.
   *
   * @returns The decimal text, such as `'-42'`.
   */
  public override toJSON(): string {
    return this.value.toString();
  }
}

defineTextForm(AnyBigInt, asText);
