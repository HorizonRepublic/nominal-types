import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';

import { codeArbitraries } from './built-in-codes.ts';
import { grammarArbitraries } from './built-in-grammars.ts';
import { networkArbitraries } from './built-in-network.ts';
import { numberArbitraries } from './built-in-numbers.ts';
import { temporalArbitraries } from './built-in-temporal.ts';
import { textArbitraries } from './built-in-text.ts';
import { valueArbitraries } from './built-in-values.ts';
import { arbitraryFromJson } from './json-arbitrary.ts';
import { callOf, ownRuleJson, propertyOf } from './properties.ts';

// Types whose rule states its whole grammar in JSON Schema, as a pattern or a list.
const fromGrammar = (level: object): Arbitrary<unknown> | undefined =>
  arbitraryFromJson(ownRuleJson(level));

const grammarTypes: Readonly<Record<string, (level: object) => Arbitrary<unknown> | undefined>> = {
  'nominal.CountryCode': fromGrammar,
  'nominal.CurrencyCode': fromGrammar,
  'nominal.HexColor': fromGrammar,
  'nominal.MacAddress': fromGrammar,
  'nominal.ObjectId': fromGrammar,
  'nominal.Ulid': fromGrammar,
};

const temporalClasses: Readonly<Record<string, string>> = {
  'nominal.Instant': 'Instant',
  'nominal.PlainDate': 'PlainDate',
  'nominal.PlainDateTime': 'PlainDateTime',
  'nominal.PlainTime': 'PlainTime',
};

const temporalFrom = (className: string): ((text: string) => unknown) | undefined => {
  const temporalClass = propertyOf(propertyOf(globalThis, 'Temporal'), className);

  return typeof propertyOf(temporalClass, 'from') === 'function'
    ? (text) => callOf(temporalClass, 'from', text)
    : undefined;
};

// The text the pattern describes, and, where the runtime has Temporal, a Temporal object made
// from that text as well.
const fromTemporalText = (level: object, className: string): Arbitrary<unknown> | undefined => {
  const texts = fromGrammar(level);
  const from = temporalFrom(className);

  if (texts === undefined || from === undefined) {
    return texts;
  }

  return fc
    .tuple(texts, fc.boolean())
    .map(([text, asObject]) => (asObject && typeof text === 'string' ? from(text) : text));
};

const fixed: Readonly<Record<string, () => Arbitrary<unknown>>> = {
  ...grammarArbitraries,
  ...numberArbitraries,
  ...networkArbitraries,
  ...textArbitraries,
  ...codeArbitraries,
};

/**
 * Internal: the generator of a built-in type, found by the name the class at this level declares,
 * or `undefined` for a type that is not built in.
 */
export const builtInArbitrary = (
  level: object,
  target: object = level,
): Arbitrary<unknown> | undefined => {
  const name: unknown = Object.hasOwn(level, 'typeName')
    ? Reflect.get(level, 'typeName')
    : undefined;

  if (typeof name !== 'string' || !name.startsWith('nominal.')) {
    return undefined;
  }

  const reading = valueArbitraries[name];

  if (reading !== undefined) {
    return reading(level, target);
  }

  const make = fixed[name];

  if (make !== undefined) {
    return make();
  }

  const temporal = temporalArbitraries[name]?.();

  if (temporal !== undefined) {
    return temporal;
  }

  const className = temporalClasses[name];

  if (className !== undefined) {
    return fromTemporalText(level, className);
  }

  return grammarTypes[name]?.(level);
};
