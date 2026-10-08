import {
  AnyBigInt,
  AnyNumber,
  AnyString,
  Email,
  FiniteNumber,
  Integer,
  n,
  PositiveInteger,
  Uint16,
  Uuid,
} from '../../src/index.ts';
import { brokenEmailAt, emailAt, pool, positiveIntegerAt, textPool, uuidAt } from '../inputs.ts';
import { scenarios } from '../scenarios.ts';
import type { Case } from './case.ts';

class Port extends Uint16.subtype('BenchPort') {}

const texts = textPool(emailAt);
const brokenTexts = textPool(brokenEmailAt);
const emails = texts.map((text) => new Email(text));
const others = pool((index) => new Email(emailAt(index + 1)));
const ids = textPool(uuidAt);
const words = textPool((index) => `word ${index}`);
const integers = pool(positiveIntegerAt);
const ports = pool((index) => (index * 61) % 65_536);
const bigIntegers = textPool((index) => String(9_007_199_254_740_993n + BigInt(index)));
const lists = scenarios.find((scenario) => scenario.title === '1000 UUIDs in an array')?.inputs;
const uuidList = n.of(Uuid).array();

const newOrError = (build: () => unknown): unknown => {
  try {
    return build();
  } catch (error) {
    return error;
  }
};

/**
 * What single operations of nominal-types cost, one value at a time.
 */
export const operations: readonly Case[] = [
  ['`Email.pattern.test(text)` alone', texts, (text) => Email.pattern.test(String(text))],
  ['`new Email(text)`', texts, (text) => new Email(String(text))],
  ['`Email.parse(text)`', texts, (text) => Email.parse(text)],
  ['`Email.parse(existing Email)`', emails, (email) => Email.parse(email)],
  ['`Email.parse(invalid text)`', brokenTexts, (text) => Email.parse(text)],
  [
    '`new Email(invalid text)`, which throws',
    brokenTexts,
    (text) => newOrError(() => new Email(String(text))),
  ],
  ['`new Uuid(text)`', ids, (text) => new Uuid(String(text))],
  ['`new AnyString(text)`', words, (text) => new AnyString(String(text))],
  ['`new Integer(n)`, three rules', integers, (value) => new Integer(Number(value))],
  ['`new PositiveInteger(n)`, four rules', integers, (value) => new PositiveInteger(Number(value))],
  ['`new AnyBigInt(text)`', bigIntegers, (text) => new AnyBigInt(String(text))],
  ['`value instanceof Email`', emails, (email) => email instanceof Email],
  [
    '`email.equals(other)`',
    emails,
    (email, index) => email instanceof Email && email.equals(others[index] ?? email),
  ],
  ['`n.of(Uuid).array().parse(ids)`, 1000 UUIDs', lists ?? [], (list) => uuidList.parse(list)],
];

/**
 * What each level of a chain of types adds to `parse()`.
 */
export const levels: readonly Case[] = [
  ['AnyNumber, 1 rule', ports, (input) => AnyNumber.parse(input)],
  ['FiniteNumber, 2 rules', ports, (input) => FiniteNumber.parse(input)],
  ['Integer, 3 rules', ports, (input) => Integer.parse(input)],
  ['PositiveInteger, 4 rules', ports, (input) => PositiveInteger.parse(input)],
  ['Uint16, 4 rules', ports, (input) => Uint16.parse(input)],
  ['Port under Uint16, 4 rules, 2 more classes', ports, (input) => Port.parse(input)],
];
