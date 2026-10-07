import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import {
  AnyBigInt,
  AnyBoolean,
  AnyNumber,
  Email,
  Nominal,
  PositiveInteger,
  schemaOf,
} from '../../src/index.ts';
import { valueOf } from '../support/results.ts';

class Range extends Nominal(
  'Range',
  type({ start: schemaOf(PositiveInteger), end: schemaOf(PositiveInteger), 'note?': 'string' }),
) {}

class Tags extends Nominal('Tags', type({ names: 'string[]', meta: { owner: 'string' } })) {}

class Amount extends Nominal('Amount', type({ minor: 'bigint' })) {}

const range = (start: number, end: number): Range => new Range({ start, end });

describe('primitive values', () => {
  it('compares number values as numbers, past one digit', () => {
    const ten = new PositiveInteger(10);
    const nine = new PositiveInteger(9);

    expect(ten > nine).toBe(true);
    expect(nine < ten).toBe(true);
    expect(ten >= new PositiveInteger(10)).toBe(true);
  });

  it('does arithmetic on number values', () => {
    expect(+new PositiveInteger(10) + 1).toBe(11);
    expect(new PositiveInteger(10).valueOf()).toBeInstanceOf(PositiveInteger);
    expect(Number(new PositiveInteger(10))).toBe(10);
  });

  it('keeps NaN and -0 as they are', () => {
    expect(Number.isNaN(Number(new AnyNumber(Number.NaN)))).toBe(true);
    expect(Object.is(Number(new AnyNumber(-0)), -0)).toBe(true);
    expect(String(new AnyNumber(-0))).toBe('0');
  });

  it('compares and adds bigint values as bigints', () => {
    const big = new AnyBigInt(9_007_199_254_740_993n);

    expect(big > new AnyBigInt(9_007_199_254_740_992n)).toBe(true);
    expect(Reflect.apply(BigInt, undefined, [new AnyBigInt(2n)])).toBe(2n);
    expect(String(big)).toBe('9007199254740993');
  });

  it('turns string and boolean values into their text', () => {
    const email = new Email('jane@example.com');

    expect(String(email)).toBe('jane@example.com');
    expect(email > new Email('adam@example.com')).toBe(true);
    expect(String(new AnyBoolean(false))).toBe('false');
    expect(String(new AnyBoolean(true))).toBe('true');
  });
});

describe('object values', () => {
  it('writes JSON text in a string context', () => {
    expect(String(range(1, 5))).toBe('{"start":1,"end":5}');
    expect(String(range(1, 5))).toBe('{"start":1,"end":5}');
    expect(range(1, 5).toString()).toBe('{"start":1,"end":5}');
  });

  it('writes bigints inside as decimal strings', () => {
    expect(String(new Amount({ minor: 12n }))).toBe('{"minor":"12"}');
  });

  it('throws a TypeError naming the type when compared or added', () => {
    expect(() => range(1, 5) > range(2, 6)).toThrow(
      new TypeError(
        'Range holds an object and has no primitive value; compare its fields through .value',
      ),
    );
    expect(() => +range(1, 5)).toThrow(TypeError);
  });

  it('compares fields through value', () => {
    const { start, end } = range(1, 10).value;

    expect(end > start).toBe(true);
  });

  it('freezes the value all the way down', () => {
    const tags = new Tags({ names: ['a'], meta: { owner: 'jane' } });

    expect(Object.isFrozen(tags.value)).toBe(true);
    expect(Object.isFrozen(tags.value.names)).toBe(true);
    expect(Object.isFrozen(tags.value.meta)).toBe(true);
    expect(() => {
      Reflect.set(tags.value.meta, 'owner', 'adam');
    }).not.toThrow();
    expect(tags.value.meta.owner).toBe('jane');
  });

  it('leaves the caller input mutable', () => {
    const input = { names: ['a'], meta: { owner: 'jane' } };

    const tags = new Tags(input);

    input.names.push('b');
    input.meta.owner = 'adam';

    expect(Object.isFrozen(input)).toBe(false);
    expect(input.meta.owner).toBe('adam');
    expect(tags.value.names).toStrictEqual(['a']);
  });

  it('keeps an input frozen all the way down without copying it', () => {
    const input = Object.freeze({
      names: Object.freeze(['a']),
      meta: Object.freeze({ owner: 'j' }),
    });

    expect(valueOf(Tags.parse(input)).value).toBe(input);
  });

  it('copies a frozen input whose inside is not frozen', () => {
    const input = Object.freeze({ names: ['a'], meta: { owner: 'jane' } });
    const tags = new Tags(input);

    expect(tags.value).not.toBe(input);
    expect(Object.isFrozen(tags.value.meta)).toBe(true);
  });

  it('keeps nominal instances inside as they are', () => {
    const value = range(1, 5).value;

    expect(value.start).toBeInstanceOf(PositiveInteger);
    expect(Number(value.start)).toBe(1);
  });

  it('keeps the frozen array a schema builds', () => {
    class Team extends Nominal('Team', schemaOf(Email).array()) {}

    const team = new Team(['jane@example.com']);

    expect(Object.isFrozen(team.value)).toBe(true);
    expect(team.value[0]).toBeInstanceOf(Email);
  });
});

describe('equals on object values', () => {
  it('compares plain objects key by key and instances inside by value', () => {
    expect(range(1, 5).equals(range(1, 5))).toBe(true);
    expect(range(1, 5).equals(range(1, 6))).toBe(false);
  });

  it('tells an absent key from one more key', () => {
    expect(new Range({ start: 1, end: 5, note: 'x' }).equals(range(1, 5))).toBe(false);
    expect(range(1, 5).equals(new Range({ start: 1, end: 5, note: 'x' }))).toBe(false);
  });

  it('compares nested objects and arrays', () => {
    const left = new Tags({ names: ['a', 'b'], meta: { owner: 'jane' } });

    expect(left.equals(new Tags({ names: ['a', 'b'], meta: { owner: 'jane' } }))).toBe(true);
    expect(left.equals(new Tags({ names: ['a'], meta: { owner: 'jane' } }))).toBe(false);
    expect(left.equals(new Tags({ names: ['a', 'b'], meta: { owner: 'adam' } }))).toBe(false);
  });

  it('is false for the plain object itself', () => {
    expect(range(1, 5).equals({ start: 1, end: 5 })).toBe(false);
  });
});
