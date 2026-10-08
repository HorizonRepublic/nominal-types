import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';

import type { AnyNominalType } from '../core/contracts.ts';
import { isNominalType } from '../core/nominal.ts';
import { isTypeSchema } from '../core/type-schema.ts';
import { bounded, refusedBy } from './bounded.ts';
import { builtInArbitrary } from './built-ins.ts';
import type { GeneratorContext } from './generator-context.ts';
import { arbitraryFromJson, matchingPattern } from './json-arbitrary.ts';
import { ownRuleJson, propertyOf } from './properties.ts';

const probeRuns = 40;
const goodShare = 0.25;

// The share of a sample the type accepts; a generator that throws makes nothing usable.
const acceptedShare = (
  arbitrary: Arbitrary<unknown>,
  accepts: (value: unknown) => boolean,
): number => {
  try {
    const values = fc.sample(arbitrary, { numRuns: probeRuns, seed: 1 });

    return values.filter((value) => accepts(value)).length / probeRuns;
  } catch {
    return 0;
  }
};

// The class and every class above it, up to the root, which no generator serves.
const levelsOf = (type: AnyNominalType): object[] => {
  const levels: object[] = [];

  for (let level: unknown = type; isNominalType(level); level = Object.getPrototypeOf(level)) {
    levels.push(level);
  }

  return levels;
};

const isList = (value: unknown): value is readonly unknown[] =>
  Array.isArray(value) && value.length > 0;

const ownRuleOf = (level: object): unknown =>
  Object.hasOwn(level, 'rule') ? Reflect.get(level, 'rule') : undefined;

// What a level offers to generate from, the most specific first: a built-in generator, its
// pattern, its list of values, then whatever its JSON Schema says.
const candidatesOf = (
  level: object,
  type: AnyNominalType,
): Array<() => Arbitrary<unknown> | undefined> => {
  const rule = ownRuleOf(level);
  const pattern = propertyOf(rule, 'pattern');
  const values = propertyOf(rule, 'values');

  return [
    () => builtInArbitrary(level, type),
    () => (pattern instanceof RegExp ? matchingPattern(pattern) : undefined),
    () => (isList(values) ? fc.constantFrom(...values) : undefined),
    () => arbitraryFromJson(ownRuleJson(level)),
  ];
};

const examplesOf = (type: AnyNominalType): unknown[] => {
  try {
    const examples: unknown = type['~standard'].jsonSchema.input({ target: 'draft-2020-12' })[
      'examples'
    ];

    return Array.isArray(examples) ? examples : [];
  } catch {
    return [];
  }
};

const noGenerator = (type: AnyNominalType): TypeError =>
  new TypeError(
    `arbitraryOf(): no generator makes values of ${type.typeName}: its rules give no pattern, list of values or JSON Schema to generate from, and it has no examples. Pass a generator of your own: { overrides: new Map([[${type.typeName.split('.').at(-1) ?? ''}, arbitrary]]) }`,
  );

/**
 * Internal: values a nominal type accepts, as its input.
 *
 * @remarks
 * The levels are tried from the type up: a generator passed for a level or a schema the level is
 * built on is taken as it is, and any other candidate is sampled first and taken once the type
 * accepts a quarter of what it makes. Failing that, the candidate the type accepted most of, then
 * the examples of its JSON Schema.
 */
export const typeArbitrary = (
  type: AnyNominalType,
  context: GeneratorContext,
): Arbitrary<unknown> => {
  const accepts = (value: unknown): boolean => type.accepts(value);
  let best: { readonly arbitrary: Arbitrary<unknown>; readonly share: number } | undefined;

  for (const level of levelsOf(type)) {
    const override = context.overrides.get(level);
    const rule = ownRuleOf(level);

    if (override !== undefined) {
      return bounded(override, accepts, refusedBy(type.typeName));
    }

    for (const candidate of candidatesOf(level, type)) {
      const arbitrary = candidate();
      const share = arbitrary === undefined ? 0 : acceptedShare(arbitrary, accepts);

      if (arbitrary !== undefined && share >= goodShare) {
        return bounded(arbitrary, accepts, refusedBy(type.typeName));
      }

      if (arbitrary !== undefined && share > (best?.share ?? 0)) {
        best = { arbitrary, share };
      }

      // A level built on a schema takes it once its built-in generator, if any, is tried.
      if (isTypeSchema(rule)) {
        return bounded(context.ofSchema(rule), accepts, refusedBy(type.typeName));
      }
    }
  }

  if (best !== undefined) {
    return bounded(best.arbitrary, accepts, refusedBy(type.typeName));
  }

  const examples = examplesOf(type).filter((example) => accepts(example));

  if (examples.length === 0) {
    throw noGenerator(type);
  }

  return fc.constantFrom(...examples);
};
