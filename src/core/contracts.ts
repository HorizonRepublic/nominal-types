import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

import type { StandardProps, StandardSchema } from './standard-schema.ts';

declare const brand: unique symbol;

/**
 * The phantom marker that keeps two nominal types apart even when they wrap the same value.
 *
 * @remarks
 * Each name becomes a key, so a subtype carries its own key and every key of the type it
 * refines: it is assignable to its parent, while the parent is not assignable to it.
 */
export type Brand<Name extends string> = Readonly<Record<Name, true>>;

/**
 * The schema a nominal type validates with: any Standard Schema whose `validate` answers
 * synchronously.
 *
 * @remarks
 * A schema that also carries a Standard JSON Schema converter lets the nominal type describe
 * itself to OpenAPI and documentation generators.
 */
export interface NominalSchema<Input = unknown, Value = unknown> {
  readonly '~standard': StandardSchemaV1.Props<Input, Value> & {
    readonly jsonSchema?: StandardJSONSchemaV1.Converter | undefined;
  };
}

/**
 * The input type a schema accepts.
 */
export type InputOf<Schema extends NominalSchema> = NonNullable<
  Schema['~standard']['types']
>['input'];

/**
 * The value type a schema produces.
 */
export type ValueOf<Schema extends NominalSchema> = NonNullable<
  Schema['~standard']['types']
>['output'];

/**
 * The outcome of `parse`: the constructed instance, or the issues that prevented it.
 */
export type Parsed<Instance> =
  | { readonly ok: true; readonly value: Instance }
  | { readonly ok: false; readonly issues: readonly StandardSchemaV1.Issue[] };

/**
 * What every nominal value offers, whatever type it belongs to.
 */
export interface NominalInstance<Name extends string, Value> {
  readonly [brand]: Brand<Name>;
  readonly value: Value;
  equals(other: unknown): boolean;
  toJSON(): Value;
  toString(): string;
}

/**
 * Any nominal type class, for code that accepts nominal types generically, such as adapters.
 */
export interface AnyNominalType {
  readonly prototype: NominalInstance<string, unknown>;
  readonly typeName: string;
  readonly schema: NominalSchema;
  readonly '~standard': StandardProps<unknown, NominalInstance<string, unknown>>;
  parse<Type extends AnyNominalType>(this: Type, input: unknown): Parsed<Type['prototype']>;
  is<Type extends AnyNominalType>(this: Type, value: unknown): value is Type['prototype'];
  standard<Type extends AnyNominalType>(
    this: Type,
  ): StandardSchema<InputOf<Type['schema']>, Type['prototype']>;
}

/**
 * A nominal type class: construct it with `new`, which validates, or go through `parse` and `is`
 * where bad input is expected.
 *
 * @remarks
 * The class is a Standard Schema and a Standard JSON Schema through its static `~standard`, so
 * consumers that call `~standard` accept the class itself. Consumers that parse definitions treat
 * any function as their own construct, and take the plain object `standard()` returns instead.
 */
export interface NominalType<
  Name extends string,
  Schema extends NominalSchema,
  Instance extends NominalInstance<Name, ValueOf<Schema>> = NominalInstance<Name, ValueOf<Schema>>,
> extends AnyNominalType {
  new (input: InputOf<Schema>): Instance;
  readonly prototype: Instance;
  readonly typeName: Name;
  readonly schema: Schema;
  readonly '~standard': StandardProps<InputOf<Schema>, Instance>;
  subtype<Type extends AnyNominalType, const SubtypeName extends string>(
    this: Type,
    name: SubtypeName,
    stricter: (
      schema: Type['schema'],
    ) => NominalSchema<InputOf<Type['schema']>, ValueOf<Type['schema']>>,
  ): SubtypeOf<Type, SubtypeName>;
}

/**
 * The class `refine` returns: the parent type with a stricter schema and a brand of its own.
 */
export type SubtypeOf<Parent extends AnyNominalType, Name extends string> = Omit<
  Parent,
  'prototype' | 'typeName'
> & {
  new (input: InputOf<Parent['schema']>): Parent['prototype'] & { readonly [brand]: Brand<Name> };
  readonly prototype: Parent['prototype'] & { readonly [brand]: Brand<Name> };
  readonly typeName: Name;
};
