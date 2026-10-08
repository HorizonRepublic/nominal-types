import { inspect } from 'node:util';

import { describe, expect, it } from 'vitest';

import { AnyString, Email, n, Nominal, PositiveInteger, Uuid } from '../../src/index.ts';

class Pair extends Nominal(
  'inspect.Pair',
  n.object({ email: Email, count: PositiveInteger, note: n.of(AnyString).optional() }),
) {}

const pairInput = { email: 'jane@example.com', count: 3 };

const shownWithoutInspector = (instance: object, depth: number = 2): unknown => {
  const custom: unknown = Reflect.get(instance, Symbol.for('nodejs.util.inspect.custom'));

  if (typeof custom !== 'function') {
    throw new TypeError('expected the inspect function');
  }

  return Reflect.apply(custom, instance, [depth, {}, undefined]);
};

describe('how console.log shows an instance', () => {
  it('shows the class and the value', () => {
    expect(inspect(new PositiveInteger(3))).toBe('PositiveInteger { value: 3 }');
    expect(inspect(new Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f'))).toBe(
      "Uuid { value: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f' }",
    );
    expect(inspect(Nominal('inspect.Shown', /^a$/u).parse('a'))).toBe(
      "{ ok: true, value: inspect.Shown { value: 'a' } }",
    );
  });

  it('hides the value of a sensitive type by its kind', () => {
    class Pin extends AnyString.subtype('inspect.Pin', /^\d*$/u, { sensitive: true }) {}
    class Secret extends Nominal('inspect.Secret', n.object({ pin: Pin }), {
      sensitive: true,
    }) {}
    class Pins extends Nominal('inspect.Pins', n.of(Pin).array(), { sensitive: true }) {}
    class MaybePin extends Nominal('inspect.MaybePin', n.of(Pin).nullable(), {
      sensitive: true,
    }) {}
    class Count extends PositiveInteger.subtype('inspect.Count', undefined, { sensitive: true }) {}

    expect(inspect(new Email('jane@example.com'))).toBe(
      'Email { value: <hidden, a string of 16 characters> }',
    );
    expect(inspect(new Pin('1'))).toBe('Pin { value: <hidden, a string of 1 character> }');
    expect(inspect(new Pin(''))).toBe('Pin { value: <hidden, an empty string> }');
    expect(inspect(new Count(3))).toBe('Count { value: <hidden, a number> }');
    expect(inspect(new Secret({ pin: '1' }))).toBe('Secret { value: <hidden, an object> }');
    expect(inspect(new Pins(['1']))).toBe('Pins { value: <hidden, an array> }');
    expect(inspect(new MaybePin(null))).toBe('MaybePin { value: <hidden, null> }');
  });

  it('shows the fields of an object type, each as its own type shows', () => {
    expect(inspect(new Pair({ ...pairInput, note: 'hi' }))).toBe(
      [
        'Pair {',
        '  value: {',
        '    email: Email { value: <hidden, a string of 16 characters> },',
        '    count: PositiveInteger { value: 3 },',
        "    note: AnyString { value: 'hi' }",
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('stops at the depth it is given', () => {
    expect(inspect({ a: { b: new PositiveInteger(3) } }, { depth: 0 })).toBe('{ a: [Object] }');
    expect(inspect({ a: new PositiveInteger(3) }, { depth: 0 })).toBe('{ a: [PositiveInteger] }');
    expect(inspect(new PositiveInteger(3), { depth: 0 })).toBe('PositiveInteger { value: 3 }');
    expect(inspect([new Pair(pairInput)], { depth: 0 })).toBe('[ [Pair] ]');
    expect(inspect(new Pair(pairInput), { depth: 0 })).toBe('Pair { value: [Object] }');
    expect(inspect(new Pair(pairInput), { depth: null })).toContain('count: PositiveInteger');
  });

  it('falls back to plain text where the host passes no inspector', () => {
    const orphan = new PositiveInteger(1);

    Reflect.defineProperty(orphan, 'constructor', { value: undefined });

    expect(shownWithoutInspector(new PositiveInteger(3))).toBe('PositiveInteger { value: 3 }');
    expect(shownWithoutInspector(new Email('a@b.co'))).toBe(
      'Email { value: <hidden, a string of 6 characters> }',
    );
    expect(shownWithoutInspector(new PositiveInteger(3), -1)).toBe('[PositiveInteger]');
    expect(shownWithoutInspector(orphan)).toBe('Nominal { value: 1 }');
  });

  it('colours the value as the inspector does', () => {
    expect(inspect(new PositiveInteger(3), { colors: true })).toBe(
      'PositiveInteger { value: \u001B[33m3\u001B[39m }',
    );
    expect(inspect(new Email('a@b.co'), { colors: true })).toBe(
      'Email { value: \u001B[36m<hidden, a string of 6 characters>\u001B[39m }',
    );
  });
});
