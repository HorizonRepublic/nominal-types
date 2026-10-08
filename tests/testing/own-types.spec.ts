import * as fc from 'fast-check';
import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type * as library from '../../src/index.ts';
import {
  AnyNumber,
  AnyString,
  Email,
  Integer,
  n,
  Nominal,
  NonBlankString,
  PositiveInteger,
  TypeId,
  Uint8,
  Uuid,
} from '../../src/index.ts';
import type { AnyNominalType, NominalTarget } from '../../src/index.ts';
import { arbitraryOf, invalidArbitraryOf, sampleOf } from '../../src/testing/index.ts';

// Calls parse() of a type or of a schema, whose methods TypeScript can't take as one.
const parses = (target: NominalTarget, value: unknown): boolean =>
  n.isType(target) ? target.parse(value).ok : target.parse(value).ok;

const isEven = (value: unknown): value is number => typeof value === 'number' && value % 2 === 0;
const anything = (value: unknown): value is unknown => value !== Symbol.for('never');

class Sku extends AnyString.subtype('testing.Sku', /^SKU-\d{4}$/u) {}

class Even extends Integer.subtype('testing.Even', n.satisfying(isEven, 'an even number')) {}

class Percent extends AnyNumber.subtype(
  'testing.Percent',
  n.satisfying(isEven, 'an even percentage', { type: 'integer', minimum: 0, maximum: 100 }),
) {}

class Status extends AnyString.subtype('testing.Status', n.oneOf('draft', 'paid', 'shipped')) {}

// A lookahead fast-check can't generate from, under a built-in it can.
class LongName extends NonBlankString.subtype('testing.LongName', /^(?=.{3,}$)/u) {}

class Ticket extends Nominal(
  'testing.Ticket',
  n.satisfying(isEven, 'a ticket', { examples: [4, 8] }),
) {}

class Opaque extends Nominal('testing.Opaque', n.satisfying(anything, 'anything')) {}

class Round extends Sku.variant('testing.Round', /^SKU-\d{3}0$/u) {}

class UserId extends TypeId.subtype('testing.UserId', TypeId.withPrefix('user')) {}

class BareId extends TypeId.subtype('testing.BareId', TypeId.withPrefix('')) {}

const oneToFive = (value: unknown): value is number =>
  typeof value === 'number' && value >= 1 && value <= 5;

class Stars extends Uint8.subtype('testing.Stars', n.satisfying(oneToFive, 'a rating'), {
  implies: [PositiveInteger],
}) {}

class CompanyEmail extends Email.subtype('testing.CompanyEmail', /@example\.com$/u) {}

const holds = (target: NominalTarget): void => {
  fc.assert(
    fc.property(arbitraryOf(target), (value) => {
      expect(target.accepts(value)).toBe(true);
      expect(parses(target, value)).toBe(true);
    }),
    { numRuns: 200 },
  );
};

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

