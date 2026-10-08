import { deepEqual, ok } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { nodeResolve } from '@rollup/plugin-node-resolve';
import { build, transform } from 'esbuild';
import { rollup } from 'rollup';

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

// Rollup, as Vite and webpack do, keeps only the `n` functions an app calls; esbuild keeps every
// member of a namespace another module re-exports.
const bundleWithRollup = async (code) => {
  const app = await rollup({
    input: 'app',
    onwarn: (warning) => {
      throw new Error(warning.message);
    },
    plugins: [
      {
        name: 'package',
        resolveId: (source) => {
          if (source === 'app') {
            return source;
          }

          return bareSpecifier.test(source) && !ownSpecifier.test(source) ? false : null;
        },
        load: (id) => (id === 'app' ? code : null),
      },
      nodeResolve(),
    ],
  });
  const { output } = await app.generate({ format: 'es' });
  const { code: minified } = await transform(output[0].code, { minify: true, format: 'esm' });

  return Buffer.from(minified);
};

const adapter = (entry, use) =>
  `import { Uuid } from '${name}'; import { ${use} } from '${name}/adapters/${entry}'; globalThis.out = ${use}(Uuid);`;

// Upper bounds in KiB, a little above the sizes measured when they were set, so a change that
// pulls unused types or helpers into an app's bundle fails here.
const cases = [
  ['only Uuid', `import { Uuid } from '${name}'; globalThis.out = Uuid.parse('');`, 27.1, 9.6],
  ['only Email', `import { Email } from '${name}'; globalThis.out = Email.parse('');`, 26.9, 9.6],
  [
    'only Integer',
    `import { Integer } from '${name}'; globalThis.out = Integer.parse(1);`,
    25.5,
    9,
  ],
  [
    'n.object and three types',
    `import { Email, n, PositiveInteger, Uuid } from '${name}'; globalThis.out = n.object({ id: Uuid, email: Email, age: PositiveInteger }).parse({});`,
    77.2,
    25.4,
  ],
  [
    'only n.object',
    `import { n, Uuid } from '${name}'; globalThis.out = n.object({ id: Uuid }).parse({});`,
    74.5,
    24.4,
  ],
  [
    'only n.of',
    `import { n, Uuid } from '${name}'; globalThis.out = n.of(Uuid).parse('');`,
    74.5,
    24.4,
  ],
  ['everything', `import * as all from '${name}'; globalThis.out = all;`, 122.4, 41.4],
  [
    'temporal PlainDate',
    `import { PlainDate } from '${name}/temporal'; globalThis.out = PlainDate.parse('');`,
    27.2,
    9.7,
  ],
  [
    'testing',
    `import { Email } from '${name}'; import { arbitraryOf } from '${name}/testing'; globalThis.out = arbitraryOf(Email);`,
    58.4,
    21.7,
  ],
  ['arktype', adapter('arktype', 'toArk'), 28.3, 10.1],
  ['class-validator', adapter('class-validator', 'NominalField'), 28.3, 10.1],
  ['drizzle', adapter('drizzle', 'toDrizzle'), 37.2, 13],
  [
    'fastify',
    `import { fastifyNominal } from '${name}/adapters/fastify'; globalThis.out = fastifyNominal;`,
    29.4,
    10.3,
  ],
  ['graphql', adapter('graphql', 'toGraphQL'), 30.1, 10.8],
  ['mikro-orm', adapter('mikro-orm', 'toMikroOrm'), 37.9, 13.2],
  [
    'nest',
    `import { Uuid } from '${name}'; import { NominalPipe } from '${name}/adapters/nest'; globalThis.out = new NominalPipe(Uuid);`,
    29.4,
    10.4,
  ],
  ['sequelize', adapter('sequelize', 'toSequelize'), 37.4, 13.2],
  ['superjson', adapter('superjson', 'toSuperjson'), 27.9, 9.9],
  ['swagger', adapter('swagger', 'ApiNominalProperty'), 27.7, 9.8],
  ['typeorm', adapter('typeorm', 'toTypeOrm'), 37.3, 13.1],
  ['valibot', adapter('valibot', 'toValibot'), 27.7, 9.8],
  ['zod', adapter('zod', 'toZod'), 27.9, 10],
];

// The `n` cases again, bundled by Rollup.
const rollupCases = [
  [
    'only n.object',
    `import { n, Uuid } from '${name}'; globalThis.out = n.object({ id: Uuid }).parse({});`,
    54.7,
    18.1,
  ],
  [
    'only n.of',
    `import { n, Uuid } from '${name}'; globalThis.out = n.of(Uuid).parse('');`,
    44.8,
    15.2,
  ],
  [
    'n.object and three types',
    `import { Email, n, PositiveInteger, Uuid } from '${name}'; globalThis.out = n.object({ id: Uuid, email: Email, age: PositiveInteger }).parse({});`,
    57.2,
    19.2,
  ],
];

const kib = (bytes) => Math.round((bytes / 1024) * 10) / 10;

const rows = [];

for (const [bundler, bundleWith, list] of [
  ['esbuild', bundle, cases],
  ['Rollup', bundleWithRollup, rollupCases],
]) {
  for (const [label, code, minified, gzipped] of list) {
    const output = await bundleWith(code);
    const size = {
      label,
      bundler,
      minified: kib(output.length),
      gzipped: kib(gzipSync(output).length),
    };

    rows.push(size);
    ok(size.minified <= minified, `${label}: ${size.minified} KiB minified, over ${minified} KiB`);
    ok(size.gzipped <= gzipped, `${label}: ${size.gzipped} KiB gzipped, over ${gzipped} KiB`);
  }
}

// The table is the report this script exists for.
// oxlint-disable-next-line no-console
console.table(rows);
