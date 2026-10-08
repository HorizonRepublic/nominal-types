import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { name, exports } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
const entries = Object.keys(exports).filter((entry) => entry !== './package.json');

for (const entry of entries) {
  const specifier = entry === '.' ? name : `${name}/${entry.slice(2)}`;
  const esm = await import(specifier);
  const cjs = require(specifier);

  ok(Object.keys(esm).length > 0, `${specifier} exports nothing`);
  deepStrictEqual(Object.keys(cjs).toSorted(), Object.keys(esm).toSorted(), specifier);
}

for (const { AnyString, Email, NominalError } of [await import(name), require(name)]) {
  const Code = AnyString.subtype('dist.Code', /^[A-Z]{3}$/u);

  strictEqual(new Email('jane@example.com').value, 'jane@example.com');
  strictEqual(new Code('ABC').value, 'ABC');
  throws(() => new Email('nope'), NominalError);
}

for (const [{ Email }, { toZod }] of [
  [await import(name), await import(`${name}/adapters/zod`)],
  [require(name), require(`${name}/adapters/zod`)],
]) {
  strictEqual(toZod(Email).parse('jane@example.com').value, 'jane@example.com');
}
