import type { ColumnOptions } from 'typeorm';

import type { AnyNominalType } from '../../core/contracts.ts';
import type { ColumnKind } from '../orm/column.ts';
import { columnKindOf } from '../orm/column.ts';
import type { StorageOptions } from '../orm/values.ts';
import { readerOf, writerOf } from '../orm/values.ts';

/**
 * Options of `toTypeOrm()`: the storage options and any TypeORM column option, such as `nullable`,
 * `unique` or a `type` of your own.
 */
export type TypeOrmOptions<Instance> = StorageOptions<Instance> &
  Omit<ColumnOptions, 'transformer'>;

const simpleColumns: Readonly<
  Record<Exclude<ColumnKind['kind'], 'text' | 'decimal'>, ColumnOptions>
> = {
  uuid: { type: 'uuid' },
  integer: { type: 'integer' },
  bigint: { type: 'bigint' },
  double: { type: 'double precision' },
  boolean: { type: 'boolean' },
  timestamptz: { type: 'timestamptz' },
  date: { type: 'date' },
  time: { type: 'time' },
  timestamp: { type: 'timestamp' },
};

const columnOptions = (column: ColumnKind): ColumnOptions => {
  if (column.kind === 'text') {
    return column.length === undefined
      ? { type: 'text' }
      : { type: 'varchar', length: column.length };
  }

  return column.kind === 'decimal'
    ? { type: 'decimal', precision: column.precision, scale: 0 }
    : simpleColumns[column.kind];
};

/**
 * TypeORM column options for a nominal type, for entity properties that hold instances.
 *
 * @remarks
 * The column comes from the type: `varchar(254)` for `Email`, `uuid` for `Uuid`, `integer` or
 * `bigint` by a number type's bounds, `boolean`; pass `type`, `length` or any other column option
 * to change it. What is stored is the instance's `toJSON()`, or `serialize` of it, also for values
 * in find conditions, where plain values are checked into instances first. Stored values are
 * checked when read, unless `trusted`.
 *
 * @example
 * ```ts
 * @Entity()
 * export class User {
 *   @PrimaryGeneratedColumn() id!: number;
 *   @Column(toTypeOrm(Email)) email!: Email;
 *   @Column(toTypeOrm(Uuid, { nullable: true })) referrer!: Uuid | null;
 * }
 * ```
 */
export const toTypeOrm = <Target extends AnyNominalType>(
  target: Target,
  options: TypeOrmOptions<Target['prototype']> = {},
): ColumnOptions => {
  const { serialize, trusted, ...column } = options;
  const kind = columnKindOf(target);

  return {
    ...columnOptions(kind),
    ...column,
    transformer: {
      to: writerOf(target, serialize),
      from: readerOf(target, kind, trusted === true),
    },
  };
};
