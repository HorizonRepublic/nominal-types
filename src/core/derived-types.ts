import type {
  AnyNominalType,
  Brand,
  Branded,
  BrandsOf,
  InputOf,
  Narrowed,
  NominalInstance,
  NominalSchema,
  NominalType,
  Unbranded,
  ValueOf,
} from './contracts.ts';
import type { StandardProps } from './standard-schema.ts';

declare const impliedBrands: unique symbol;

/**
 * The brands every listed type carries, as one brand.
 *
 * @internal
 */
export type ImpliedBrands<Implied extends AnyNominalType> = (
  Implied extends AnyNominalType ? (brands: BrandsOf<Implied['prototype']>) => void : never
) extends (brands: infer Brands) => void
  ? Brands
  : never;

/**
 * The phantom part of a type class that names the brands its level adds through `implies`, which a
 * variant made from it drops with the type's own brand.
 *
 * @internal
 */
export interface Implying<Names> {
  /**
   * The names of the implied brands. It exists only at compile time.
   */
  readonly [impliedBrands]?: Names;
}

type ImpliedNamesOf<Type> =
  Type extends Implying<infer Names> ? Extract<Names, PropertyKey> : never;

type WithImplied<Brands, Implied extends AnyNominalType> = [Implied] extends [never]
  ? Brands
  : Brands & ImpliedBrands<Implied>;

type OwnImplied<Brands, Implied extends AnyNominalType> = [Implied] extends [never]
  ? never
  : Exclude<keyof ImpliedBrands<Implied>, keyof Brands>;

/**
 * The class `Nominal()` returns: a `NominalType`, whose instances also carry the brands of the
 * types listed in `implies`.
 *
 * @typeParam Name - The type name.
 * @typeParam Schema - The rule of the type's own level.
 * @typeParam Instance - The type of its instances.
 * @typeParam Implied - The types listed in `implies`, or `never` for none.
 */
export type ImplyingType<
  Name extends string,
  Schema extends NominalSchema,
  Instance extends NominalInstance<Name, ValueOf<Schema>>,
  Implied extends AnyNominalType,
> = [Implied] extends [never]
  ? NominalType<Name, Schema, Instance>
  : NominalType<Name, Schema, Instance & Branded<ImpliedBrands<Implied>>> &
      Implying<keyof ImpliedBrands<Implied>>;

/**
 * An instance of a subtype: the parent's instance, with the narrower value and a brand of its own.
 *
 * @typeParam Parent - The type the subtype extends.
 * @typeParam Name - The subtype's name.
 * @typeParam Value - The value type its rule narrows to.
 * @typeParam Implied - The types listed in `implies`, or `never` for none.
 */
export type SubtypeInstance<
  Parent extends AnyNominalType,
  Name extends string,
  Value = ValueOf<Parent['rule']>,
  Implied extends AnyNominalType = never,
> = Narrowed<Parent['prototype'], Value> & Branded<WithImplied<Brand<Name>, Implied>>;

/**
 * The class `subtype` returns: the parent's rules and behaviour, an optional rule of its own, and a
 * brand of its own on top of the parent's, with the brands of the types it implies.
 *
 * @remarks
 * A rule that narrows the value, such as `n.oneOf()`, narrows `value` on the instance too.
 *
 * @typeParam Parent - The type the subtype extends.
 * @typeParam Name - The subtype's name.
 * @typeParam Value - The value type its rule narrows to.
 * @typeParam Implied - The types listed in `implies`, or `never` for none.
 */
export type SubtypeOf<
  Parent extends AnyNominalType,
  Name extends string,
  Value = ValueOf<Parent['rule']>,
  Implied extends AnyNominalType = never,
> = Omit<Parent, 'prototype' | 'typeName' | '~standard' | typeof impliedBrands> &
  Implying<OwnImplied<BrandsOf<Parent['prototype']>, Implied>> & {
    /**
     * Checks the input against the parent's rules and the subtype's own, and makes an instance.
     *
     * @param input - The value to check.
     * @throws {@link NominalError} when the input breaks a rule.
     */
    new (input: InputOf<Parent['rule']>): SubtypeInstance<Parent, Name, Value, Implied>;
    /**
     * The prototype of the instances, which carries their type.
     */
    readonly prototype: SubtypeInstance<Parent, Name, Value, Implied>;
    /**
     * The name the subtype was declared with.
     */
    readonly typeName: Name;
    /**
     * The Standard Schema and Standard JSON Schema properties, typed with the subtype's instances.
     */
    readonly '~standard': StandardProps<
      InputOf<Parent['rule']>,
      SubtypeInstance<Parent, Name, Value, Implied>
    >;
  };

type VariantBrands<Source extends AnyNominalType, Name extends string> = Omit<
  BrandsOf<Source['prototype']>,
  Source['typeName'] | ImpliedNamesOf<Source>
> &
  Brand<Name>;

/**
 * An instance of a variant: the behaviour of the type it was made from, without that type's brand
 * or the brands the type's level implies.
 *
 * @typeParam Source - The type the variant was made from.
 * @typeParam Name - The variant's name.
 * @typeParam Implied - The types listed in `implies`, or `never` for none.
 */
export type VariantInstance<
  Source extends AnyNominalType,
  Name extends string,
  Implied extends AnyNominalType = never,
> = Unbranded<Source['prototype']> & Branded<WithImplied<VariantBrands<Source, Name>, Implied>>;

/**
 * The class `variant` returns: the behaviour of its source, the rules above the source's level,
 * its own rule in place of the source's, and a brand of its own that is not the source's.
 *
 * @remarks
 * A variant sits next to its source rather than below it, so neither passes for the other; moving
 * a value between them goes through `parse`, which checks it against the target's rules.
 *
 * @typeParam Source - The type the variant was made from.
 * @typeParam Name - The variant's name.
 * @typeParam Implied - The types listed in `implies`, or `never` for none.
 */
export type VariantOf<
  Source extends AnyNominalType,
  Name extends string,
  Implied extends AnyNominalType = never,
> = Omit<Source, 'prototype' | 'typeName' | '~standard' | typeof impliedBrands> &
  Implying<OwnImplied<VariantBrands<Source, Name>, Implied>> & {
    /**
     * Checks the input against the rules above the source and the variant's own, and makes an
     * instance.
     *
     * @param input - The value to check.
     * @throws {@link NominalError} when the input breaks a rule.
     */
    new (input: InputOf<Source['rule']>): VariantInstance<Source, Name, Implied>;
    /**
     * The prototype of the instances, which carries their type.
     */
    readonly prototype: VariantInstance<Source, Name, Implied>;
    /**
     * The name the variant was declared with.
     */
    readonly typeName: Name;
    /**
     * The Standard Schema and Standard JSON Schema properties, typed with the variant's instances.
     */
    readonly '~standard': StandardProps<
      InputOf<Source['rule']>,
      VariantInstance<Source, Name, Implied>
    >;
  };