describe('arbitraryOf() for types of your own', () => {
  it.each<readonly [string, AnyNominalType]>([
    ['a pattern', Sku],
    ['a rule under a built-in type', Even],
    ['a JSON Schema with bounds', Percent],
    ['n.oneOf()', Status],
    ['a pattern fast-check cannot read', LongName],
    ['a variant', Round],
    ['a pattern under a built-in type', CompanyEmail],
    ['TypeId.withPrefix()', UserId],
    ['a TypeID without a prefix', BareId],
    ['implies', Stars],
  ])('makes values for a type declared with %s', (_, type) => {
    expect(() => {
      holds(type);
    }).not.toThrow();
  });

  it('makes every value n.oneOf() lists', () => {
    expect(new Set(sampleOf(Status, 200))).toStrictEqual(new Set(['draft', 'paid', 'shipped']));
  });

  it('falls back to the examples of a rule it cannot generate from', () => {
    expect(new Set(sampleOf(Ticket, 100))).toStrictEqual(new Set([4, 8]));
  });

  it('fails clearly for a type it has nothing to generate from', () => {
    expect(() => arbitraryOf(Opaque)).toThrow(
      'arbitraryOf(): no generator makes values of testing.Opaque: its rules give no pattern, list of values or JSON Schema to generate from, and it has no examples. Pass a generator of your own: { overrides: new Map([[Opaque, arbitrary]]) }',
    );
  });

  it('takes a generator of your own for a type, also inside a schema', () => {
    const overrides = new Map([[Opaque, fc.constantFrom('a', 'b')]]);
    const Box = n.object({ content: Opaque, id: Uuid });

    expect(new Set(sampleOf(Opaque, 50, { overrides }))).toStrictEqual(new Set(['a', 'b']));
    expect(sampleOf(Box, 20, { overrides }).every((box) => Box.accepts(box))).toBe(true);
  });

  it('keeps a generator of your own to what the type accepts', () => {
    const overrides = new Map([[Sku, fc.constantFrom('SKU-1234', 'nope')]]);

    expect(new Set(sampleOf(Sku, 50, { overrides }))).toStrictEqual(new Set(['SKU-1234']));
  });

  it('takes a generator of your own for a schema', () => {
    const lines = n.of(Uuid).array();
    const Order = n.object({ lines });
    const overrides = new Map([[lines, fc.constant([])]]);

    expect(sampleOf(Order, 5, { overrides })).toStrictEqual(
      Array.from({ length: 5 }, () => ({ lines: [] })),
    );
  });

  it('makes values for a field of another library from its JSON Schema', () => {
    const Order = n.object({ code: z.string().regex(/^[a-z]{3}$/u), id: Uuid });

    expect(() => {
      holds(Order);
    }).not.toThrow();
  });

  it('fails clearly for a field of another library without JSON Schema', () => {
    const Order = n.object({ code: v.pipe(v.string(), v.minLength(3)) });

    expect(() => arbitraryOf(Order)).toThrow(
      'arbitraryOf(): no generator makes values of the field code, whose schema has no JSON Schema to generate from. Pass a generator of your own: { overrides: new Map([[schema, arbitrary]]) }',
    );
  });

  it('takes a generator of your own for a field of another library', () => {
    const code = v.pipe(v.string(), v.minLength(3));
    const Order = n.object({ code });

    expect(sampleOf(Order, 3, { overrides: new Map([[code, fc.constant('abc')]]) })).toStrictEqual(
      Array.from({ length: 3 }, () => ({ code: 'abc' })),
    );
  });

  it('makes values for types and schemas of another copy of the package', async () => {
    const copy = await anotherCopy();
    const Order = copy.n.object({ id: copy.Uuid, quantity: copy.PositiveInteger });

    holds(copy.Email);
    holds(Order);
    expect(sampleOf(Order, 5, { as: 'instances' }).every((order) => order.id instanceof Uuid)).toBe(
      true,
    );
  });

  it('makes values a type refuses, also for types of your own', () => {
    for (const type of [Sku, Even, Status, PositiveInteger]) {
      expect(fc.sample(invalidArbitraryOf(type), 200).some((value) => type.accepts(value))).toBe(
        false,
      );
    }
  });

  it('fails clearly when a type refuses too little to make invalid values from', () => {
    const overrides = new Map([[Opaque, fc.constant('a')]]);

    expect(() => fc.sample(invalidArbitraryOf(Opaque, { overrides }), 1)).toThrow(
      'invalidArbitraryOf(): testing.Opaque accepted 1000 changed values in a row, so there is too little it refuses to generate from',
    );
  });

  it('makes TypeIDs with the prefix the type fixes', () => {
    expect(sampleOf(UserId, 50).every((id) => /^user_[0-7]/u.test(id))).toBe(true);
    expect(sampleOf(BareId, 50).every((id) => id.length === 26)).toBe(true);
  });

  it('makes instances of a type that implies another, which pass for it', () => {
    expect(
      sampleOf(Stars, 20, { as: 'instances' }).every((star) => star instanceof PositiveInteger),
    ).toBe(true);
  });
});
