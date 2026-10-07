import { cpus } from 'node:os';

import { bench, do_not_optimize, group, run } from 'mitata';

import { AnyNumber, FiniteNumber, Integer, PositiveInteger, Uint16 } from '../src/index.ts';
import { libraries } from './libraries.ts';
import type { Check, Library } from './libraries.ts';

const ids = Array.from(
  { length: 1000 },
  (_, index) => `0190f1c2-3b4a-7c5d-8e9f-${String(index).padStart(12, '0')}`,
);

interface Scenario {
  readonly title: string;
  readonly pick: (library: Library) => Check | undefined;
  readonly input: unknown;
}

const scenarios: readonly Scenario[] = [
  { title: 'the same pattern, valid', pick: (library) => library.sku, input: 'SKU-1234' },
  { title: 'the same pattern, invalid', pick: (library) => library.sku, input: 'nope' },
  { title: 'UUID, valid', pick: (library) => library.uuid, input: ids[0] },
  { title: 'email, valid', pick: (library) => library.email, input: 'jane.doe@example.com' },
  { title: 'positive integer, valid', pick: (library) => library.positiveInteger, input: 42 },
  { title: '1000 UUIDs in an array', pick: (library) => library.uuidList, input: ids },
];

class Port extends Uint16.subtype('BenchPort') {}

const levels: ReadonlyArray<readonly [string, (input: unknown) => unknown]> = [
  ['AnyNumber, 1 rule', (input) => AnyNumber.parse(input)],
  ['FiniteNumber, 2 rules', (input) => FiniteNumber.parse(input)],
  ['Integer, 3 rules', (input) => Integer.parse(input)],
  ['PositiveInteger, 4 rules', (input) => PositiveInteger.parse(input)],
  ['Uint16, 4 rules', (input) => Uint16.parse(input)],
  ['Port under Uint16, 4 rules, 2 more classes', (input) => Port.parse(input)],
];

const cells: Array<{ readonly row: string; readonly column: string }> = [];

for (const scenario of scenarios) {
  group(scenario.title, () => {
    for (const library of libraries) {
      const check = scenario.pick(library);

      if (check !== undefined) {
        cells.push({ row: scenario.title, column: library.name });
        bench(library.name, () => {
          do_not_optimize(check(scenario.input));
        });
      }
    }
  });
}

group('nominal-types, cost per level', () => {
  for (const [name, parse] of levels) {
    cells.push({ row: name, column: 'nominal-types' });
    bench(name, () => {
      do_not_optimize(parse(8080));
    });
  }
});

const { benchmarks } = await run({ format: process.argv.includes('--quiet') ? 'quiet' : 'mitata' });

const nanoseconds = (value: number | undefined): string => {
  if (value === undefined) {
    return '?';
  }

  return value >= 1000 ? `${(value / 1000).toFixed(1)} µs` : `${value.toFixed(0)} ns`;
};

const timeOf = new Map(
  cells.map((cell, index) => [
    `${cell.row}|${cell.column}`,
    benchmarks[index]?.runs[0]?.stats?.p50,
  ]),
);

const names = libraries.map((library) => library.name);
const rows = scenarios.map(
  (scenario) =>
    `| ${scenario.title} | ${names
      .map((name) =>
        timeOf.has(`${scenario.title}|${name}`)
          ? nanoseconds(timeOf.get(`${scenario.title}|${name}`))
          : '—',
      )
      .join(' | ')} |`,
);
const levelRows = levels.map(
  ([name]) => `| ${name} | ${nanoseconds(timeOf.get(`${name}|nominal-types`))} |`,
);

console.log(
  `\nMedian time per call. ${cpus()[0]?.model ?? 'unknown CPU'}, Node.js ${process.version}, ${new Date().toISOString().slice(0, 10)}.\n`,
);
console.log(
  [
    `| Scenario | ${names.join(' | ')} |`,
    `| --- | ${names.map(() => '---:').join(' | ')} |`,
    ...rows,
  ].join('\n'),
);
console.log(`\n| nominal-types type | Median |\n| --- | ---: |\n${levelRows.join('\n')}`);
