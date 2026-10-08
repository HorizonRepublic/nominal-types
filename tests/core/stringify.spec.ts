import 'temporal-polyfill/global';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';

import { ownTypes } from '../../src/core/nominal.ts';
import * as ownCopy from '../../src/index.ts';
import {
  AnyNumber,
  AnyString,
  Email,
  Int64,
  n,
  Nominal,
  PositiveInteger,
  Uuid,
} from '../../src/index.ts';
import { Instant, PlainDate } from '../../src/temporal/index.ts';
import { valueOf } from '../support/results.ts';
import { edgeSamples, sampleTypes } from '../support/samples.ts';
import { awkwardTexts, stringifyCases } from '../support/stringify-cases.ts';

const anotherCopy = (): Promise<typeof ownCopy> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';
const injection = 'x", "admin": true, "y": "';

// stringify() given a value its type doesn't allow, as plain JavaScript can.
const stringifyAny = (schema: object, value: unknown): unknown => {
  const stringify: unknown = Reflect.get(schema, 'stringify');

  return typeof stringify === 'function' ? Reflect.apply(stringify, schema, [value]) : undefined;
};

// Assigns to `value`, which the types keep read-only, as plain JavaScript can.
const changeValue = (instance: object, value: unknown): void => {
  Reflect.set(instance, 'value', value);
};

describe('stringify() writes what JSON.stringify(n.plain()) writes', () => {
  describe.each(stringifyCases(ownCopy))('$name', ({ schema, values }) => {
    it.each(values.map((value) => [value]))('for %o', (value) => {
      expect(stringifyAny(schema, value)).toBe(JSON.stringify(n.plain(value)));
      expect(stringifyAny(schema, value)).toBe(JSON.stringify(value));
    });
  });

  it.each(sampleTypes.map((type) => [type.typeName, type]))(
    'for every value %s accepts',
    (_, type) => {
      const accepted = edgeSamples
        .filter((sample) => type.accepts(sample))
        .map((sample) => valueOf(type.parse(sample)));

      for (const value of accepted) {
        expect(type.stringify(value)).toBe(JSON.stringify(value));
        expect(n.of(type).stringify(value)).toBe(JSON.stringify(value));
      }

      expect(n.of(type).array().stringify(accepted)).toBe(JSON.stringify(accepted));
    },
  );

  it('writes the date and time types as their text', () => {
    const When = n.object({ at: Instant, on: PlainDate });
    const value = valueOf(When.parse({ at: '2024-05-01T11:30:00+02:00', on: '2024-05-01' }));

    expect(When.stringify(value)).toBe('{"at":"2024-05-01T09:30:00Z","on":"2024-05-01"}');
  });

  it('writes the real value of a sensitive type', () => {
    expect(Email.stringify(new Email('jane@example.com'))).toBe('"jane@example.com"');
  });

  it('writes big integers as decimal strings', () => {
    expect(Int64.stringify(new Int64('-9223372036854775808'))).toBe('"-9223372036854775808"');
  });

  it('writes NaN and the infinities as null, and -0 as 0', () => {
    const numbers = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0, 1e21];

    expect(
      n
        .of(AnyNumber)
        .array()
        .stringify(numbers.map((x) => new AnyNumber(x))),
    ).toBe('[null,null,null,0,1e+21]');
  });

  it('escapes lone surrogates of either half and keeps pairs', () => {
    expect(AnyString.stringify(new AnyString('\uD800'))).toBe('"\\ud800"');
    expect(AnyString.stringify(new AnyString('\uDC00x'))).toBe('"\\udc00x"');
    expect(AnyString.stringify(new AnyString('😀'))).toBe('"😀"');
  });
});

