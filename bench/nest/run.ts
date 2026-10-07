import { execFileSync } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';

const scenario = fileURLToPath(new URL('dist/nest/scenario.js', import.meta.url));
const typia = fileURLToPath(new URL('../typia/dist/validators.js', import.meta.url));

interface Times {
  readonly valid: number;
  readonly oneError: number;
  readonly manyErrors: number;
}

const isTimes = (value: unknown): value is Times =>
  typeof value === 'object' && value !== null && typeof Reflect.get(value, 'valid') === 'number';

// Every setup runs in a process of its own, so no library warms up, deoptimises or fills the heap
// for another.
const measure = (setup: string, unrelated: number): Times => {
  const output = execFileSync(process.execPath, [scenario, setup, String(unrelated), typia], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const times: unknown = JSON.parse(output.trim().split('\n').at(-1) ?? '{}');

  if (!isTimes(times)) {
    throw new Error(`${setup} printed no times`);
  }

  return times;
};

const rows: ReadonlyArray<readonly [string, number]> = [
  ['typia', 0],
  ['arktype', 0],
  ['valibot', 0],
  ['zod', 0],
  ['nominal-types + ArkType adapter', 0],
  ['nominal-types + ArkType, schemaOf()', 0],
  ['class-validator', 0],
  ['nominal-types + class-validator', 0],
  ['class-validator', 1000],
  ['nominal-types + class-validator', 1000],
];

const format = (value: number): string =>
  value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value.toFixed(0)} ms`;

const lines = rows.map(([setup, unrelated]) => {
  const times = measure(setup, unrelated);
  const name = unrelated === 0 ? setup : `${setup}, with ${unrelated} other DTOs in the app`;

  return `| ${name} | ${format(times.valid)} | ${format(times.oneError)} | ${format(times.manyErrors)} |`;
});

console.log(
  `\nA 3 MB JSON body posted to a NestJS 12 app on Fastify; time per request, median of five. ${cpus()[0]?.model ?? 'unknown CPU'}, Node.js ${process.version}, ${new Date().toISOString().slice(0, 10)}.\n`,
);
console.log('| Setup | Valid | One error deep inside | Every hundredth email broken |');
console.log('| --- | ---: | ---: | ---: |');
console.log(lines.join('\n'));
