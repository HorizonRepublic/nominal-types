import { libraries } from './libraries.ts';

type Scenario = 'sku' | 'uuid' | 'email' | 'positiveInteger' | 'uuidList';

const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

const cases: ReadonlyArray<readonly [Scenario, unknown, unknown]> = [
  ['sku', 'SKU-1234', 'SKU-12'],
  ['uuid', id, 'nope'],
  ['email', 'jane.doe@example.com', 'not an address'],
  ['positiveInteger', 42, 0],
  ['uuidList', [id], [id, 'nope']],
];

let failures = 0;

for (const library of libraries) {
  for (const [scenario, valid, invalid] of cases) {
    const check = library[scenario];

    if (check === undefined) {
      continue;
    }

    const good = library.accepted(check(valid));
    const bad = library.accepted(check(invalid));

    if (!good || bad) {
      failures += 1;
      console.log(`${library.name} ${scenario}: valid ${String(good)}, invalid ${String(bad)}`);
    }
  }
}

console.log(
  failures === 0 ? 'every check answers as expected' : `${failures} checks answer wrongly`,
);
process.exitCode = failures === 0 ? 0 : 1;
