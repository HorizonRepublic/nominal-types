import { fileURLToPath } from 'node:url';

import { environment, inOwnProcess } from './environment.ts';
import { libraries } from './libraries.ts';
import { scenarios } from './scenarios.ts';
import { arkObjectSetups } from './suites/ark-object.ts';

const child = fileURLToPath(new URL('one-value.ts', import.meta.url));

const isMedians = (value: unknown): value is Readonly<Record<string, number | null>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const measure = (suite: string, name = ''): Readonly<Record<string, number | null>> => {
  process.stderr.write(`timing ${suite} ${name}\n`);

  const medians = inOwnProcess(child, suite, name);

  if (!isMedians(medians)) {
    throw new Error(`${suite} ${name} printed no times`);
  }

  return medians;
};

const time = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return '—';
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} µs`;
  }

  return value >= 10 ? `${value.toFixed(0)} ns` : `${value.toFixed(1)} ns`;
};

const table = (header: readonly string[], rows: ReadonlyArray<readonly string[]>): string =>
  [
    `| ${header.join(' | ')} |`,
    `| ${header.map((_, index) => (index === 0 ? '---' : '---:')).join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');

const byLibrary = new Map(
  libraries.map((library) => [library.name, measure('library', library.name)]),
);
const operations = measure('operations');
const levels = measure('levels');
const arkObject = Object.fromEntries(
  arkObjectSetups.map((setup) => [setup, measure('ark-object', setup)[setup]]),
);

const names = [...byLibrary.keys()];

console.log(`\nMedian time per call, each library in a process of its own. ${environment()}.\n`);
console.log(
  table(
    ['Scenario', ...names],
    scenarios.map((scenario) =>
      [scenario.title].concat(names.map((name) => time(byLibrary.get(name)?.[scenario.title]))),
    ),
  ),
);
console.log(
  `\n${table(
    ['Operation', 'Time'],
    Object.entries(operations).map(([title, value]) => [title, time(value)]),
  )}`,
);
console.log(
  `\n${table(
    ['nominal-types type', 'Median'],
    Object.entries(levels).map(([title, value]) => [title, time(value)]),
  )}`,
);
console.log(
  `\n${table(
    ['Setup', 'Time'],
    Object.entries(arkObject).map(([title, value]) => [title, time(value)]),
  )}`,
);
