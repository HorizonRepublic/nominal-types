import type { NominalSchema, NominalType } from '../../core/contracts.ts';
import { forTarget } from '../../core/json-target.ts';
import { mustBe } from '../../core/messages.ts';
import { Nominal } from '../../core/nominal.ts';
import { Rejection } from '../../core/rejection.ts';
import { runnableSchema } from '../../core/runner.ts';
import { asText, defineTextForm } from '../../core/text-form.ts';

const longestText = 1000;
const integerText = /^(?:0|-?[1-9]\d*)$/u;

const toBigInt = (value: unknown): bigint | Rejection => {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'string' && value.length <= longestText && integerText.test(value)) {
    return BigInt(value);
  }
  return new Rejection([{ message: mustBe('a bigint or an integer string', value) }]);
};

const json = {
  type: 'string',
  pattern: integerText.source,
  maxLength: longestText,
  description: 'an integer string',
};

const bigintRule: NominalSchema<bigint | string, bigint> = runnableSchema<bigint | string, bigint>(
  toBigInt,
  (_side, options) => forTarget(options, json),
);

const AnyBigIntBase: NominalType<'AnyBigInt', NominalSchema<bigint | string, bigint>> = Nominal(
  'AnyBigInt',
  bigintRule,
);

/**
 * Any integer as a `bigint`: the root of the integer types that outgrow `number`, such as
 * database `bigint` columns.
 *
 * @remarks
 * JSON has no bigint, so the type also takes the integer as a decimal string, `'-42'`, and
 * writes one back from `toJSON`; its JSON Schema describes that string. A string is refused
 * beyond 1000 characters before it is converted, since conversion slows down faster than the
 * length grows.
 *
 * @example
 * ```ts
 * new AnyBigInt('9007199254740993').value; // 9007199254740993n
 * JSON.stringify({ id: new AnyBigInt(42n) }); // '{"id":"42"}'
 * ```
 */
export class AnyBigInt extends AnyBigIntBase {
  /**
   * The integer in decimal, since `JSON.stringify` can't write a bigint.
   */
  public override toJSON(): string {
    return this.value.toString();
  }
}

defineTextForm(AnyBigInt, asText);
