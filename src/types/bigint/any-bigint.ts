import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { NominalSchema, NominalType } from '../../core/contracts.ts';
import { Nominal } from '../../core/nominal.ts';
import { describeValue, forTarget } from '../../core/schema-text.ts';
import type { StandardProps } from '../../core/standard-schema.ts';
import { asText, defineTextForm } from '../../core/text-form.ts';

const longestText = 1000;
const integerText = /^(?:0|-?[1-9]\d*)$/u;

const toBigInt = (value: unknown): StandardSchemaV1.Result<bigint> => {
  if (typeof value === 'bigint') {
    return { value };
  }
  if (typeof value === 'string' && value.length <= longestText && integerText.test(value)) {
    return { value: BigInt(value) };
  }
  return {
    issues: [{ message: `must be a bigint or an integer string (was ${describeValue(value)})` }],
  };
};

const json = {
  type: 'string',
  pattern: integerText.source,
  maxLength: longestText,
  description: 'an integer string',
};

const bigintRule: NominalSchema<bigint | string, bigint> = {
  '~standard': {
    version: 1,
    vendor: '@horizon-republic/nominal-types',
    validate: toBigInt,
    jsonSchema: {
      input: (options) => forTarget(options, json),
      output: (options) => forTarget(options, json),
    },
  } satisfies StandardProps<bigint | string, bigint>,
};

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
