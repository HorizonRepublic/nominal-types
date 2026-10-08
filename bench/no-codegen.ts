// Run twice to compare: `node bench/no-codegen.ts` and
// `node --disallow-code-generation-from-strings bench/no-codegen.ts`. mitata generates its own
// loop with `new Function`, so this file times a plain loop instead.
import { Email, Integer, n } from '../src/index.ts';
import { Order, orderInput, valueOf } from './order.ts';

const order = orderInput(1);
const value = valueOf(Order.parse(order));
let sink: unknown;

const time = (name: string, iterations: number, call: () => unknown): void => {
  const rounds: number[] = [];

  for (let round = 0; round < 7; round += 1) {
    const start = process.hrtime.bigint();

    for (let index = 0; index < iterations; index += 1) {
      sink = call();
    }

    rounds.push(Number(process.hrtime.bigint() - start) / iterations);
  }

  rounds.sort((first, second) => first - second);
  console.log(`${name.padEnd(28)} ${(rounds[3] ?? 0).toFixed(1).padStart(8)} ns`);
};

time('Integer.parse(42)', 2_000_000, () => Integer.parse(42));
time('Email.parse(text)', 1_000_000, () => Email.parse('jane@example.com'));
time('Order.parse(order)', 100_000, () => Order.parse(order));
time('Order.accepts(order)', 100_000, () => Order.accepts(order));
time('Order.toPlain(value)', 200_000, () => Order.toPlain(value));
time('n.plain(value)', 200_000, () => n.plain(value));

if (sink === Symbol.for('never')) {
  console.log(sink);
}
