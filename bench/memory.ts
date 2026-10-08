// Run with `node --expose-gc bench/memory.ts`: the heap one order takes as parsed JSON, as
// `Order.parse()` gives it, and as `Order.toPlain()` gives it back.
import { Order, orderInput, valueOf } from './order.ts';

const count = 10_000;
const json = JSON.stringify(Array.from({ length: count }, (_, index) => orderInput(index)));

const collect = (): number => {
  const gc: unknown = Reflect.get(globalThis, 'gc');

  if (typeof gc !== 'function') {
    throw new TypeError('run with node --expose-gc');
  }

  Reflect.apply(gc, undefined, []);
  Reflect.apply(gc, undefined, []);

  return process.memoryUsage().heapUsed;
};

const measure = (name: string, build: () => unknown): void => {
  const before = collect();
  const kept = build();
  const after = collect();

  console.log(`${name.padEnd(24)} ${((after - before) / count).toFixed(0).padStart(6)} bytes`);

  if (kept === undefined) {
    console.log('nothing was kept');
  }
};

const plainValues = (): unknown => JSON.parse(json);

measure('JSON.parse()', plainValues);
measure('Order.parse()', () => {
  const list: unknown = JSON.parse(json);

  return Array.isArray(list) ? list.map((order: unknown) => valueOf(Order.parse(order))) : [];
});
measure('Order.toPlain(parsed)', () => {
  const list: unknown = JSON.parse(json);

  return Array.isArray(list)
    ? list.map((order: unknown) => Order.toPlain(valueOf(Order.parse(order))))
    : [];
});
