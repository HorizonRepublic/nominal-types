import { cpus } from 'node:os';

import { buildDocument, withManyErrors, withOneError } from './data.ts';
import { documentLibraries } from './libraries.ts';

const valid = buildDocument();
const scenarios: ReadonlyArray<readonly [string, unknown, boolean]> = [
  ['valid document', valid, true],
  ['one error deep inside', withOneError(valid), false],
  ['every hundredth email broken', withManyErrors(valid), false],
];

const size = (JSON.stringify(valid).length / 1024 / 1024).toFixed(1);

let wrong = 0;

for (const library of documentLibraries) {
  for (const [title, document, expected] of scenarios) {
    if (library.accepted(library.validate(document)) !== expected) {
      wrong += 1;
      console.log(`${library.name} answers wrongly on "${title}"`);
    }
  }
}

if (wrong > 0) {
  process.exitCode = 1;

  throw new Error(`${wrong} answers were wrong; nothing was timed`);
}

const median = (run: () => unknown): number => {
  run();
  run();

  const times: number[] = [];

  for (let index = 0; index < 5; index += 1) {
    const started = performance.now();

    run();
    times.push(performance.now() - started);
  }

  times.sort((left, right) => left - right);

  return times[2] ?? Number.NaN;
};

const milliseconds = (value: number): string =>
  value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value.toFixed(1)} ms`;

const rows = documentLibraries.map((library) => {
  const cells = scenarios.map(([, document]) =>
    milliseconds(median(() => library.validate(document))),
  );

  return `| ${library.name} | ${cells.join(' | ')} |`;
});

console.log(
  `\nA ${size} MB document. Median of five runs. ${cpus()[0]?.model ?? 'unknown CPU'}, Node.js ${process.version}, ${new Date().toISOString().slice(0, 10)}.\n`,
);
console.log(`| Library | ${scenarios.map(([title]) => title).join(' | ')} |`);
console.log(`| --- | ${scenarios.map(() => '---:').join(' | ')} |`);
console.log(rows.join('\n'));