describe('stringify() of trusted instances', () => {
  it("reads their checked value and doesn't call toJSON()", () => {
    const toJson = vi.spyOn(ownTypes.root.prototype, 'toJSON');
    const Line = n.object({ id: Uuid, text: AnyString, count: PositiveInteger });
    const line = valueOf(Line.parse({ id, text: 'a"b', count: 2 }));

    expect(Line.stringify(line)).toBe(`{"id":"${id}","text":"a\\"b","count":2}`);
    expect(toJson).not.toHaveBeenCalled();

    changeValue(line.text, 'c');

    expect(Line.stringify(line)).toBe(`{"id":"${id}","text":"c","count":2}`);
    expect(toJson).toHaveBeenCalledOnce();
    toJson.mockRestore();
  });
});

describe('stringify() of an n.object() schema', () => {
  const Order = n.object({ id: Uuid, note: n.of(AnyString).optional(), quantity: PositiveInteger });

  it('writes the fields in the order they were declared', () => {
    const value = valueOf(Order.parse({ quantity: 2, note: 'late', id }));

    expect(Order.stringify(value)).toBe(`{"id":"${id}","note":"late","quantity":2}`);
    expect(Object.keys(value)).toStrictEqual(['id', 'note', 'quantity']);
    expect(Object.keys(Order.toPlain(value))).toStrictEqual(['id', 'note', 'quantity']);
  });

  it('leaves out a missing optional field', () => {
    expect(Order.stringify(valueOf(Order.parse({ id, quantity: 2 })))).toBe(
      `{"id":"${id}","quantity":2}`,
    );
  });

  it('keeps only the fields the schema declares', () => {
    const value = valueOf(Order.parse({ id, quantity: 2 }));

    expect(stringifyAny(Order, { ...value, secret: 'x' })).toBe(`{"id":"${id}","quantity":2}`);
  });

  it('leaves out a required field that is missing or holds a function, as JSON.stringify() does', () => {
    const missing = { id: new Uuid(id) };
    const callable = { id: new Uuid(id), note: 'a', quantity: () => 2 };

    expect(stringifyAny(Order, missing)).toBe(JSON.stringify(missing));
    expect(stringifyAny(Order, callable)).toBe(`{"id":"${id}","note":"a"}`);
  });

  it('writes plain values given in place of instances, escaped', () => {
    const value = { id: injection, note: 'a\nb', quantity: Number.NaN };

    expect(stringifyAny(Order, value)).toBe(JSON.stringify(value));
  });

  it('writes a value that is not an object, or not an array, as JSON.stringify() does', () => {
    expect(stringifyAny(Order, 'text')).toBe('"text"');
    expect(stringifyAny(Order, [new Uuid(id)])).toBe(`["${id}"]`);
    expect(stringifyAny(n.of(Uuid).array(), { 0: new Uuid(id) })).toBe(`{"0":"${id}"}`);
    expect(stringifyAny(n.of(Uuid).array(), [undefined, () => 1])).toBe('[null,null]');
  });

  it('throws for a value JSON has no text for', () => {
    expect(() => n.of(Uuid).optional().stringify(undefined)).toThrow(
      new TypeError('stringify(): JSON has no text for undefined'),
    );
    expect(() => stringifyAny(Uuid, () => 1)).toThrow(TypeError);
  });

  it('writes a field from another library through JSON.stringify()', () => {
    const Wrapped = n.object({ meta: z.object({ owner: z.instanceof(Uuid), note: z.string() }) });
    const value = valueOf(Wrapped.parse({ meta: { owner: new Uuid(id), note: '"' } }));

    expect(Wrapped.stringify(value)).toBe(`{"meta":{"owner":"${id}","note":"\\""}}`);
  });
});

