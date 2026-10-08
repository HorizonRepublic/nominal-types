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

declare const impliedBrands: unique symbol;

/**
 * The brands every listed type carries, as one brand.
 */
export type ImpliedBrands<Implied extends AnyNominalType> = (
  Implied extends AnyNominalType ? (brands: BrandsOf<Implied['prototype']>) => void : never
) extends (brands: infer Brands) => void
  ? Brands
  : never;

/**
 * The phantom part of a type class that names the brands its level adds through `implies`, which a
 * variant made from it drops with the type's own brand.
 */
export interface Implying<Names> {
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
 * The class `subtype` returns: the parent's rules and behaviour, an optional rule of its own, and a
 * brand of its own on top of the parent's, with the brands of the types it implies.
 *
 * @remarks
 * A rule that narrows the value, such as `n.oneOf()`, narrows `value` on the instance too.
 */
export type SubtypeOf<
  Parent extends AnyNominalType,
  Name extends string,
  Value = ValueOf<Parent['rule']>,
  Implied extends AnyNominalType = never,
> = Omit<Parent, 'prototype' | 'typeName' | typeof impliedBrands> &
  Implying<OwnImplied<BrandsOf<Parent['prototype']>, Implied>> & {
    new (
      input: InputOf<Parent['rule']>,
    ): Narrowed<Parent['prototype'], Value> & Branded<WithImplied<Brand<Name>, Implied>>;
    readonly prototype: Narrowed<Parent['prototype'], Value> &
      Branded<WithImplied<Brand<Name>, Implied>>;
    readonly typeName: Name;
  };

type VariantBrands<Source extends AnyNominalType, Name extends string> = Omit<
  BrandsOf<Source['prototype']>,
  Source['typeName'] | ImpliedNamesOf<Source>
> &
  Brand<Name>;

/**
 * An instance of a variant: the behaviour of the type it was made from, without that type's brand
 * or the brands the type's level implies.
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
 */
export type VariantOf<
  Source extends AnyNominalType,
  Name extends string,
  Implied extends AnyNominalType = never,
> = Omit<Source, 'prototype' | 'typeName' | typeof impliedBrands> &
  Implying<OwnImplied<VariantBrands<Source, Name>, Implied>> & {
    new (input: InputOf<Source['rule']>): VariantInstance<Source, Name, Implied>;
    readonly prototype: VariantInstance<Source, Name, Implied>;
    readonly typeName: Name;
  };
