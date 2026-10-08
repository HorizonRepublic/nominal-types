import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { acceptsByRunning, compileAccepts } from '../../src/core/acceptor.ts';
import type { Accepts } from '../../src/core/acceptor.ts';
import { foreignRunner } from '../../src/core/foreign-runner.ts';
import { stepsOf } from '../../src/core/plan.ts';
import { arrayAcceptor, objectAcceptor } from '../../src/core/shape-acceptors.ts';
import type * as library from '../../src/index.ts';
import { AnyString, n, PositiveInteger, Uuid } from '../../src/index.ts';

const anotherCopy = (): Promise<typeof library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

const isText: Accepts = (value) => typeof value === 'string';

describe('schema.accepts()', () => {
  const Order = n.object({
    id: Uuid,
    count: PositiveInteger,
    note: n.of(AnyString).optional(),
    tags: n.of(AnyString).array({ max: 2 }),
  });
  const order = { id, count: 1, tags: [] };

  it.each<[string, unknown, boolean]>([
    ['a valid object', order, true],
    ['an optional field that is there', { ...order, note: 'x' }, true],
    ['an optional field set to undefined', { ...order, note: undefined }, true],
    ['an optional field of the wrong kind', { ...order, note: 1 }, false],
    ['a missing field', { id, tags: [] }, false],
    ['a required field set to undefined', { ...order, count: undefined }, false],
    ['a field that is only inherited', Object.create(order) as unknown, false],
    ['an undeclared key', { ...order, extra: true }, true],
    ['too many items', { ...order, tags: ['a', 'b', 'c'] }, false],
    ['an array', [order], false],
    ['null', null, false],
    ['a string', 'x', false],
  ])('answers %s as parse() does', (_, input, expected) => {
    expect(Order.accepts(input)).toBe(expected);
    expect(Order.parse(input).ok).toBe(expected);
  });

  it('refuses undeclared keys when strict', () => {
    expect(Order.strict().accepts({ ...order, extra: true })).toBe(false);
    expect(Order.strict().accepts(order)).toBe(true);
  });

  it('runs constraints and unique items, which need the values', () => {
    const Unique = n.of(Uuid).array({ unique: true });
    const Range = n.object(
      { from: PositiveInteger, to: PositiveInteger },
      n.constraint({ from: PositiveInteger, to: PositiveInteger }, ({ from, to }) => from <= to),
    );

    expect(Unique.accepts([id, id.toUpperCase()])).toBe(false);
    expect(Unique.accepts([id])).toBe(true);
    expect(Range.accepts({ from: 1, to: 2 })).toBe(true);
    expect(Range.accepts({ from: 2, to: 1 })).toBe(false);
  });

  it('answers for the chains', () => {
    expect(n.of(Uuid).optional().accepts(undefined)).toBe(true);
    expect(n.of(Uuid).optional().accepts(null)).toBe(false);
    expect(n.of(Uuid).nullable().accepts(null)).toBe(true);
    expect(n.of(Uuid).nullable().accepts(undefined)).toBe(false);
    expect(n.of(Uuid).array({ length: 1 }).accepts([])).toBe(false);
    expect(n.of(Uuid).array({ min: 1 }).accepts([id])).toBe(true);
    expect(n.of(Uuid).array().accepts('x')).toBe(false);
    expect(n.of(PositiveInteger).fromString().accepts('2')).toBe(true);
    expect(n.of(PositiveInteger).fromString().accepts('two')).toBe(false);
    expect(n.of(PositiveInteger).fromString().accepts(2)).toBe(true);
  });

  it('answers for fromEnv()', () => {
    const Config = n.object({ PORT: PositiveInteger }).fromEnv();

    expect(Config.accepts({ PORT: '3000', HOME: '/root' })).toBe(true);
    expect(Config.accepts({ PORT: 'x' })).toBe(false);
  });

  it('checks a field from another library', () => {
    const Tagged = n.object({ tag: z.string().min(2) });

    expect(Tagged.accepts({ tag: 'ab' })).toBe(true);
    expect(Tagged.accepts({ tag: 'a' })).toBe(false);
  });

  it('checks types and schemas from another copy of the package', async () => {
    const copy = await anotherCopy();
    const Mixed = n.object({
      id: copy.Uuid,
      tags: copy.n.of(copy.AnyString).array({ max: 1 }),
    });

    expect(Mixed.accepts({ id, tags: ['a'] })).toBe(true);
    expect(Mixed.accepts({ id, tags: ['a', 'b'] })).toBe(false);
    expect(n.of(copy.Uuid).accepts('nope')).toBe(false);
  });

  it('runs a type or a schema from a copy without accepts()', async () => {
    const copy = await anotherCopy();
    const OldType = copy.AnyString.subtype('accepts.Old', /^old$/u);
    const oldSchema = copy.n.of(copy.Uuid);

    Object.defineProperty(OldType, 'accepts', { value: undefined });
    Object.defineProperty(oldSchema, 'accepts', { value: undefined });

    const Mixed = n.object({ old: OldType, id: oldSchema });

    expect(n.of(OldType).accepts('old')).toBe(true);
    expect(n.of(OldType).accepts('new')).toBe(false);
    expect(Mixed.accepts({ old: 'old', id })).toBe(true);
    expect(Mixed.accepts({ old: 'old', id: 'nope' })).toBe(false);
  });
});

