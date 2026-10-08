import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';

import type { AnyNominalType, InputOf, NominalSchema } from '../core/contracts.ts';
import { describeValue } from '../core/messages.ts';
import { isNominalType } from '../core/nominal.ts';
import { isTarget, parseTarget } from '../core/target.ts';
import type { NominalTarget, TargetValue } from '../core/target.ts';
import { attempts, bounded, refusedBy } from './bounded.ts';
import type { GeneratorContext } from './generator-context.ts';
import { nearAndWrong } from './invalid-arbitrary.ts';
import { describeSchema, fieldArbitrary, schemaArbitrary } from './schema-arbitrary.ts';
import { typeArbitrary } from './type-arbitrary.ts';

export type { NominalTarget, TargetValue } from '../core/target.ts';

/**
 * What a target takes as input: the input of a nominal type's rule, or of a schema.
 *
 * @remarks
 * `arbitraryOf()` and `sampleOf()` make values of this type unless `as` is `'instances'`.
 *
 * @typeParam Target - The nominal type or schema whose input it is.
 */
export type TargetInput<Target extends NominalTarget> = InputOf<
  Target extends AnyNominalType ? Target['rule'] : Extract<Target, NominalSchema>
>;

/**
 * How `arbitraryOf()`, `invalidArbitraryOf()` and `sampleOf()` make values.
 *
 * @see {@link SampleOptions}
 */
export interface ArbitraryOptions {
  /**
   * `'inputs'`, the default, makes the plain values the target accepts, such as strings for
   * `Email`; `'instances'` makes what `parse()` gives for them.
   *
   * @defaultValue `'inputs'`
   */
  readonly as?: 'inputs' | 'instances';
  /**
   * Generators of your own, for a nominal type, a schema or a field of another library, used
   * wherever the target holds it.
   *
   * @remarks
   * The key is the nominal type, the schema or the field schema; the value is a fast-check
   * arbitrary of its inputs. Values an override makes are still checked against the target.
   *
   * @defaultValue No generators of your own.
   */
  readonly overrides?: ReadonlyMap<object, Arbitrary<unknown>>;
}

/**
 * What `sampleOf()` takes besides the target and the count.
 *
 * @see {@link ArbitraryOptions}
 */
export interface SampleOptions extends ArbitraryOptions {
  /**
   * The seed of the random generator: the same seed gives the same values on every run.
   *
   * @defaultValue A new random seed on every call.
   */
  readonly seed?: number;
}

type Cache = WeakMap<object, Arbitrary<unknown>>;

interface Caches {
  readonly types: Cache;
  readonly schemas: Cache;
}

const newCaches = (): Caches => ({ types: new WeakMap(), schemas: new WeakMap() });

const shared = newCaches();

const cached = (cache: Cache, key: object, make: () => Arbitrary<unknown>): Arbitrary<unknown> => {
  let arbitrary = cache.get(key);

  if (arbitrary === undefined) {
    arbitrary = make();
    cache.set(key, arbitrary);
  }

  return arbitrary;
};

const contextFor = (overrides: ReadonlyMap<object, Arbitrary<unknown>>): GeneratorContext => {
  const { types, schemas } = overrides.size === 0 ? shared : newCaches();
  const context: GeneratorContext = {
    overrides,
    ofType: (type) => cached(types, type, () => typeArbitrary(type, context)),
    ofSchema: (schema) => cached(schemas, schema, () => schemaArbitrary(schema, context)),
    ofField: (field, key) => fieldArbitrary(field, key, context),
  };

  return context;
};

const checkedTarget = (method: string, target: unknown): NominalTarget => {
  if (!isTarget(target)) {
    throw new TypeError(
      `${method}() takes a nominal type or a schema built by n.of(), n.object() or n.union() (was ${describeValue(target)})`,
    );
  }

  return target;
};

const inputsOf = (target: NominalTarget, options: ArbitraryOptions): Arbitrary<unknown> => {
  const context = contextFor(options.overrides ?? new Map());

  return isNominalType(target) ? context.ofType(target) : context.ofSchema(target);
};

const valuesOf = (
  method: string,
  target: unknown,
  options: ArbitraryOptions,
): Arbitrary<unknown> => {
  const checked = checkedTarget(method, target);
  const inputs = inputsOf(checked, options);

  return options.as === 'instances' ? instancesOf(checked, inputs) : inputs;
};

const instancesOf = (target: NominalTarget, inputs: Arbitrary<unknown>): Arbitrary<unknown> =>
  bounded(
    inputs.map((input) => parseTarget(target, input)),
    (result) => result.ok,
    refusedBy(describeSchema(target)),
  ).map((result): unknown => Reflect.get(result, 'value'));

/**
 * A fast-check arbitrary of valid values for a nominal type or a schema, for property tests that
 * run code on every kind of value the type allows rather than on a few hand-picked ones.
 *
 * @remarks
 * Built-in types have generators that cover their whole range, edges included. A type of your
 * own is generated from the closest thing it declares: a type it builds on, its pattern, its
 * `n.oneOf()` values, its JSON Schema or its examples, and every value is checked with
 * `accepts()`. Arrays keep their counts, objects their optional fields and constraints, unions
 * their tags. A constructor of your own is not run, so a type whose constructor refuses more
 * than its rules can get values `parse()` refuses.
 *
 * When nothing can be generated for a type, pass a generator of your own in `overrides`.
 *
 * @typeParam Target - The nominal type or schema to make values of.
 * @param target - A nominal type, or a schema built by `n.of()`, `n.object()` or `n.union()`.
 * @param options - Whether to make inputs or instances, and generators of your own.
 * @returns An arbitrary of inputs the target accepts, or of instances with `as: 'instances'`.
 * @throws {@link TypeError} when the target is not a nominal type or a schema of this package.
 * @throws {@link TypeError} when nothing can be generated for the target or one of its fields.
 *
 * @example
 * ```ts
 * import fc from 'fast-check';
 * import { Email } from '@horizon-republic/nominal-types';
 * import { arbitraryOf } from '@horizon-republic/nominal-types/testing';
 *
 * fc.assert(fc.property(arbitraryOf(Email), (text) => Email.parse(text).ok));
 * ```
 *
 * @see {@link invalidArbitraryOf}
 * @see {@link sampleOf}
 */