describe('stringify() of instances it cannot trust', () => {
  it('escapes the value of a changed instance of an escape-free type', () => {
    const changed = new Uuid(id);

    changeValue(changed, injection);

    expect(Uuid.stringify(changed)).toBe(JSON.stringify(injection));
    expect(n.object({ id: Uuid }).stringify({ id: changed })).toBe(
      `{"id":${JSON.stringify(injection)}}`,
    );
    expect(n.of(Uuid).array().stringify([changed])).toBe(`[${JSON.stringify(injection)}]`);
  });

  it('writes a changed instance of an object type from its changed value', () => {
    const Point = Nominal('stringify.Point', n.object({ x: AnyNumber, label: AnyString }));
    const point = new Point({ x: 1, label: 'a' });

    changeValue(point, { x: 2, label: injection, extra: true });

    expect(Point.stringify(point)).toBe(JSON.stringify(n.plain(point)));
  });

  it('writes an object that only claims to be an instance through JSON.stringify()', () => {
    const fake = { constructor: Uuid, value: injection };
    const bare = { value: injection };

    Object.setPrototypeOf(bare, Uuid.prototype);

    expect(stringifyAny(Uuid, fake)).toBe(JSON.stringify(n.plain(fake)));
    expect(stringifyAny(Uuid, bare)).toBe(JSON.stringify(n.plain(bare)));
    expect(stringifyAny(n.object({ id: Uuid }), { id: fake })).toBe(
      JSON.stringify({ id: n.plain(fake) }),
    );
  });

  it('writes a subtype in a field of its parent type by the subtype', () => {
    const Text = n.object({ text: AnyString });
    const value = valueOf(Text.parse({ text: new Email('jane@example.com') }));

    expect(Text.stringify(value)).toBe('{"text":"jane@example.com"}');
  });

  it("uses a class's own toJSON()", () => {
    class Cents extends PositiveInteger.subtype('stringify.Cents') {
      public override toJSON(): string {
        return `${String(this.value)} "cents"`;
      }
    }

    const Price = n.object({ price: Cents, other: PositiveInteger });

    expect(Price.stringify({ price: new Cents(250), other: new Cents(3) })).toBe(
      '{"price":"250 \\"cents\\"","other":"3 \\"cents\\""}',
    );
  });

  it('writes instances from another copy of the package', async () => {
    const copy = await anotherCopy();
    const Mixed = n.object({
      id: copy.Uuid,
      tags: copy.n.of(copy.AnyString).array(),
      inner: copy.n.object({ count: copy.PositiveInteger }),
      own: Uuid,
    });
    const value = valueOf(
      Mixed.parse({ id, tags: ['"'], inner: { count: 2 }, own: new copy.Uuid(id) }),
    );

    expect(Mixed.stringify(value)).toBe(
      `{"id":"${id}","tags":["\\""],"inner":{"count":2},"own":"${id}"}`,
    );
    expect(copy.n.of(copy.Uuid).stringify(new Uuid(id))).toBe(`"${id}"`);
  });

  it.each(awkwardTexts.map((text) => [text]))(
    'escapes %j given in place of an escape-free value',
    (text) => {
      expect(stringifyAny(n.of(Uuid).array(), [text])).toBe(JSON.stringify([text]));
    },
  );
});

describe('stringify() of a nominal type', () => {
  const Point = Nominal(
    'stringify.Location',
    n.object({ lat: AnyNumber, label: n.of(AnyString).optional(), id: Uuid }),
  );

  it('writes an instance of a type built on n.object(), fields in declared order', () => {
    expect(Point.stringify(new Point({ id, lat: 1.5 }))).toBe(`{"lat":1.5,"id":"${id}"}`);
    expect(Point.stringify(new Point({ id, label: 'a"', lat: -0 }))).toBe(
      `{"lat":0,"label":"a\\"","id":"${id}"}`,
    );
  });

  it('writes a copy made by copyWith()', () => {
    const point = new Point({ id, lat: 1 }).copyWith({ label: 'x' });

    expect(Point.stringify(point)).toBe(JSON.stringify(point));
  });

  it('takes instances of the type, not their values', () => {
    const misuse = (): void => {
      // @ts-expect-error: a string is not a Uuid
      Uuid.stringify(id);
      // @ts-expect-error: a list of strings is not a list of Uuid
      n.of(Uuid).array().stringify([id]);
    };

    expectTypeOf(misuse).toBeFunction();
    expectTypeOf(Uuid.stringify(new Uuid(id))).toEqualTypeOf<string>();
    expectTypeOf(
      n
        .of(Uuid)
        .array()
        .stringify([new Uuid(id)]),
    ).toEqualTypeOf<string>();
  });
});
