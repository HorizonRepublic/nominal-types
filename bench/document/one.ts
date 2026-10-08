import { medianOf } from '../environment.ts';
import { buildDocument, withManyErrors, withOneError } from './data.ts';
import { documentLibraries } from './libraries.ts';

const [name = ''] = process.argv.slice(2);
const library = documentLibraries.find((candidate) => candidate.name === name);

if (library === undefined) {
  throw new Error(`unknown library ${name}`);
}

const valid = buildDocument();
const scenarios: ReadonlyArray<readonly [string, unknown, boolean]> = [
  ['valid', valid, true],
  ['oneError', withOneError(valid), false],
  ['manyErrors', withManyErrors(valid), false],
];

const times: Record<string, number> = {};

for (const [title, document, expected] of scenarios) {
  if (library.accepted(library.validate(document)) !== expected) {
    throw new Error(`${library.name} answers wrongly on "${title}"; nothing was timed`);
  }

  times[title] = await medianOf(() => library.validate(document));
}

console.log(JSON.stringify(times));
