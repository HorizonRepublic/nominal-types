import type { AnyNominalType } from '../../core/contracts.ts';
import { Instant } from '../../temporal/instant.ts';
import { PlainDateTime } from '../../temporal/plain-date-time.ts';
import { PlainDate } from '../../temporal/plain-date.ts';
import { PlainTime } from '../../temporal/plain-time.ts';
import { AnyBigInt } from '../../types/bigint/any-bigint.ts';
import { AnyBoolean } from '../../types/boolean/any-boolean.ts';
import { AnyNumber } from '../../types/number/any-number.ts';
import { typeJsonOf } from '../type-json.ts';

/**
 * The kind of column a nominal type is stored in, with its size where it has one.
 *
 * @internal
 */
export type ColumnKind =
  | { readonly kind: 'text'; readonly length?: number }
  | { readonly kind: 'uuid' }
  | { readonly kind: 'integer' }
  | { readonly kind: 'bigint' }
  | { readonly kind: 'decimal'; readonly precision: number }
  | { readonly kind: 'numeric' }
  | { readonly kind: 'json' }
  | { readonly kind: 'double' }
  | { readonly kind: 'boolean' }
  | { readonly kind: 'timestamptz' }
  | { readonly kind: 'date' }
  | { readonly kind: 'time' }
  | { readonly kind: 'timestamp' };

/**
 * Whether a type is a base type or declared under it.
 *
 * @internal
 */
export const isUnder = (root: object, target: AnyNominalType): boolean =>
  target === root || Object.prototype.isPrototypeOf.call(root, target);

// Found by name, so the adapters don't load the class, and a copy of it from another copy of the
// package is found too.
const isDecimal = (target: AnyNominalType): boolean => {
  for (let type: unknown = target; typeof type === 'function'; type = Object.getPrototypeOf(type)) {
    if (Reflect.get(type, 'typeName') === 'nominal.DecimalString') {
      return true;
    }
  }

  return false;
};

const accepts = (target: AnyNominalType, value: unknown): boolean => target.parse(value).ok;

// Fractions on both sides of zero and past one, so a type limited to negative numbers or to
// amounts from 1 up is still seen to take fractions.
const fractions = [0.5, -0.5, 1.5, -1.5, Number.NaN];

const integerKind = (target: AnyNominalType): ColumnKind => {
  if (fractions.some((fraction) => accepts(target, fraction))) {
    return { kind: 'double' };
  }

  return accepts(target, 2 ** 31) || accepts(target, -(2 ** 31) - 1)
    ? { kind: 'bigint' }
    : { kind: 'integer' };
};

const int64Limit = 2n ** 63n;

const bigintKind = (target: AnyNominalType): ColumnKind => {
  if (!accepts(target, int64Limit) && !accepts(target, -int64Limit - 1n)) {
    return { kind: 'bigint' };
  }

  return accepts(target, 10n ** 20n) || accepts(target, -(10n ** 20n))
    ? { kind: 'text', length: 1000 }
    : { kind: 'decimal', precision: 20 };
};

const combinators = ['anyOf', 'oneOf', 'allOf'];

// Whether a schema describes objects or arrays, alone or among the branches of a union.
const isStructured = (schema: unknown): boolean => {
  if (typeof schema !== 'object' || schema === null) {
    return false;
  }

  const type: unknown = Reflect.get(schema, 'type');
  const types: unknown[] = Array.isArray(type) ? type : [type];

  if (types.includes('object') || types.includes('array')) {
    return true;
  }

  return combinators.some((key) => {
    const branches: unknown = Reflect.get(schema, key);

    return Array.isArray(branches) && branches.some((branch) => isStructured(branch));
  });
};

const textKind = (schema: Record<string, unknown> | undefined): ColumnKind => {
  // @throws-ignore a JSON Schema is JSON
  const text = JSON.stringify(schema ?? {});

  if (text.includes('"format":"uuid"')) {
    return { kind: 'uuid' };
  }

  const lengths = [...text.matchAll(/"maxLength":(\d+)/gu)].map((match) => Number(match[1]));

  return lengths.length === 0 ? { kind: 'text' } : { kind: 'text', length: Math.min(...lengths) };
};

const temporalKinds: ReadonlyArray<readonly [object, ColumnKind]> = [
  [Instant, { kind: 'timestamptz' }],
  [PlainDate, { kind: 'date' }],
  [PlainTime, { kind: 'time' }],
  [PlainDateTime, { kind: 'timestamp' }],
];

/**
 * The column a type is stored in by default. The family comes from the base type it is
 * declared under; the size is found by asking the type itself about values at the edges: `integer`
 * when it refuses everything past 32 bits, `bigint` within 64 bits, `decimal(20)` for unsigned
 * 64-bit values, `double` for fractions; `uuid` for a UUID and text with the type's longest length.
 * The Temporal types take the SQL type of their kind: `timestamptz`, `date`, `time`, `timestamp`.
 * `DecimalString` takes `numeric`, and a type whose values are objects or arrays a JSON column.
 *
 * @internal
 */
export const columnKindOf = (target: AnyNominalType): ColumnKind => {
  const temporal = temporalKinds.find(([root]) => isUnder(root, target));

  if (temporal !== undefined) {
    return temporal[1];
  }

  if (isDecimal(target)) {
    return { kind: 'numeric' };
  }

  const schema = typeJsonOf(target);

  if (isStructured(schema)) {
    return { kind: 'json' };
  }

  if (isUnder(AnyBoolean, target) || accepts(target, true)) {
    return { kind: 'boolean' };
  }

  if (isUnder(AnyBigInt, target)) {
    return bigintKind(target);
  }

  if (isUnder(AnyNumber, target) || (accepts(target, 1) && !accepts(target, '1'))) {
    return integerKind(target);
  }

  return textKind(schema);
};
