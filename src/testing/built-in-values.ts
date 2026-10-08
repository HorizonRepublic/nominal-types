import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';

import { partsOf } from '../core/schema-parts.ts';
import { alphabets, characters } from './characters.ts';
import { ownRuleJson, propertyOf } from './properties.ts';

const { digits } = alphabets;

const sign = fc.constantFrom('', '', '-');

const integerPart = fc.oneof(
  fc.constant('0'),
  fc.tuple(characters('123456789', 1), characters(digits, 0, 20)).map((parts) => parts.join('')),
);

const decimalOf = (fraction: Arbitrary<string>): Arbitrary<string> =>
  fc
    .tuple(sign, integerPart, fraction)
    .map(([minus, integer, part]) => `${minus}${integer}${part === '' ? '' : `.${part}`}`);

// The longest text, 100 characters: a sign, 49 digits, a point and 49 more.
const longestDecimal = fc
  .tuple(characters('123456789', 1), characters(digits, 48), characters(digits, 49))
  .map(([first, integer, fraction]) => `-${first}${integer}.${fraction}`);

const decimalString: Arbitrary<string> = fc.oneof(
  { arbitrary: decimalOf(characters(digits, 0, 20)), weight: 20 },
  { arbitrary: longestDecimal, weight: 1 },
);

const typeIdAlphabet = '0123456789abcdefghjkmnpqrstvwxyz';

const typeIdSuffix = fc
  .tuple(characters('01234567', 1), characters(typeIdAlphabet, 25))
  .map((parts) => parts.join(''));

const typeIdPrefix = fc.oneof(
  characters(alphabets.lower, 1),
  fc
    .tuple(
      characters(alphabets.lower, 1),
      characters(`${alphabets.lower}_`, 0, 61),
      characters(alphabets.lower, 1),
    )
    .map((parts) => parts.join('')),
);

const ownJson = (level: unknown): unknown =>
  typeof level === 'function' ? ownRuleJson(level) : undefined;

const fixedPrefix = /^\^(?<start>[a-z_]*)\.\{26\}\$$/u;

// The prefix `TypeId.withPrefix()` gave the type or a type above it, read from the pattern of
// that rule's JSON Schema.
const prefixOf = (type: object): string | undefined => {
  for (
    let level: unknown = type;
    typeof level === 'function';
    level = Object.getPrototypeOf(level)
  ) {
    const pattern = propertyOf(ownJson(level), 'pattern');
    const start =
      typeof pattern === 'string' ? fixedPrefix.exec(pattern)?.groups?.['start'] : undefined;

    if (start !== undefined) {
      return start;
    }
  }

  return undefined;
};

const typeId = (target: object): Arbitrary<string> => {
  const prefix = prefixOf(target);

  if (prefix !== undefined) {
    return typeIdSuffix.map((suffix) => prefix + suffix);
  }

  return fc
    .tuple(fc.option(typeIdPrefix, { nil: undefined }), typeIdSuffix)
    .map(([start, suffix]) => (start === undefined ? suffix : `${start}_${suffix}`));
};

const minorUnitsOf = (currencyType: unknown, code: string): unknown => {
  if (typeof currencyType !== 'function') {
    return undefined;
  }

  try {
    return propertyOf(Reflect.construct(currencyType, [code]), 'minorUnits');
  } catch {
    return undefined;
  }
};

// An amount in one of the currencies, with no more digits after the point than the currency has
// minor units; up to eight for a currency without them, such as gold.
const money = (level: object): Arbitrary<unknown> | undefined => {
  const rule = propertyOf(level, 'rule');
  const parts = typeof rule === 'object' && rule !== null ? partsOf(rule) : undefined;
  const currency =
    parts?.kind === 'object' ? parts.fields.find(({ key }) => key === 'currency') : undefined;
  const codes = propertyOf(currency?.field, 'codes');

  if (!Array.isArray(codes) || codes.length === 0) {
    return undefined;
  }

  return fc.constantFrom(...codes.map(String)).chain((code) => {
    const units = minorUnitsOf(currency?.field, code);
    const most = typeof units === 'number' ? units : 8;

    return decimalOf(characters(digits, 0, most)).map((amount) => ({ amount, currency: code }));
  });
};

/**
 * Internal: generators for the built-in value types that read the type they generate for: the
 * prefix of a TypeID, the currencies of Money.
 */
export const valueArbitraries: Readonly<
  Record<string, (level: object, target: object) => Arbitrary<unknown> | undefined>
> = {
  'nominal.DecimalString': () => decimalString,
  'nominal.TypeId': (_level, target) => typeId(target),
  'nominal.Money': (level) => money(level),
};
