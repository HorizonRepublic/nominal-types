import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import {
  AnyBoolean,
  AnyString,
  Email,
  Int64,
  n,
  Nominal,
  PositiveInteger,
  Uuid,
} from '../../src/index.ts';
import type { Plain } from '../../src/index.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

const call = (): number => 1;

const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

class Stay extends Nominal(
  'plain.Stay',
  n.object({ guests: PositiveInteger, contact: Email, note: n.of(AnyString).optional() }),
) {}

class Cents extends PositiveInteger.subtype('plain.Cents') {
  public override toJSON(): string {
    return `${String(this.value)} cents`;
  }
}

describe('n.plain()', () => {
  it.each([
    ['a string', 'text'],
    ['a number', 1.5],
    ['a bigint', 42n],
    ['a boolean', false],
    ['null', null],
    ['undefined', undefined],
  ])('returns %s as it is', (_, value) => {
    expect(n.plain(value)).toBe(value);
  });

  it('returns a symbol and a function as they are', () => {
    const symbol = Symbol('s');

    expect(n.plain(symbol)).toBe(symbol);
    expect(n.plain(call)).toBe(call);
  });

  it('writes an instance as its value, a sensitive one included', () => {
    expect(n.plain(new Uuid(id))).toBe(id);
    expect(n.plain(new Email('jane@example.com'))).toBe('jane@example.com');
    expect(n.plain(new AnyBoolean(false))).toBe(false);
  });

  it("writes an instance as its toJSON() gives it: a big integer as text, a class's own form", () => {
    expect(n.plain(new Int64(9_007_199_254_740_993n))).toBe('9007199254740993');
    expect(n.plain({ price: new Cents(250) })).toStrictEqual({ price: '250 cents' });
  });

  it('writes an object type as a plain object of plain fields', () => {
    const stay = new Stay({ guests: 2, contact: 'jane@example.com' });
    const plain = n.plain(stay);

    expect(plain).toStrictEqual({ guests: 2, contact: 'jane@example.com' });
    expect(Object.isFrozen(plain)).toBe(false);
  });

  it('finds instances deep in arrays and objects', () => {
    const value = {
      order: { id: new Uuid(id), lines: [[new PositiveInteger(1)], [new PositiveInteger(2), 3]] },
      empty: [],
      nested: { deeper: { deepest: new Email('jane@example.com') } },
    };

    expect(n.plain(value)).toStrictEqual({
      order: { id, lines: [[1], [2, 3]] },
      empty: [],
      nested: { deeper: { deepest: 'jane@example.com' } },
    });
  });

  it('returns new arrays and objects and leaves the input as it was', () => {
    const items = [new PositiveInteger(1)];
    const input = { items, name: 'x', inner: { flag: true } };
    const plain = n.plain(input);

    expect(plain).not.toBe(input);
    expect(plain.items).not.toBe(items);
    expect(plain.inner).not.toBe(input.inner);
    expect(input.items[0]).toBeInstanceOf(PositiveInteger);
    expect(input.inner).toStrictEqual({ flag: true });
  });

  it('copies frozen arrays and objects into ones that can change', () => {
    const plain = n.plain(Object.freeze({ list: Object.freeze([1, 2]) }));

    expect(Object.isFrozen(plain)).toBe(false);
    expect(Object.isFrozen(plain.list)).toBe(false);
  });

  it('keeps dates, maps and instances of other classes', () => {
    class Point {
      public readonly x = new PositiveInteger(1);
    }

    const date = new Date(0);
    const map = new Map([['a', new PositiveInteger(1)]]);
    const point = new Point();

    expect(n.plain({ date, map, point })).toStrictEqual({ date, map, point });
    expect(n.plain([date])[0]).toBe(date);
  });

  it('copies an object without a prototype', () => {
    const bare = { __proto__: null, email: new Email('jane@example.com') };

    expect(Object.getPrototypeOf(bare)).toBeNull();
    expect(n.plain(bare)).toStrictEqual({ email: 'jane@example.com' });
  });

  it('keeps __proto__ as an own key, as JSON.parse() gives it, without changing the prototype', () => {
    const parsed: unknown = JSON.parse('{"__proto__": {"admin": true}, "id": 1}');
    const plain = n.plain(parsed);

    expect(Object.getPrototypeOf(plain)).toBe(Object.prototype);
    expect(Object.getOwnPropertyNames(plain)).toStrictEqual(['__proto__', 'id']);
    expect(JSON.stringify(plain)).toBe('{"__proto__":{"admin":true},"id":1}');
  });

  it('copies the same object twice when it appears twice', () => {
    const shared = { id: new Uuid(id) };
    const plain = n.plain({ first: shared, second: shared });

    expect(plain).toStrictEqual({ first: { id }, second: { id } });
  });

  it.each([
    [
      'an object',
      () => {
        const looped: Record<string, unknown> = {};

        looped['self'] = looped;

        return looped;
      },
    ],
    [
      'an array',
      () => {
        const looped: unknown[] = [];

        looped.push([looped]);

        return looped;
      },
    ],
    [
      'an instance whose toJSON() gives an object holding it',
      () => {
        class Loop extends Nominal('plain.Loop', n.object({ count: PositiveInteger })) {
          public override toJSON(): unknown {
            return { again: this };
          }
        }

        return new Loop({ count: 1 });
      },
    ],
  ])('throws a TypeError for %s that refers to itself', (_, build) => {
    expect(() => n.plain(build())).toThrow(
      new TypeError('n.plain(): the value refers to itself, which JSON cannot write'),
    );
  });

  it('writes instances made by another copy of the package', async () => {
    const copy = await anotherCopy();
    const value = { id: new copy.Uuid(id), count: new copy.PositiveInteger(2) };

    expect(value.id.constructor).not.toBe(Uuid);
    expect(n.plain(value)).toStrictEqual({ id, count: 2 });
  });

  it('writes the same JSON as JSON.stringify() of the input', () => {
    const value = {
      stay: new Stay({ guests: 2, contact: 'jane@example.com', note: 'late' }),
      list: [new Int64(5n), null, undefined, 'x', [new AnyBoolean(true)]],
      missing: undefined,
      date: new Date(0),
    };

    expect(JSON.stringify(n.plain(value))).toBe(JSON.stringify(value));
  });

  it('skips keys an object inherits, also when someone added one to Object.prototype', () => {
    Reflect.defineProperty(Object.prototype, 'plainPolluted', {
      value: { injected: true },
      enumerable: true,
      configurable: true,
      writable: true,
    });

    try {
      const value = { id: new Uuid(id) };

      expect(Object.keys(n.plain(value))).toStrictEqual(['id']);
      expect(JSON.stringify(n.plain(value))).toBe(JSON.stringify(value));
    } finally {
      Reflect.deleteProperty(Object.prototype, 'plainPolluted');
    }
  });

  it('types the result with the values in place of the instances', () => {
    const value = {
      id: new Uuid(id),
      big: new Int64(1n),
      list: [new PositiveInteger(1)] as const,
      stay: new Stay({ guests: 1, contact: 'jane@example.com' }),
    };

    expectTypeOf(n.plain(value)).toEqualTypeOf<{
      id: string;
      big: string;
      list: [number];
      stay: { guests: number; contact: string; note?: string };
    }>();
    expectTypeOf<Plain<Email | undefined>>().toEqualTypeOf<string | undefined>();
  });
});
