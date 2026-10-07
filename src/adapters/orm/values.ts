import type { AnyNominalType } from '../../core/contracts.ts';
import { NominalError } from '../../core/nominal-error.ts';
import { Rejection } from '../../core/rejection.ts';
import { textFormOf } from '../../core/text-form.ts';
import { instanceParserFor, trustedConstructorFor } from '../../core/type-functions.ts';
import type { ColumnKind } from './column.ts';

/**
 * Options every ORM adapter takes.
 */
export interface StorageOptions<Instance> {
  /**
   * What is stored for an instance; the instance's `toJSON()` by default. It also runs on values in
   * query conditions, so a lookup is made with what is stored.
   */
  readonly serialize?: (value: Instance) => unknown;
  /**
   * Builds instances from stored values without checking them. Values read from the database are
   * checked by default, so rows written before a rule changed fail loudly instead of passing as
   * valid.
   */
  readonly trusted?: boolean;
}

const isNullish = (value: unknown): value is null | undefined =>
  value === null || value === undefined;

const booleanFrom = (raw: unknown): unknown => {
  if (raw === 1 || raw === '1' || raw === 'true' || raw === 't') {
    return true;
  }

  return raw === 0 || raw === '0' || raw === 'false' || raw === 'f' ? false : raw;
};

const plainFrom = (raw: unknown, column: ColumnKind, target: AnyNominalType): unknown => {
  if (column.kind === 'boolean') {
    return booleanFrom(raw);
  }

  if (typeof raw === 'string' && column.kind !== 'text' && column.kind !== 'uuid') {
    const form = textFormOf(target);

    return form === undefined ? raw : form(raw);
  }

  return raw;
};

const storedOf = (instance: unknown): unknown => {
  const toJson: unknown =
    typeof instance === 'object' && instance !== null ? Reflect.get(instance, 'toJSON') : undefined;

  return typeof toJson === 'function' ? Reflect.apply(toJson, instance, []) : instance;
};

/**
 * Internal: turns a stored value into an instance: `null` and `undefined` as they are, numbers and
 * booleans read from the text or integers some drivers return, then checked unless `trusted`. A
 * driver's number beyond 2^53 - 1 is refused by big integer types, since it has lost digits.
 *
 * @throws NominalError naming the type for a stored value it doesn't accept.
 */
export const readerOf = (
  target: AnyNominalType,
  column: ColumnKind,
  trusted: boolean,
): ((raw: unknown) => unknown) => {
  const build = trusted ? trustedConstructorFor(target) : instanceParserFor(target);

  return (raw) => {
    if (isNullish(raw)) {
      return raw;
    }

    const value = build(plainFrom(raw, column, target));

    if (value instanceof Rejection) {
      throw new NominalError(target.typeName, value.issues);
    }

    return value;
  };
};

/**
 * Internal: turns a value into what is stored: `null` and `undefined` as they are; an instance, or
 * a plain value the type accepts, through `serialize` or its `toJSON()`; any other plain value as
 * it is.
 *
 * @remarks
 * ORMs run the same conversion for values written and for values in query conditions, where a
 * pattern such as `%@example.com` is no valid value of the type and must still reach the query.
 * Entities hold instances, so what is written has been checked.
 */
export const writerOf = (
  target: AnyNominalType,
  serialize: ((value: never) => unknown) | undefined,
): ((value: unknown) => unknown) => {
  const parse = instanceParserFor(target);

  return (value) => {
    if (isNullish(value)) {
      return value;
    }

    const instance = parse(value);

    if (instance instanceof Rejection) {
      return value;
    }

    // The parser gave an instance of `target`, the type `serialize` was declared for.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return serialize === undefined ? storedOf(instance) : serialize(instance as never);
  };
};
