import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import {
  generatedArrayBuilder,
  generatedObjectBuilder,
} from '../../../src/adapters/arktype/builders.ts';
import { toArk, fromArk } from '../../../src/adapters/arktype/index.ts';
import { Email } from '../../../src/index.ts';
import { valueOf } from '../../support/results.ts';

const wrap = (value: unknown): unknown => ({ wrapped: value });

describe('generated builders', () => {
  const build = generatedObjectBuilder(
    [
      { key: 'a', optional: false, build: wrap },
      { key: 'b', optional: false, build: undefined },
      { key: 'c', optional: true, build: wrap },
      { key: 'd', optional: true, build: undefined },
      { key: 'with space', optional: false, build: undefined },
    ],
    true,
  );

  it('builds the declared fields and keeps the others', () => {
    expect(build?.({ a: 1, b: 2, 'with space': 3, extra: 4 })).toStrictEqual({
      a: { wrapped: 1 },
      b: 2,
      'with space': 3,
      extra: 4,
    });
  });

  it('adds an optional field only where the value has it', () => {
    expect(build?.({ a: 1, b: 2, 'with space': 3 })).toStrictEqual({
      a: { wrapped: 1 },
      b: 2,
      'with space': 3,
    });
    expect(build?.({ a: 1, b: 2, c: 5, d: undefined, 'with space': 3 })).toStrictEqual({
      a: { wrapped: 1 },
      b: 2,
      c: { wrapped: 5 },
      d: undefined,
      'with space': 3,
    });
  });

  it('keeps an optional field present as undefined without building it', () => {
    const value = build?.({ a: 1, b: 2, c: undefined, 'with space': 3 });

    expect(value).toHaveProperty('c', undefined);
  });

  it('copies an undeclared __proto__ key as a field, not as the prototype', () => {
    const value: unknown = build?.(JSON.parse('{"a":1,"b":2,"with space":3,"__proto__":{"x":1}}'));

    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(Object.getOwnPropertyNames(value)).toContain('__proto__');
  });

  it('drops undeclared keys when ArkType drops them', () => {
    const strict = generatedObjectBuilder([{ key: 'a', optional: false, build: undefined }], false);

    expect(strict?.({ a: 1, extra: 2 })).toStrictEqual({ a: 1 });
  });

  it('leaves a value of the wrong kind as it is', () => {
    expect(build?.('x')).toBe('x');
    expect(generatedArrayBuilder(wrap)?.('x')).toBe('x');
  });

  it('builds every item of an array', () => {
    expect(generatedArrayBuilder(wrap)?.([1, 2])).toStrictEqual([{ wrapped: 1 }, { wrapped: 2 }]);
  });

  it('gives nothing where code generation is off', () => {
    expect(generatedObjectBuilder([], true, false)).toBeUndefined();
    expect(generatedArrayBuilder(wrap, false)).toBeUndefined();
  });

  it('drops undeclared keys in fromArk when ArkType deletes them', () => {
    const Strict = fromArk(type({ '+': 'delete', email: toArk(Email) }));

    expect(valueOf(Strict.parse({ email: 'a@b.co', extra: 1 }))).toStrictEqual({
      email: new Email('a@b.co'),
    });
  });
});
