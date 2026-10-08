import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'node_modules/.cache', `tsdoc-examples-${process.pid}`);
const packageName = '@horizon-republic/nominal-types';

interface Example {
  readonly file: string;
  readonly line: number;
  readonly code: string | null;
}

const sourcesIn = (folder: string): string[] =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);

    if (statSync(path).isDirectory()) {
      return sourcesIn(path);
    }

    return path.endsWith('.ts') ? [path] : [];
  });

// Each `@example` of a TSDoc block, with the code of its `ts` fence and the line the code starts on.
const examplesOf = (path: string): Example[] => {
  const lines = readFileSync(path, 'utf8').split('\n');
  const file = relative(root, path);
  const examples: Example[] = [];
  let inDoc = false;
  let current: { line: number; code: string[] | null; fenced: boolean } | null = null;

  const close = (): void => {
    if (current !== null) {
      examples.push({ file, line: current.line, code: current.code?.join('\n') ?? null });
    }

    current = null;
  };

  for (const [index, raw] of lines.entries()) {
    if (raw.trim().startsWith('/**')) {
      inDoc = true;

      continue;
    }

    if (!inDoc) {
      continue;
    }

    if (raw.trim().startsWith('*/')) {
      close();
      inDoc = false;

      continue;
    }

    const text = raw.replace(/^\s*\* ?/u, '');

    if (current?.fenced === true) {
      if (text.startsWith('```')) {
        current.fenced = false;
      } else {
        current.code?.push(text);
      }

      continue;
    }

    if (text.startsWith('@')) {
      close();
    }

    if (text.startsWith('@example')) {
      current = { line: index + 1, code: null, fenced: false };
    } else if (current !== null && text.startsWith('```ts')) {
      current.code = [];
      current.fenced = true;
      current.line = index + 2;
    }
  }

  return examples;
};

const sources = sourcesIn(join(root, 'src'));
const examples = sources.flatMap((path) => examplesOf(path));

const importing = new RegExp(`^import .* from '${packageName}(?:/[a-z/-]+)?';$`, 'mu');

const importsPackage = (example: Example): boolean =>
  example.code === null || importing.test(example.code);

const entryPoints = [
  'src/index.ts',
  'src/temporal/index.ts',
  'src/testing/index.ts',
  ...readdirSync(join(root, 'src/adapters'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'orm')
    .map((entry) => `src/adapters/${entry.name}/index.ts`),
];

// The names the entry points export, by the name they are declared with.
const publicNames = new Set(
  entryPoints.flatMap((entry) => {
    const source = readFileSync(join(root, entry), 'utf8');
    const listed = [...source.matchAll(/export (?:type )?\{([^}]*)\}/gu)].flatMap((match) =>
      (match[1] ?? '').split(',').map(
        (name) =>
          name
            .trim()
            .replace(/^type /u, '')
            .split(/\s/u)[0],
      ),
    );
    const declared = [
      ...source.matchAll(/^export (?:declare )?(?:const|class|interface|type) (\w+)/gmu),
    ];

    return [...listed, ...declared.map((match) => match[1])].filter((name) => name !== undefined);
  }),
);

// Declarations that carry `@internal` in the block right above them, by name.
const internalNames = sources.flatMap((path) =>
  [
    ...readFileSync(path, 'utf8').matchAll(
      /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/)\s*export (?:declare )?(?:abstract )?(?:const|class|interface|type|function) (\w+)/gu,
    ),
  ]
    .filter((match) => match[1]?.includes('@internal') === true)
    .map((match) => ({ name: match[2] ?? '', file: relative(root, path) })),
);

const compile = (): string[] => {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const files = examples.map((example, index) => {
    const name = `example-${index}.ts`;

    writeFileSync(join(out, name), example.code ?? '');

    return name;
  });

  writeFileSync(
    join(out, 'tsconfig.json'),
    JSON.stringify({
      extends: join(root, 'tsconfig.json'),
      compilerOptions: {
        noUnusedLocals: false,
        noUnusedParameters: false,
        isolatedDeclarations: false,
        declaration: false,
        paths: {
          [packageName]: [join(root, 'src/index.ts')],
          [`${packageName}/*`]: [join(root, 'src/*/index.ts')],
        },
      },
      files,
    }),
  );

  try {
    execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', out, '--pretty', 'false'], {
      encoding: 'utf8',
    });

    return [];
  } catch (error: unknown) {
    const output =
      error instanceof Error && 'stdout' in error ? String(error.stdout) : String(error);

    return output
      .split('\n')
      .filter((line) => line.includes('error TS'))
      .map((line) => {
        const match = /example-(\d+)\.ts\((\d+),\d+\): (.*)$/u.exec(line);
        const example = examples[Number(match?.[1])];

        return example === undefined || match === null
          ? line
          : `${example.file}:${example.line + Number(match[2]) - 1}: ${match[3]}`;
      });
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
};

describe('TSDoc internal tags', () => {
  it('finds the public names and the internal ones', () => {
    expect(publicNames.size).toBeGreaterThan(150);
    expect(internalNames.length).toBeGreaterThan(100);
  });

  it('leaves @internal off everything an entry point exports', () => {
    const exposed = internalNames.filter(({ name }) => publicNames.has(name));

    expect(exposed.map(({ name, file }) => `${file}: ${name}`)).toStrictEqual([]);
  });
});

describe('TSDoc examples', () => {
  it('finds the examples to check', () => {
    expect(examples.length).toBeGreaterThan(100);
  });

  it('puts the code of every example in a ts fence', () => {
    const unfenced = examples.filter((example) => example.code === null);

    expect(unfenced.map((example) => `${example.file}:${example.line}`)).toStrictEqual([]);
  });

  it('imports what every example uses from the package', () => {
    const bare = examples.filter((example) => !importsPackage(example));

    expect(bare.map((example) => `${example.file}:${example.line}`)).toStrictEqual([]);
  });

  it('type-checks every example against the sources', () => {
    expect(compile()).toStrictEqual([]);
  }, 120_000);
});
