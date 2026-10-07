import { DataTypes } from 'sequelize';
import type { DataType, Model, ModelAttributeColumnOptions } from 'sequelize';

import type { AnyNominalType } from '../../core/contracts.ts';
import type { ColumnKind } from '../orm/column.ts';
import { columnKindOf } from '../orm/column.ts';
import type { StorageOptions } from '../orm/values.ts';
import { readerOf, writerOf } from '../orm/values.ts';

/**
 * Options of `toSequelize()`: the storage options and any Sequelize attribute option, such as
 * `allowNull`, `unique`, `field` or a `type` of your own.
 */
export type SequelizeOptions<Instance> = StorageOptions<Instance> &
  Partial<Omit<ModelAttributeColumnOptions, 'get' | 'set'>>;

const simpleTypes: Readonly<Record<Exclude<ColumnKind['kind'], 'text' | 'decimal'>, DataType>> = {
  uuid: DataTypes.UUID,
  integer: DataTypes.INTEGER,
  bigint: DataTypes.BIGINT,
  double: DataTypes.DOUBLE,
  boolean: DataTypes.BOOLEAN,
  timestamptz: DataTypes.DATE,
  date: DataTypes.DATEONLY,
  time: DataTypes.TIME,
  timestamp: 'TIMESTAMP',
};

const dataTypeOf = (column: ColumnKind): DataType => {
  if (column.kind === 'text') {
    return column.length === undefined ? DataTypes.TEXT : DataTypes.STRING(column.length);
  }

  return column.kind === 'decimal'
    ? DataTypes.DECIMAL(column.precision, 0)
    : simpleTypes[column.kind];
};

/**
 * A Sequelize attribute for a nominal type, for models whose attributes hold instances.
 *
 * @remarks
 * The column comes from the type: `STRING(254)` for `Email`, `UUID` for `Uuid`, `INTEGER` or
 * `BIGINT` by a number type's bounds, `BOOLEAN`; pass `type` for another. Setting the attribute
 * stores the instance's `toJSON()`, or `serialize` of it; reading it gives an instance, checked
 * unless `trusted`. Sequelize doesn't run attribute setters on `where` values: compare with what
 * is stored, such as `email.value`.
 *
 * @example
 * ```ts
 * User.init(
 *   {
 *     email: toSequelize(Email),
 *     referrer: toSequelize(Uuid, { allowNull: true }),
 *   },
 *   { sequelize },
 * );
 * ```
 */
export const toSequelize = <Target extends AnyNominalType>(
  target: Target,
  options: SequelizeOptions<Target['prototype']> = {},
): ModelAttributeColumnOptions => {
  const { serialize, trusted, type, ...attribute } = options;
  const column = columnKindOf(target);
  const read = readerOf(target, column, trusted === true);
  const write = writerOf(target, serialize);

  return {
    ...attribute,
    type: type ?? dataTypeOf(column),
    // Sequelize calls attribute getters with the attribute's name, and setters with it second.
    get(this: Model, key?: string): unknown {
      const raw: unknown = this.getDataValue(String(key));

      return read(raw);
    },
    set(this: Model, value: unknown, key?: string): void {
      this.setDataValue(String(key), write(value));
    },
  };
};
