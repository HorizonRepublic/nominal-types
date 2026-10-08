import { describe, expect, it, vi } from 'vitest';

import { acceptors } from '../../src/core/acceptor.ts';
import { writers } from '../../src/core/plain-writers.ts';
import { runners } from '../../src/core/runner.ts';
import { unionPaths } from '../../src/core/union-shape.ts';
import type * as library from '../../src/index.ts';
import { AnyString, n, Nominal, NominalError, PositiveInteger } from '../../src/index.ts';
import {
  callAnyway,
  constructAnyway,
  card,
  invoice,
  Invoice,
  Payment,
  wrongTag,
} from '../support/object-fixtures.ts';
import { issuesOf, valueOf } from '../support/results.ts';

class PaymentMethod extends Nominal('union.PaymentMethod', Payment) {}

const Event = n.union('type', {
  paid: n.object({ payment: Payment }),
  cancelled: n.object({ reason: AnyString }),
});

const variants = [
  {
    tag: 'a',
    run: (input: unknown): unknown => input,
    accepts: (): boolean => true,
    write: (): unknown => 'A',
  },
  { tag: 'b', run: (): unknown => 'B', accepts: (): boolean => false, write: (): unknown => 'B' },
];

describe('n.union in other schemas', () => {
  it('is a field of n.object(), with paths through it', () => {
    const Order = n.object({ quantity: PositiveInteger, payment: Payment });

    expect(issuesOf(Order.parse({ quantity: 1, payment: { method: 'cash' } }))).toStrictEqual([
      { message: 'must be one of "card", "invoice" (was "cash")', path: ['payment', 'method'] },
    ]);
    expect(issuesOf(Order.parse({ quantity: 1 }))).toStrictEqual([
      { message: 'is required', path: ['payment'] },
    ]);
  });

  it('builds arrays, optional and nullable values', () => {
    expect(issuesOf(Payment.array().parse([card, { method: 'x' }]))).toStrictEqual([
      { message: 'must be one of "card", "invoice" (was "x")', path: [1, 'method'] },
    ]);
    expect(Payment.optional().parse(undefined).ok).toBe(true);
    expect(Payment.nullable().parse(null).ok).toBe(true);
  });

  it('nests: a variant holds another union', () => {
    expect(issuesOf(Event.parse({ type: 'paid', payment: { method: 'card' } }))).toStrictEqual([
      { message: 'is required', path: ['payment', 'token'] },
    ]);
    expect(valueOf(Event.parse({ type: 'paid', payment: card })).type).toBe('paid');
    expect(Event.accepts({ type: 'paid', payment: card })).toBe(true);
    expect(Event.accepts({ type: 'paid', payment: { method: 'card' } })).toBe(false);
  });

  it('is the rule of a nominal type, whose value is the union', () => {
    const method = new PaymentMethod(card);

    expect(method.value.method).toBe('card');
    expect(Object.isFrozen(method.value)).toBe(true);
    expect(JSON.stringify(method)).toBe('{"method":"card","token":"tok_1"}');
    expect(() => constructAnyway(PaymentMethod, { method: 'cash' })).toThrow(
      new NominalError('union.PaymentMethod', wrongTag('"cash"')),
    );
  });

  it('takes variants built by another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../src/index.ts');
    const Mixed = n.union('method', {
      card: copy.n.object({ token: copy.NonBlankString }).strict(),
      invoice: Invoice,
    });

    expect(valueOf(Mixed.parse(card)).method).toBe('card');
    expect(issuesOf(Mixed.parse({ method: 'card', token: '' }))).toStrictEqual([
      { message: 'must be a non-empty string (was "")', path: ['token'] },
    ]);
    expect(Mixed.accepts(card)).toBe(true);
    expect(JSON.stringify(Mixed.toPlain(valueOf(Mixed.parse(card))))).toBe(
      '{"token":"tok_1","method":"card"}',
    );
    expect(copy.n.object({ payment: Mixed }).parse({ payment: card }).ok).toBe(true);
  });
});

describe('n.union accepts() and toPlain()', () => {
  it.each([card, invoice, { method: 'cash' }, {}, null, [], { method: 'card' }, 'x'])(
    'accepts() agrees with parse() on %j',
    (input) => {
      expect(Payment.accepts(input)).toBe(Payment.parse(input).ok);
    },
  );

  it('toPlain() writes the variant the tag picks, as plain values', () => {
    expect(Payment.toPlain(valueOf(Payment.parse(card)))).toStrictEqual(card);
    expect(Payment.toPlain(valueOf(Payment.parse(invoice)))).toStrictEqual(invoice);
  });

  it('toPlain() writes a value with an unknown tag as n.plain() would', () => {
    expect(
      callAnyway(Payment, 'toPlain', { method: 'cash', amount: new PositiveInteger(2) }),
    ).toStrictEqual({ method: 'cash', amount: 2 });
    expect(callAnyway(Payment, 'toPlain', 'x')).toBe('x');
  });

  it('registers its paths, so an object holding it calls them directly', () => {
    expect(runners.has(Payment)).toBe(true);
    expect(acceptors.has(Payment)).toBe(true);
    expect(writers.has(Payment)).toBe(true);
  });
});

describe('n.union without code generation', () => {
  const generated = unionPaths('kind', variants, 'one of "a", "b"');
  const looped = unionPaths('kind', variants, 'one of "a", "b"', false);

  it.each([{ kind: 'a' }, { kind: 'b' }, { kind: 'c' }, {}, null, [], 1])(
    'dispatches %j the same way',
    (input) => {
      expect(looped.run(input)).toStrictEqual(generated.run(input));
      expect(looped.accepts(input)).toBe(generated.accepts(input));
      expect(looped.write(input)).toStrictEqual(generated.write(input));
    },
  );

  it('reads own keys only', () => {
    const input = {};

    Reflect.setPrototypeOf(input, { kind: 'a' });

    expect(looped.run(input)).toStrictEqual(generated.run({}));
  });
});
