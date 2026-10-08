import type { AnyNominalType } from '../../core/contracts.ts';
import type { ColumnKind } from '../orm/column.ts';
import { columnKindOf } from '../orm/column.ts';
import type { StorageOptions } from '../orm/values.ts';
import { jsonTextOf, readerOf, writerOf } from '../orm/values.ts';

/**
 * Options of `toDrizzle()`.
 *
 * @typeParam Instance - The instance the column holds.
 *
 * @see {@link toDrizzle}
 */
export interface DrizzleOptions<Instance> extends StorageOptions<Instance> {
  /**
   * The SQL type of the column, in place of the one the type gives by default.
   *
   * @defaultValue The column the type gives, such as `varchar(254)` for `Email`.
   */
  readonly column?: string;
}

/**
 * The type argument of Drizzle's `customType` for a column holding a nominal type.
 *
 * @typeParam Target - The nominal type the column holds.
 *
 * @see {@link toDrizzle}
 */
export interface DrizzleColumn<Target extends AnyNominalType> {
  /**
   * The value the column gives and takes in your code: an instance of the type.
   */
  data: Target['prototype'];

  /**
   * The value the driver reads and writes.
   */
  driverData: unknown;
}

/**
 * What `toDrizzle()` returns: the parameters of Drizzle's `customType` for any dialect.
 *
 * @typeParam Target - The nominal type the column holds.
 *
 * @see {@link toDrizzle}
 */
export interface DrizzleParams<Target extends AnyNominalType> {
  /**
   * Gives the SQL type of the column.
   */
  readonly dataType: () => string;

  /**
   * Turns an instance, or a plain value in a condition, into what is stored.
   */
  readonly toDriver: (value: Target['prototype']) => unknown;

  /**
   * Turns a stored value into an instance, checked unless `trusted`. It throws a
   * {@link NominalError} for a stored value the type doesn't accept.
   */
  readonly fromDriver: (value: unknown) => Target['prototype'];
}

const sqlTypes: Readonly<Record<Exclude<ColumnKind['kind'], 'text' | 'decimal'>, string>> = {
  numeric: 'numeric',
  json: 'json',
  uuid: 'uuid',
  integer: 'integer',
  bigint: 'bigint',
  double: 'double precision',
  boolean: 'boolean',
  timestamptz: 'timestamptz',
  date: 'date',
  time: 'time',
  timestamp: 'timestamp',
};

const sqlTypeOf = (column: ColumnKind): string => {
  if (column.kind === 'text') {
    return column.length === undefined ? 'text' : `varchar(${String(column.length)})`;
  }

  return column.kind === 'decimal'
    ? `decimal(${String(column.precision)}, 0)`
    : sqlTypes[column.kind];
};

/**
 * The parameters of a Drizzle custom column for a nominal type, for tables whose columns hold
 * instances.
 *
 * @remarks
 * Pass them to the `customType` of your dialect, with `DrizzleColumn` as its type argument. The
 * column comes from the type: `varchar(254)` for `Email`, `uuid` for `Uuid`, `integer` or `bigint`
 * by a number type's bounds, `boolean`, `numeric` for `DecimalString`, `json` for `Money` and other
 * types whose values are objects; pass `column` for another, such as `char(36)` for a UUID on
 * MySQL. Booleans are written as `1` and `0`, which every dialect takes, and JSON as text. What is
 * stored is the instance's `toJSON()`, or `serialize` of it, also for values in conditions, where
 * plain values the type refuses, such as a `like` pattern, pass as they are. Stored values are
 * checked when read, unless `trusted`.
 *
 * @typeParam Target - The nominal type the column holds.
 * @param target - The nominal type of the column.
 * @param options - The storage options and the SQL type of the column.
 * @returns The parameters to pass to Drizzle's `customType`.
 *
 * @example
 * ```ts
 * import { Email } from '@horizon-republic/nominal-types';
 * import { toDrizzle } from '@horizon-republic/nominal-types/adapters/drizzle';
 * import type { DrizzleColumn } from '@horizon-republic/nominal-types/adapters/drizzle';
 * import { customType, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
 *
 * const email = customType<DrizzleColumn<typeof Email>>(toDrizzle(Email));
 *
 * export const users = sqliteTable('users', {
 *   id: integer('id').primaryKey(),
 *   email: email('email').notNull(),
 * });
 * ```
 */
export const toDrizzle = <Target extends AnyNominalType>(
  target: Target,
  options: DrizzleOptions<Target['prototype']> = {},
): DrizzleParams<Target> => {
  const column = columnKindOf(target);
  const read = readerOf(target, column, options.trusted === true);
  const write = writerOf(target, options.serialize);
  const sql = options.column ?? sqlTypeOf(column);

  return {
    dataType: () => sql,
    toDriver: (value) => {
      const stored = write(value);

      if (column.kind === 'json') {
        return jsonTextOf(stored);
      }

      return typeof stored === 'boolean' ? Number(stored) : stored;
    },
    // The reader gives an instance of `target` for any stored value it accepts.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    fromDriver: (value) => read(value) as Target['prototype'],
  };
};
