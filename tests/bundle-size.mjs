import { deepEqual, ok } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
const { name, exports } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

const fileOf = (specifier) => {
  const entry = specifier === name ? '.' : `.${specifier.slice(name.length)}`;

  return fileURLToPath(new URL(exports[entry].module, root));
};

// esbuild runs filters as Go regular expressions, which take no flags.
// oxlint-disable require-unicode-regexp
const ownSpecifier = new RegExp(`^${name}(?:/|$)`);
const bareSpecifier = /^[^./]/;
// oxlint-enable require-unicode-regexp

const bundle = async (code) => {
  const result = await build({
    stdin: { contents: code, loader: 'js', resolveDir: fileURLToPath(root) },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'package',
        setup: (setup) => {
          setup.onResolve({ filter: ownSpecifier }, ({ path }) => ({ path: fileOf(path) }));
          setup.onResolve({ filter: bareSpecifier }, ({ path }) => ({ path, external: true }));
        },
      },
    ],
  });

  // A warning here, such as an import kept only for a side effect, shows up in every app's build.
  deepEqual(
    result.warnings.map((warning) => warning.text),
    [],
    'esbuild warns about the package',
  );

  return result.outputFiles[0].contents;
};

const adapter = (entry, use) =>
  `import { Uuid } from '${name}'; import { ${use} } from '${name}/adapters/${entry}'; globalThis.out = ${use}(Uuid);`;

// Upper bounds in KiB, a little above the sizes measured when they were set, so a change that
// pulls unused types or helpers into an app's bundle fails here.
const cases = [
  ['only Uuid', `import { Uuid } from '${name}'; globalThis.out = Uuid.parse('');`, 28, 9.8],
  ['only Email', `import { Email } from '${name}'; globalThis.out = Email.parse('');`, 27.9, 9.8],
  [
    'only Integer',
    `import { Integer } from '${name}'; globalThis.out = Integer.parse(1);`,
    26.6,
    9.3,
  ],
  [
    'n.object and three types',
    `import { Email, n, PositiveInteger, Uuid } from '${name}'; globalThis.out = n.object({ id: Uuid, email: Email, age: PositiveInteger }).parse({});`,
    64.9,
    21.5,
  ],
  ['everything', `import * as all from '${name}'; globalThis.out = all;`, 109.5, 37.9],
  [
    'temporal PlainDate',
    `import { PlainDate } from '${name}/temporal'; globalThis.out = PlainDate.parse('');`,
    28.4,
    9.9,
  ],
  [
    'testing',
    `import { Email } from '${name}'; import { arbitraryOf } from '${name}/testing'; globalThis.out = arbitraryOf(Email);`,
    58.6,
    21.7,
  ],
  ['arktype', adapter('arktype', 'toArk'), 29.1, 10.2],
  ['class-validator', adapter('class-validator', 'NominalField'), 29.1, 10.2],
  ['drizzle', adapter('drizzle', 'toDrizzle'), 38.1, 13.1],
  [
    'fastify',
    `import { fastifyNominal } from '${name}/adapters/fastify'; globalThis.out = fastifyNominal;`,
    30.2,
    10.4,
  ],
  ['graphql', adapter('graphql', 'toGraphQL'), 30.7, 10.8],
  ['mikro-orm', adapter('mikro-orm', 'toMikroOrm'), 38.6, 13.3],
  [
    'nest',
    `import { Uuid } from '${name}'; import { NominalPipe } from '${name}/adapters/nest'; globalThis.out = new NominalPipe(Uuid);`,
    30,
    10.5,
  ],
  ['sequelize', adapter('sequelize', 'toSequelize'), 38.2, 13.1],
  ['superjson', adapter('superjson', 'toSuperjson'), 28.8, 10.1],
  ['swagger', adapter('swagger', 'ApiNominalProperty'), 28.8, 10.1],
  ['typeorm', adapter('typeorm', 'toTypeOrm'), 38.2, 13.1],
  ['valibot', adapter('valibot', 'toValibot'), 28.8, 10.1],
  ['zod', adapter('zod', 'toZod'), 28.8, 10.1],
];

const kib = (bytes) => Math.round((bytes / 1024) * 10) / 10;

const rows = [];

for (const [label, code, minified, gzipped] of cases) {
  const output = await bundle(code);
  const size = { label, minified: kib(output.length), gzipped: kib(gzipSync(output).length) };

  rows.push(size);
  ok(size.minified <= minified, `${label}: ${size.minified} KiB minified, over ${minified} KiB`);
  ok(size.gzipped <= gzipped, `${label}: ${size.gzipped} KiB gzipped, over ${gzipped} KiB`);
}

// The table is the report this script exists for.
// oxlint-disable-next-line no-console
console.table(rows);
