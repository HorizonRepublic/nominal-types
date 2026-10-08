import { Type } from '@mikro-orm/core';
import type { EntityProperty, Platform, TransformContext } from '@mikro-orm/core';

import type { AnyNominalType } from '../../core/contracts.ts';
import type { ColumnKind } from '../orm/column.ts';
import { columnKindOf } from '../orm/column.ts';
import type { StorageOptions } from '../orm/values.ts';
import { readerOf, writerOf } from '../orm/values.ts';

/**
 * Options of `toMikroOrm()`.
 *
 * @typeParam Instance - The instance the column holds.
 *
 * @see {@link toMikroOrm}
 */
export interface MikroOrmOptions<Instance> extends StorageOptions<Instance> {
  /**
   * The SQL type of the column, in place of the one the type gives by default.
   *
   * @defaultValue The column the type gives, such as `varchar(254)` for `Email`.
   */
  readonly column?: string;
}

/**
 * The MikroORM type class `toMikroOrm()` returns.
 *
 * @typeParam Target - The nominal type the column holds.
 */
export type MikroOrmType<Target extends AnyNominalType> = new () => Type<
  Target['prototype'] | null | undefined,
  unknown
>;

const columnSql = (column: ColumnKind, prop: EntityProperty, platform: Platform): string => {
  if (column.kind === 'text') {
    const length = prop.length ?? column.length;

    return length === undefined
      ? platform.getTextTypeDeclarationSQL(prop)
      : platform.getVarcharTypeDeclarationSQL({ length });
  }

  if (column.kind === 'decimal') {
    return platform.getDecimalTypeDeclarationSQL({ precision: column.precision, scale: 0 });
  }

  const simple: Readonly<Record<Exclude<ColumnKind['kind'], 'text' | 'decimal'>, () => string>> = {
    numeric: () => 'numeric',
    json: () => platform.getJsonDeclarationSQL(),
    uuid: () => platform.getUuidTypeDeclarationSQL(prop),
    integer: () => platform.getIntegerTypeDeclarationSQL(prop),
    bigint: () => platform.getBigIntTypeDeclarationSQL(prop),
    double: () => platform.getDoubleDeclarationSQL(),
    boolean: () => platform.getBooleanTypeDeclarationSQL(),
    timestamptz: () => platform.getDateTimeTypeDeclarationSQL({ length: 6 }),
    date: () => platform.getDateTypeDeclarationSQL(),
    time: () => platform.getTimeTypeDeclarationSQL(6),
    // PostgreSQL's date-time is `timestamptz`; the other dialects have no zone in theirs.
    timestamp: () =>
      platform.getDateTimeTypeDeclarationSQL({ length: 6 }).replace('timestamptz', 'timestamp'),
  };

  return simple[column.kind]();
};

const comparedAs = (column: ColumnKind): string => {
  if (column.kind === 'integer' || column.kind === 'double') {
    return 'number';
  }

  return column.kind === 'boolean' ? 'boolean' : 'string';
};

/**
 * A MikroORM type for a nominal type, for entity properties that hold instances.
 *
 * @remarks
 * The column comes from the type: `varchar(254)` for `Email`, `uuid` for `Uuid`, `integer` or
 * `bigint` by a number type's bounds, `boolean`, `numeric` for `DecimalString`, the platform's JSON
 * column for `Money` and other types whose values are objects; pass `column` for another. What is
 * stored is the instance's `toJSON()`, or `serialize` of it, also for values in query conditions,
 * where plain values are checked into instances first. Stored values are checked when read, unless
 * `trusted`.
 *
 * @typeParam Target - The nominal type the column holds.
 * @param target - The nominal type of the entity property.
 * @param options - The storage options and the SQL type of the column.
 * @returns A MikroORM type class to pass to `p.type()` or a property's `type`.
 *
 * @example
 * ```ts
 * import { Email } from '@horizon-republic/nominal-types';
 * import { toMikroOrm } from '@horizon-republic/nominal-types/adapters/mikro-orm';
 * import { defineEntity } from '@mikro-orm/core';
 *
 * const User = defineEntity({
 *   name: 'User',
 *   properties: (p) => ({
 *     id: p.integer().primary(),
 *     email: p.type(toMikroOrm(Email)),
 *   }),
 * });
 * ```
 */
export const toMikroOrm = <Target extends AnyNominalType>(
  target: Target,
  options: MikroOrmOptions<Target['prototype']> = {},
): MikroOrmType<Target> => {
  const column = columnKindOf(target);
  const read = readerOf(target, column, options.trusted === true);
  const write = writerOf(target, options.serialize);

  class NominalType extends Type<Target['prototype'] | null | undefined, unknown> {
    public override convertToDatabaseValue(
      value: unknown,
      platform: Platform,
      context?: TransformContext,
    ): unknown {
      const stored = write(value);

      return column.kind === 'json' && typeof stored === 'object' && stored !== null
        ? platform.convertJsonToDatabaseValue(stored, context)
        : stored;
    }

    public override convertToJSValue(value: unknown): Target['prototype'] | null | undefined {
      // The reader gives an instance of `target`, or the null it was given.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return read(value) as Target['prototype'] | null | undefined;
    }

    public override getColumnType(prop: EntityProperty, platform: Platform): string {
      return options.column ?? columnSql(column, prop, platform);
    }

    public override compareAsType(): string {
      return comparedAs(column);
    }
  }

  Object.defineProperty(NominalType, 'name', { value: `${target.typeName}Type` });

  return NominalType;
};
