import { bench, do_not_optimize, group, run } from 'mitata';

import { Email, Integer, NominalError } from '../src/index.ts';
import { Order, orderInput } from './order.ts';

const measure = (name: string, call: () => unknown): void => {
  bench(name, () => {
    do_not_optimize(call());
  });
};

const order = orderInput(1);
const brokenOrder = { ...order, email: 'jane' };
const isInteger = (value: unknown): boolean => Number.isInteger(value);

const construct = (make: () => unknown): unknown => {
  try {
    return make();
  } catch (error) {
    if (error instanceof NominalError) {
      return error;
    }

    throw error;
  }
};

group('a value that passes', () => {
  measure('Number.isInteger(42) alone', () => isInteger(42));
  measure('Integer.accepts(42)', () => Integer.accepts(42));
  measure('Integer.parse(42)', () => Integer.parse(42));
  measure('Email.accepts(text)', () => Email.accepts('jane@example.com'));
  measure('Email.parse(text)', () => Email.parse('jane@example.com'));
  measure('Order.accepts(order)', () => Order.accepts(order));
  measure('Order.parse(order)', () => Order.parse(order));
});

group('a value that fails', () => {
  measure('Integer.accepts(4.2)', () => Integer.accepts(4.2));
  measure('Integer.parse(4.2)', () => Integer.parse(4.2));
  measure('new Integer(4.2), caught', () => construct(() => new Integer(4.2)));
  measure('Email.parse(invalid)', () => Email.parse('jane'));
  measure('new Email(invalid), caught', () => construct(() => new Email('jane')));
  measure('Order.accepts(bad email)', () => Order.accepts(brokenOrder));
  measure('Order.parse(bad email)', () => Order.parse(brokenOrder));
});

await run({ format: process.env['BENCH_FORMAT'] === 'markdown' ? 'markdown' : 'mitata' });