describe.each([
  ['generated', true],
  ['loop', false],
])('the %s check', (_, generate) => {
  const list = arrayAcceptor(isText, 1, 2, generate);
  const object = objectAcceptor(
    [
      { key: 'name', accepts: isText, optional: false },
      { key: 'note', accepts: isText, optional: true },
    ],
    false,
    generate,
  );
  const strict = objectAcceptor(
    [{ key: 'name', accepts: isText, optional: false }],
    true,
    generate,
  );
  const steps = stepsOf(
    [
      n.matching(/^\d+$/u),
      z.string().transform(Number),
      n.satisfying((value): value is number => value === 42, '42'),
    ],
    (rule) => ({ convert: foreignRunner(rule, 'Probe') }),
  );
  const lastObject = n.object({ name: AnyString });
  const toObject = stepsOf([z.object({ name: z.string() }), lastObject], (rule) => ({
    convert: foreignRunner(rule, 'Probe'),
    accepts: rule === lastObject ? (value: unknown) => lastObject.accepts(value) : undefined,
  }));
  const rules = compileAccepts(steps, generate);
  const objects = compileAccepts(toObject, generate);

  it.each<[string, Accepts, unknown, boolean]>([
    ['a list', list, ['a'], true],
    ['an empty list', list, [], false],
    ['a long list', list, ['a', 'b', 'c'], false],
    ['a bad item', list, ['a', 1], false],
    ['not a list', list, 'a', false],
    ['an object', object, { name: 'a' }, true],
    ['an object with a note', object, { name: 'a', note: 'b' }, true],
    ['a bad note', object, { name: 'a', note: 1 }, false],
    ['a missing name', object, { note: 'b' }, false],
    ['a bad name', object, { name: 1 }, false],
    ['not an object', object, ['a'], false],
    ['an undeclared key', strict, { name: 'a', extra: 1 }, false],
    ['declared keys only', strict, { name: 'a' }, true],
    ['rules after a conversion', rules, '42', true],
    ['a failed conversion', rules, 42, false],
    ['a failed rule before the conversion', rules, 'x', false],
    ['a failed rule after the conversion', rules, '41', false],
    ['an object rule at the end', objects, { name: 'a' }, true],
    ['an object rule at the end, refused', objects, { name: 1 }, false],
  ])('answers %s', (_name, accepts, input, expected) => {
    expect(accepts(input)).toBe(expected);
  });

  it('accepts anything with no steps', () => {
    expect(compileAccepts([], generate)('anything')).toBe(true);
  });
});

describe('acceptsByRunning()', () => {
  it('accepts what the run returns a value for', () => {
    const accepts = acceptsByRunning(foreignRunner(z.string(), 'Probe'));

    expect(accepts('a')).toBe(true);
    expect(accepts(1)).toBe(false);
  });
});
