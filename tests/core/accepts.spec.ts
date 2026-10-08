import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { AnyNominalType } from '../../src/index.ts';
import type * as library from '../../src/index.ts';
import {
  AnyBigInt,
  AnyString,
  Email,
  Int64,
  n,
  Nominal,
  PositiveInteger,
} from '../../src/index.ts';
import { edgeSamples, sampleTypes } from '../support/samples.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

const refuseUnlucky = (input: number): void => {
  if (input === 13) {
    throw new TypeError('unlucky');
  }
};

// Valid samples become instances, so every type also meets instances of the other types.
const instances = sampleTypes.flatMap((type: AnyNominalType) =>
  edgeSamples.flatMap((sample) => {
    const parsed = type.parse(sample);

    return parsed.ok ? [parsed.value] : [];
  }),
);
const inputs: readonly unknown[] = [
  ...edgeSamples,
  ...instances.filter((_, index) => index % 7 === 0),
];

describe.each(sampleTypes.map((type: AnyNominalType) => [type.typeName, type] as const))(
  '%s.accepts()',
  (_, type) => {
    it('agrees with parse() on every sample', () => {
      for (const input of inputs) {
        expect([input, type.accepts(input)]).toStrictEqual([input, type.parse(input).ok]);
      }
    });

    it('agrees with parse() through n.of(), in a list and in an object', () => {
      const schema = n.of(type);
      const list = schema.array();
      const object = n.object({ value: type });

      for (const input of inputs) {
        expect(schema.accepts(input)).toBe(schema.parse(input).ok);
        expect(list.accepts([input])).toBe(list.parse([input]).ok);
        expect(object.accepts({ value: input })).toBe(object.parse({ value: input }).ok);
      }
    });
  },
);

describe('Type.accepts()', () => {
  it('builds no instance', () => {
    const built = vi.fn<() => void>();

    class Counted extends PositiveInteger.subtype('accepts.Counted') {
      public constructor(input: number) {
        super(input);
        built();
      }
    }

    expect(Counted.accepts(2)).toBe(true);
    expect(Counted.accepts(0)).toBe(false);
    expect(built).not.toHaveBeenCalled();
  });

  it("doesn't run a constructor of your own, so it can disagree with parse()", () => {
    class Refusing extends PositiveInteger.subtype('accepts.Refusing') {
      public constructor(input: number) {
        super(input);
        refuseUnlucky(input);
      }
    }

    expect(Refusing.accepts(13)).toBe(true);
    expect(() => Refusing.parse(13)).toThrow('unlucky');
  });

  it('treats instances as parse() does', () => {
    class Staff extends Email.subtype('accepts.Staff', /@example\.com$/u) {}
    class Sku extends AnyString.subtype('accepts.Sku', /^[A-Z]{3}$/u) {}
    class Other extends Nominal('accepts.Other', /^.*$/u) {}

    const staff = new Staff('jane@example.com');

    expect(Email.accepts(staff)).toBe(true);
    expect(Staff.accepts(new Email('jane@example.com'))).toBe(true);
    expect(Staff.accepts(new Email('jane@gmail.com'))).toBe(false);
    expect(Sku.accepts(new Email('jane@example.com'))).toBe(false);
    expect(Sku.accepts(new AnyString('TEA'))).toBe(true);
    expect(Email.accepts(new Other('jane@example.com'))).toBe(false);
  });

  it('checks a variant and its source by their values', () => {
    const Lower = AnyString.subtype('accepts.Lower', /^[a-z]+$/u);
    const Upper = Lower.variant('accepts.Upper', /^[A-Z]+$/u);

    expect(Upper.accepts(new Lower('abc'))).toBe(false);
    expect(Lower.accepts(new Upper('ABC'))).toBe(false);
    expect(Upper.accepts(new Upper('ABC'))).toBe(true);
  });

  it('checks again an instance whose value was changed', () => {
    const email = new Email('jane@example.com');

    Reflect.set(email, 'value', 'nope');

    expect(Email.accepts(email)).toBe(false);

    Reflect.set(email, 'value', 'john@example.com');

    expect(Email.accepts(email)).toBe(true);
  });

  it('checks an instance made by another copy of the package by its value', async () => {
    const copy = await anotherCopy();

    expect(Email.accepts(new copy.Email('jane@example.com'))).toBe(true);
    expect(copy.Email.accepts(new Email('jane@example.com'))).toBe(true);
    expect(PositiveInteger.accepts(new copy.Uuid(id))).toBe(false);
  });

  it('reads a big integer from text and refuses what it refuses', () => {
    expect(Int64.accepts('12')).toBe(true);
    expect(Int64.accepts(12)).toBe(true);
    expect(Int64.accepts('1.5')).toBe(false);
    expect(Int64.accepts(2n ** 64n)).toBe(false);
    expect(AnyBigInt.accepts(Number.MAX_SAFE_INTEGER + 2)).toBe(false);
  });

  it('checks a type built on n.object(), with its constraints', () => {
    const fits = n.constraint(
      { guests: PositiveInteger, capacity: PositiveInteger },
      ({ guests, capacity }) => guests <= capacity,
    );

    class Stay extends Nominal(
      'accepts.Stay',
      n.object({ guests: PositiveInteger, capacity: PositiveInteger }),
    ) {}
    const Fitting = Stay.subtype('accepts.Fitting', fits);

    expect(Stay.accepts({ guests: 5, capacity: 4 })).toBe(true);
    expect(Stay.accepts({ guests: 0, capacity: 4 })).toBe(false);
    expect(Stay.accepts('x')).toBe(false);
    expect(Fitting.accepts({ guests: 2, capacity: 4 })).toBe(true);
    expect(Fitting.accepts({ guests: 5, capacity: 4 })).toBe(false);
    expect(Fitting.accepts(new Stay({ guests: 5, capacity: 4 }))).toBe(false);
  });

  it('checks a rule from another library', () => {
    const Short = Nominal('accepts.Short', z.string().max(3));
    const Trimmed = Nominal('accepts.Trimmed', z.string().trim().pipe(z.string().min(1)));

    expect(Short.accepts('abc')).toBe(true);
    expect(Short.accepts('abcd')).toBe(false);
    expect(Trimmed.accepts('  a ')).toBe(true);
    expect(Trimmed.accepts('   ')).toBe(false);
  });
});