export function arbitraryOf<const Target extends NominalTarget>(
  target: Target,
  options: ArbitraryOptions & {
    /**
     * Makes what `parse()` gives for the inputs.
     */
    readonly as: 'instances';
  },
): Arbitrary<TargetValue<Target>>;
export function arbitraryOf<const Target extends NominalTarget>(
  target: Target,
  options?: ArbitraryOptions & {
    /**
     * Makes the plain values the target accepts.
     *
     * @defaultValue `'inputs'`
     */
    readonly as?: 'inputs';
  },
): Arbitrary<TargetInput<Target>>;
export function arbitraryOf(target: unknown, options: ArbitraryOptions = {}): Arbitrary<unknown> {
  return valuesOf('arbitraryOf', target, options);
}

/**
 * A fast-check arbitrary of values a nominal type or a schema refuses, for tests of the code
 * that handles the refusal.
 *
 * @remarks
 * The values are valid ones changed a little, by kind: text with a character added, removed or
 * its case changed, numbers moved past a bound or made fractional, lists a size off or with a bad
 * item, objects with a field missing, changed or added. Values of the wrong kind, such as `null`
 * or a number for a string type, come in between. Each one is checked to fail `accepts()`.
 *
 * Drawing from the arbitrary throws an `Error` when the target accepts nearly every value made
 * for it, since there is too little it refuses to generate from.
 *
 * @param target - A nominal type, or a schema built by `n.of()`, `n.object()` or `n.union()`.
 * @param options - Generators of your own for the valid values the refused ones are made from.
 * @returns An arbitrary of values the target refuses.
 * @throws {@link TypeError} when the target is not a nominal type or a schema of this package.
 * @throws {@link TypeError} when nothing can be generated for the target or one of its fields.
 *
 * @example
 * ```ts
 * import fc from 'fast-check';
 * import { Email } from '@horizon-republic/nominal-types';
 * import { invalidArbitraryOf } from '@horizon-republic/nominal-types/testing';
 *
 * fc.assert(fc.property(invalidArbitraryOf(Email), (value) => !Email.parse(value).ok));
 * ```
 *
 * @see {@link arbitraryOf}
 */
export const invalidArbitraryOf = (
  target: NominalTarget,
  options: Pick<ArbitraryOptions, 'overrides'> = {},
): Arbitrary<unknown> => {
  const checked = checkedTarget('invalidArbitraryOf', target);
  const accepts = (value: unknown): boolean => checked.accepts(value);

  return bounded(
    nearAndWrong(inputsOf(checked, options)),
    (value) => !accepts(value),
    `invalidArbitraryOf(): ${describeSchema(checked)} accepted ${attempts} changed values in a row, so there is too little it refuses to generate from`,
  );
};

/**
 * Valid values of a nominal type or a schema, ready to use as test fixtures.
 *
 * @remarks
 * Ten values unless `count` says otherwise. Pass a `seed` to get the same values on every run.
 *
 * @typeParam Target - The nominal type or schema to make values of.
 * @param target - A nominal type, or a schema built by `n.of()`, `n.object()` or `n.union()`.
 * @param count - How many values to make; `undefined` makes ten.
 * @param options - Whether to make inputs or instances, the seed, and generators of your own.
 * @returns The values: inputs the target accepts, or instances with `as: 'instances'`.
 * @throws {@link TypeError} when the target is not a nominal type or a schema of this package.
 * @throws {@link TypeError} when nothing can be generated for the target or one of its fields.
 * @throws {@link Error} when the target refuses nearly every value made for it.
 *
 * @example
 * ```ts
 * import { Email, n, PositiveInteger } from '@horizon-republic/nominal-types';
 * import { sampleOf } from '@horizon-republic/nominal-types/testing';
 *
 * const CreateOrder = n.object({ contact: Email, quantity: PositiveInteger });
 *
 * const emails = sampleOf(Email, 3, { seed: 42 });
 * const orders = sampleOf(CreateOrder, 5, { as: 'instances' });
 * ```
 *
 * @see {@link arbitraryOf}
 */
export function sampleOf<const Target extends NominalTarget>(
  target: Target,
  count: number | undefined,
  options: SampleOptions & {
    /**
     * Makes what `parse()` gives for the inputs.
     */
    readonly as: 'instances';
  },
): Array<TargetValue<Target>>;
export function sampleOf<const Target extends NominalTarget>(
  target: Target,
  count?: number,
  options?: SampleOptions & {
    /**
     * Makes the plain values the target accepts.
     *
     * @defaultValue `'inputs'`
     */
    readonly as?: 'inputs';
  },
): Array<TargetInput<Target>>;
export function sampleOf(
  target: NominalTarget,
  count: number = 10,
  options: SampleOptions = {},
): unknown[] {
  const { seed } = options;
  const arbitrary = valuesOf('sampleOf', target, options);

  return fc.sample(arbitrary, { numRuns: count, ...(seed === undefined ? {} : { seed }) });
}
