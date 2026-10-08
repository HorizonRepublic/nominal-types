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
  ['only Uuid', `import { Uuid } from '${name}'; globalThis.out = Uuid.parse('');`, 25, 8.9],
  ['only Email', `import { Email } from '${name}'; globalThis.out = Email.parse('');`, 24.8, 8.8],
  [
    'only Integer',
    `import { Integer } from '${name}'; globalThis.out = Integer.parse(1);`,
    23.5,
    8.3,
  ],
  [
    'n.object and three types',
    `import { Email, n, PositiveInteger, Uuid } from '${name}'; globalThis.out = n.object({ id: Uuid, email: Email, age: PositiveInteger }).parse({});`,
    58.4,
    19.4,
  ],
  ['everything', `import * as all from '${name}'; globalThis.out = all;`, 103, 35.7],
  [
    'temporal PlainDate',
    `import { PlainDate } from '${name}/temporal'; globalThis.out = PlainDate.parse('');`,
    25,
    8.9,
  ],
  [
    'testing',
    `import { Email } from '${name}'; import { arbitraryOf } from '${name}/testing'; globalThis.out = arbitraryOf(Email);`,
    55.5,
    20.7,
  ],
  ['arktype', adapter('arktype', 'toArk'), 26, 9.2],
  ['class-validator', adapter('class-validator', 'NominalField'), 26, 9.3],
  ['drizzle', adapter('drizzle', 'toDrizzle'), 34.5, 12],
  [
    'fastify',
    `import { fastifyNominal } from '${name}/adapters/fastify'; globalThis.out = fastifyNominal;`,
    27,
    9.4,
  ],
  ['graphql', adapter('graphql', 'toGraphQL'), 27.3, 9.7],
  ['mikro-orm', adapter('mikro-orm', 'toMikroOrm'), 35, 12.2],
  [
    'nest',
    `import { Uuid } from '${name}'; import { NominalPipe } from '${name}/adapters/nest'; globalThis.out = new NominalPipe(Uuid);`,
    26.8,
    9.5,
  ],
  ['sequelize', adapter('sequelize', 'toSequelize'), 34.6, 12.1],
  ['superjson', adapter('superjson', 'toSuperjson'), 25.7, 9.1],
  ['swagger', adapter('swagger', 'ApiNominalProperty'), 25.7, 9.1],
  ['typeorm', adapter('typeorm', 'toTypeOrm'), 34.6, 12],
  ['valibot', adapter('valibot', 'toValibot'), 25.8, 9.2],
  ['zod', adapter('zod', 'toZod'), 25.7, 9.2],
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
