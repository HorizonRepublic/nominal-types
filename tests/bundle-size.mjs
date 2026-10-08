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
  ['only Uuid', `import { Uuid } from '${name}'; globalThis.out = Uuid.parse('');`, 26.9, 9.5],
  ['only Email', `import { Email } from '${name}'; globalThis.out = Email.parse('');`, 26.6, 9.5],
  [
    'only Integer',
    `import { Integer } from '${name}'; globalThis.out = Integer.parse(1);`,
    25.5,
    9,
  ],
  [
    'n.object and three types',
    `import { Email, n, PositiveInteger, Uuid } from '${name}'; globalThis.out = n.object({ id: Uuid, email: Email, age: PositiveInteger }).parse({});`,
    75.7,
    24.7,
  ],
  ['everything', `import * as all from '${name}'; globalThis.out = all;`, 120.3, 41],
  [
    'temporal PlainDate',
    `import { PlainDate } from '${name}/temporal'; globalThis.out = PlainDate.parse('');`,
    27.2,
    9.7,
  ],
  [
    'testing',
    `import { Email } from '${name}'; import { arbitraryOf } from '${name}/testing'; globalThis.out = arbitraryOf(Email);`,
    58.1,
    21.6,
  ],
  ['arktype', adapter('arktype', 'toArk'), 28, 9.9],
  ['class-validator', adapter('class-validator', 'NominalField'), 28, 9.9],
  ['drizzle', adapter('drizzle', 'toDrizzle'), 36.9, 12.8],
  [
    'fastify',
    `import { fastifyNominal } from '${name}/adapters/fastify'; globalThis.out = fastifyNominal;`,
    29.1,
    10.1,
  ],
  ['graphql', adapter('graphql', 'toGraphQL'), 29.6, 10.5],
  ['mikro-orm', adapter('mikro-orm', 'toMikroOrm'), 37.6, 13],
  [
    'nest',
    `import { Uuid } from '${name}'; import { NominalPipe } from '${name}/adapters/nest'; globalThis.out = new NominalPipe(Uuid);`,
    28.8,
    10.2,
  ],
  ['sequelize', adapter('sequelize', 'toSequelize'), 37.1, 13],
  ['superjson', adapter('superjson', 'toSuperjson'), 27.6, 9.7],
  ['swagger', adapter('swagger', 'ApiNominalProperty'), 27.7, 9.8],
  ['typeorm', adapter('typeorm', 'toTypeOrm'), 37.1, 12.9],
  ['valibot', adapter('valibot', 'toValibot'), 27.7, 9.8],
  ['zod', adapter('zod', 'toZod'), 27.6, 9.8],
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
