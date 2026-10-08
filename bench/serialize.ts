import { bench, do_not_optimize, group, run } from 'mitata';

import { n } from '../src/index.ts';
import { Order, orderInput, valueOf } from './order.ts';

const measure = (name: string, call: () => unknown): void => {
  bench(name, () => {
    do_not_optimize(call());
  });
};

const Orders = Order.array();
const plainOrder = orderInput(1);
const plainOrders = Array.from({ length: 1000 }, (_, index) => orderInput(index));
const order = valueOf(Order.parse(plainOrder));
const orders = valueOf(Orders.parse(plainOrders));

if (JSON.stringify(Orders.toPlain(orders)) !== JSON.stringify(orders)) {
  throw new Error('toPlain() must write what JSON.stringify() writes');
}

group('one order', () => {
  measure('JSON.stringify(plain values)', () => JSON.stringify(plainOrder));
  measure('JSON.stringify(parsed)', () => JSON.stringify(order));
  measure('JSON.stringify(n.plain(parsed))', () => JSON.stringify(n.plain(order)));
  measure('JSON.stringify(Order.toPlain(parsed))', () => JSON.stringify(Order.toPlain(order)));
  measure('n.plain(parsed) alone', () => n.plain(order));
  measure('Order.toPlain(parsed) alone', () => Order.toPlain(order));
});

group('1000 orders', () => {
  measure('JSON.stringify(plain values)', () => JSON.stringify(plainOrders));
  measure('JSON.stringify(parsed)', () => JSON.stringify(orders));
  measure('JSON.stringify(n.plain(parsed))', () => JSON.stringify(n.plain(orders)));
  measure('JSON.stringify(Orders.toPlain(parsed))', () => JSON.stringify(Orders.toPlain(orders)));
});

await run({ format: process.env['BENCH_FORMAT'] === 'markdown' ? 'markdown' : 'mitata' });
