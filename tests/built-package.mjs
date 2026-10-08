import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nodeResolve } from '@rollup/plugin-node-resolve';
import { build } from 'esbuild';
import { rollup } from 'rollup';

const require = createRequire(import.meta.url);
const { name, exports } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
const root = new URL('../', import.meta.url);
const entries = Object.keys(exports).filter((entry) => entry !== './package.json');
const specifierOf = (entry) => (entry === '.' ? name : `${name}/${entry.slice(2)}`);

// The files of this package a bundler takes for an entry point, imported or required: esbuild with
// its default conditions for the browser and for Node.js, and with the conditions Vite passes.
const bundlers = [
  { platform: 'browser' },
  { platform: 'node' },
  { platform: 'browser', conditions: ['module', 'browser', 'production'] },
];

const bundledFiles = async (specifier, options, contents) => {
  const result = await build({
    ...options,
    stdin: { contents, resolveDir: fileURLToPath(root) },
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    logLevel: 'silent',
    plugins: [
      {
        name: 'peers',
        setup: (setup) => {
          // esbuild runs filters as Go regular expressions, which take no flags.
          // oxlint-disable-next-line require-unicode-regexp
          setup.onResolve({ filter: /^[^./]/ }, ({ path }) =>
            path === specifier ? undefined : { path, external: true },
          );
        },
      },
    ],
  });

  return Object.keys(result.metafile.inputs).filter((file) => file.startsWith('dist/'));
};

for (const entry of entries) {
  const specifier = specifierOf(entry);
  const esm = await import(specifier);
  const cjs = require(specifier);
  const moduleUrl = new URL(exports[entry].module, root);
  const bundled = await import(moduleUrl.href);
  const modulePath = relative(fileURLToPath(root), fileURLToPath(moduleUrl));

  ok(Object.keys(esm).length > 0, `${specifier} exports nothing`);
  deepStrictEqual(Object.keys(cjs).toSorted(), Object.keys(esm).toSorted(), specifier);
  deepStrictEqual(Object.keys(bundled).toSorted(), Object.keys(esm).toSorted(), specifier);

  // Node.js imports the build made for it, and a bundler takes the one made of a module per type
  // whether the app imports or requires the package.
  strictEqual(import.meta.resolve(specifier), new URL(exports[entry].import.default, root).href);

  for (const options of bundlers) {
    for (const contents of [
      `export * from '${specifier}';`,
      `module.exports = require('${specifier}');`,
    ]) {
      const files = await bundledFiles(specifier, options, contents);
      const label = `${JSON.stringify(options)} ${contents}`;

      ok(files.includes(modulePath), `${label} misses ${modulePath}: ${files.join(', ')}`);
      ok(
        files.every((file) => !file.startsWith('dist/node/') && !file.endsWith('.cjs')),
        `${label} takes ${files.join(', ')}`,
      );
    }
  }
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

// The CommonJS copy of the testing entry point generates for types of the ES module copy too.
for (const [{ Email, n, Uuid }, { sampleOf }] of [
  [await import(name), await import(`${name}/testing`)],
  [require(name), require(`${name}/testing`)],
  [await import(name), require(`${name}/testing`)],
]) {
  const Order = n.object({ id: Uuid, contact: Email, lines: n.of(Uuid).array({ min: 1, max: 3 }) });

  ok(sampleOf(Email, 20, { seed: 1 }).every((text) => Email.parse(text).ok));
  ok(sampleOf(Order, 20, { seed: 1 }).every((body) => Order.parse(body).ok));
}

// Records compile copies of their functions from their own source, which must survive an app
// bundler that minifies the package.
const minified = await build({
  stdin: {
    contents: `import { Latitude, Longitude, n, NonEmptyString, PositiveInteger } from '${name}';
const stock = n.record(NonEmptyString, PositiveInteger);
const point = n.tuple([Latitude, Longitude]);
const parsed = stock.parse({ a: 1 });
export const results = [parsed.ok, stock.accepts({ a: 0 }), stock.toPlain(parsed.value), stock.stringify(parsed.value), point.parse([1, 2]).ok, point.accepts([1])];`,
    resolveDir: fileURLToPath(root),
  },
  bundle: true,
  minify: true,
  write: false,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
});
const { results } = await import(
  `data:text/javascript,${encodeURIComponent(minified.outputFiles[0].text)}`
);

deepStrictEqual(results, [true, false, { a: 1 }, '{"a":1}', true, false]);

// What an app bundler keeps of `n`: Rollup, like Vite, webpack, Rolldown and Bun, keeps only the
// functions the app calls. esbuild keeps every member of a namespace another module re-exports, so
// it drops `n` only from an app that uses none of it.
const rollupBundle = async (contents) => {
  const app = await rollup({
    input: 'app',
    onwarn: (warning) => {
      throw new Error(warning.message);
    },
    plugins: [
      {
        name: 'app',
        resolveId: (source) => (source === 'app' ? source : null),
        load: (id) => (id === 'app' ? contents : null),
      },
      nodeResolve(),
    ],
  });
  const { output } = await app.generate({ format: 'es' });

  return output[0].code;
};

const esbuildBundle = async (contents) => {
  const result = await build({
    stdin: { contents, resolveDir: fileURLToPath(root) },
    bundle: true,
    write: false,
    format: 'esm',
    logLevel: 'silent',
  });

  return result.outputFiles[0].text;
};

// The text of an error each function throws, which only its own code holds.
const nFunctions = {
  of: 'n.of() takes',
  record: 'n.record(): ',
  tuple: 'n.tuple(): ',
  union: 'n.union(): ',
  oneOf: 'n.oneOf(): ',
  configure: 'n.configure(): ',
};
const kept = (code) =>
  Object.entries(nFunctions)
    .filter(([, text]) => String(code).includes(text))
    .map(([function_]) => function_);
const uses = (call) =>
  `import { n, Uuid } from '${name}'; export const out = ${call}.parse(undefined);`;

for (const bundleWith of [rollupBundle, esbuildBundle]) {
  deepStrictEqual(
    kept(await bundleWith(`import { Uuid } from '${name}'; export const out = Uuid.parse('');`)),
    [],
    bundleWith.name,
  );
}

deepStrictEqual(kept(await rollupBundle(uses('n.object({ id: Uuid })'))), ['of']);
deepStrictEqual(kept(await rollupBundle(uses('n.of(Uuid)'))), ['of']);
deepStrictEqual(kept(await rollupBundle(uses('n.tuple([Uuid])'))), ['tuple']);
deepStrictEqual(kept(await rollupBundle(uses('n.record(Uuid, Uuid)'))), ['record']);
