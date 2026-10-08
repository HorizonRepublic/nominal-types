import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import { n } from '../../src/index.ts';
import { resetConfigurationAfterEach } from '../support/configuration.ts';

type Library = typeof library;

const uuid = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';
const original = globalThis.Function;

// Counts every `new Function` made by the package's own source, whoever else builds functions.
const countGenerated = (): { readonly count: () => number } => {
  let count = 0;

  globalThis.Function = new Proxy(original, {
    construct: (target, args: unknown[], newTarget): object => {
      if (new Error('probe').stack?.includes('/src/core/') === true) {
        count += 1;
      }

      const built: unknown = Reflect.construct(target, args, newTarget);

      return typeof built === 'function' ? built : {};
    },
  });

  return { count: () => count };
};

const freshCopy = (): Promise<Library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

// Everything a server does with the package, so each kind of generated function is asked for.
const exercise = (copy: Library): void => {
  const { Email, Money, n: ns, PositiveInteger, Uuid } = copy;
  const Order = ns.object({
    id: Uuid,
    customer: Email,
    lines: ns.object({ quantity: PositiveInteger }).array({ min: 1 }),
    total: Money,
  });
  const order = Order.parse({
    id: uuid,
    customer: 'jane@example.com',
    lines: [{ quantity: 2 }],
    total: { amount: '12.50', currency: 'EUR' },
  });

  expect(order.ok).toBe(true);
  expect(Order.parse({ id: 'nope' }).ok).toBe(false);
  expect(Order.accepts({})).toBe(false);
  expect(new Uuid(uuid)).toBeInstanceOf(Uuid);
  expect(Money.parse({ amount: '1', currency: 'EUR' }).ok).toBe(true);

  if (order.ok) {
    expect(Order.stringify(order.value)).toContain('"amount":"12.50"');
    expect(Order.toPlain(order.value)).toHaveProperty('id', uuid);
  }
};

resetConfigurationAfterEach();

afterEach(() => {
  globalThis.Function = original;
});

describe('codegen', () => {
  it('generates no code while the package loads', async () => {
    const generated = countGenerated();
    const copy = await freshCopy();

    expect(generated.count()).toBe(0);

    exercise(copy);

    expect(generated.count()).toBeGreaterThan(0);
  });

  it("generates nothing, the probe included, with codegen: 'off' set before the first check", async () => {
    n.configure({ codegen: 'off' });

    const generated = countGenerated();

    exercise(await freshCopy());

    expect(generated.count()).toBe(0);
  });

  it('checks the same way with and without generated code', async () => {
    n.configure({ codegen: 'off' });

    const plain = await freshCopy();
    const order = { id: 'nope', customer: 'jane', quantity: 0 };
    const withoutCode = plain.n.object({ id: plain.Uuid, customer: plain.Email }).parse(order);

    n.configure({ codegen: 'auto' });

    const generated = await freshCopy();
    const withCode = generated.n
      .object({ id: generated.Uuid, customer: generated.Email })
      .parse(order);

    expect(withoutCode).toStrictEqual(withCode);
  });

  it('keeps generated checks generated when turned off later', async () => {
    const copy = await freshCopy();

    expect(copy.Uuid.parse(uuid).ok).toBe(true);

    n.configure({ codegen: 'off' });

    const generated = countGenerated();

    expect(copy.Uuid.parse('nope').ok).toBe(false);
    expect(generated.count()).toBe(0);
  });

  it('falls back to plain checks where the runtime forbids code generation', async () => {
    globalThis.Function = new Proxy(original, {
      construct: () => {
        throw new EvalError('Code generation from strings disallowed for this context');
      },
    });

    const copy = await freshCopy();

    exercise(copy);
    expect(copy.Uuid.accepts(uuid)).toBe(true);
  });

  it('trims strings without generated code', async () => {
    n.configure({ codegen: 'off', normalize: { trimStrings: true } });

    const { Email, n: ns } = await freshCopy();

    expect(Email.accepts(' jane@example.com ')).toBe(true);
    expect(ns.object({ email: Email }).accepts({ email: ' jane@example.com ' })).toBe(true);
    expect(Email.parse(' jane ').ok).toBe(false);
  });
});

const money = { amount: '12.50', currency: 'EUR' };

// The rule of an object type is typed as a schema, which has no `accepts()` or `toPlain()`.
const called = (rule: object, name: string): unknown => {
  const method: unknown = Reflect.get(rule, name);

  if (typeof method !== 'function') {
    throw new TypeError(`no method ${name}`);
  }

  return Reflect.apply(method, rule, [money]);
};

describe('the object of a built-in type', () => {
  it.each<[string, (rule: Library['Money']['rule']) => unknown, unknown]>([
    ['a check', (rule) => called(rule, 'accepts'), true],
    [
      'its JSON Schema',
      (rule) => rule['~standard'].jsonSchema?.input({ target: 'draft-2020-12' }),
      expect.objectContaining({ type: 'object' }),
    ],
    ['a run', (rule) => 'value' in rule['~standard'].validate(money), true],
    ['a plain copy', (rule) => called(rule, 'toPlain'), money],
  ])('is built when first asked for %s', async (_, use, expected) => {
    const { Money } = await freshCopy();

    expect(use(Money.rule)).toStrictEqual(expected);
    expect(Money.parse(money).ok).toBe(true);
  });
});
