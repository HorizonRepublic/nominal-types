import { fileURLToPath } from 'node:url';

import { environment, inOwnProcess } from '../environment.ts';
import { buildDocument } from './data.ts';
import { documentLibraries } from './libraries.ts';

const child = fileURLToPath(new URL('one.ts', import.meta.url));
const size = (JSON.stringify(buildDocument()).length / 1024 / 1024).toFixed(1);

const isTimes = (value: unknown): value is Readonly<Record<string, number>> =>
  typeof value === 'object' && value !== null && typeof Reflect.get(value, 'valid') === 'number';

const milliseconds = (value: number | undefined): string => {
  if (value === undefined) {
    return '?';
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} s`;
  }

  return value >= 10 ? `${value.toFixed(0)} ms` : `${value.toFixed(1)} ms`;
};

const rows = documentLibraries.map((library) => {
  process.stderr.write(`timing ${library.name}\n`);

  const times = inOwnProcess(child, library.name);

  if (!isTimes(times)) {
    throw new Error(`${library.name} printed no times`);
  }

  const cells = ['valid', 'oneError', 'manyErrors'].map((key) => milliseconds(times[key]));

  return `| ${library.name} | ${cells.join(' | ')} |`;
});

console.log(
  `\nA ${size} MB document, each library in a process of its own. Median of nine runs after three warm-ups. ${environment()}.\n`,
);
console.log('| Library | Valid document | One error deep inside | Every hundredth email broken |');
console.log('| --- | ---: | ---: | ---: |');
console.log(rows.join('\n'));
