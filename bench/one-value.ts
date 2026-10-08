import { bench, do_not_optimize, run } from 'mitata';

import { poolSize } from './inputs.ts';
import type { Case } from './suites/case.ts';

const [suite = '', name = ''] = process.argv.slice(2);

const casesOf = async (): Promise<readonly Case[]> => {
  switch (suite) {
    case 'library': {
      const [{ libraries }, { scenarios }] = await Promise.all([
        import('./libraries.ts'),
        import('./scenarios.ts'),
      ]);
      const library = libraries.find((candidate) => candidate.name === name);

      if (library === undefined) {
        throw new Error(`unknown library ${name}`);
      }

      return scenarios.flatMap((scenario): Case[] => {
        const check = scenario.pick(library);

        return check === undefined
          ? []
          : [[scenario.title, scenario.inputs, (input) => check(input)]];
      });
    }

    case 'operations':
      return (await import('./suites/operations.ts')).operations;
    case 'levels':
      return (await import('./suites/operations.ts')).levels;
    case 'ark-object':
      return [(await import('./suites/ark-object.ts')).arkObjectCase(name)];

    default:
      throw new Error(`unknown suite ${suite}`);
  }
};

const cases = await casesOf();
const last = poolSize - 1;

for (const [title, inputs, work] of cases) {
  let index = 0;

  // mitata times one call at a time, at the timer's 42 ns steps on Apple silicon, when the first
  // call is slow; a type builds its check on first use, so every case runs its pool once first.
  for (const [at, input] of inputs.entries()) {
    do_not_optimize(work(input, at));
  }

  bench(title, () => {
    index = (index + 1) & last;
    do_not_optimize(work(inputs[index], index));
  });
}

const { benchmarks } = await run({ format: 'quiet' });
const medians = Object.fromEntries(
  cases.map(([title], at) => [title, benchmarks[at]?.runs[0]?.stats?.p50 ?? null]),
);

console.log(JSON.stringify(medians));
