import type { ColumnOptions } from 'typeorm';

import type { AnyNominalType } from '../../core/contracts.ts';
import type { ColumnKind } from '../orm/column.ts';
import { columnKindOf } from '../orm/column.ts';
import type { StorageOptions } from '../orm/values.ts';
import { jsonTextOf, readerOf, writerOf } from '../orm/values.ts';

/**
 * Options of `toTypeOrm()`: the storage options and any TypeORM column option, such as `nullable`,
 * `unique` or a `type` of your own.
 *
 * @typeParam Instance - The instance the column holds.
 *
 * @see {@link toTypeOrm}
 */
export type TypeOrmOptions<Instance> = StorageOptions<Instance> &
  Omit<ColumnOptions, 'transformer'>;

const simpleColumns: Readonly<
  Record<Exclude<ColumnKind['kind'], 'text' | 'decimal'>, ColumnOptions>
> = {
  numeric: { type: 'numeric' },
  json: { type: 'simple-json' },
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

const jsonColumns = new Set(['simple-json', 'json', 'jsonb']);

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
 * `bigint` by a number type's bounds, `boolean`, `numeric` for `DecimalString`, `simple-json` for
 * `Money` and other types whose values are objects; pass `type`, `length` or any other column
 * option to change it. What is stored is the instance's `toJSON()`, or `serialize` of it, also for
 * values in find conditions, where plain values are checked into instances first. Stored values are
 * checked when read, unless `trusted`.
 *
 * @typeParam Target - The nominal type the column holds.
 * @param target - The nominal type of the entity property.
 * @param options - The storage options and any TypeORM column option.
 * @returns Column options to pass to TypeORM's `@Column()`.
 *
 * @example
 * ```ts
 * import { Email, Uuid } from '@horizon-republic/nominal-types';
 * import { toTypeOrm } from '@horizon-republic/nominal-types/adapters/typeorm';
 * import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
 *
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
  const chosen = { ...columnOptions(kind), ...column };
  const write = writerOf(target, serialize);
  // TypeORM writes JSON itself for its JSON columns; a text column chosen for one takes JSON text.
  const asText = kind.kind === 'json' && !jsonColumns.has(String(chosen.type));

  return {
    ...chosen,
    transformer: {
      to: asText ? (value: unknown) => jsonTextOf(write(value)) : write,
      from: readerOf(target, kind, trusted === true),
    },
  };
};
