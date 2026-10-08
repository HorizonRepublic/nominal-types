import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { check } from '../src/index.ts';
import type { CheckOptions, Diagnostic } from '../src/index.ts';

const fixtures = fileURLToPath(new URL('fixtures/', import.meta.url));
const project = path.join(fixtures, 'tsconfig.json');
const marker = /error(-next)?: ([\w-]+(?:, [\w-]+)*)/u;

const separate = new Set(['options.ts', 'unresolved.ts']);
const files = readdirSync(fixtures)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.d.ts'))
  .toSorted();

const expected = (name: string): readonly string[] =>
  readFileSync(path.join(fixtures, name), 'utf8')
    .split('\n')
    .flatMap((text, index) => {
      const match = marker.exec(text);
      const line = match?.[1] === undefined ? index + 1 : index + 2;
      const codes = match?.[2]?.split(', ') ?? [];

      return codes.map((code) => `${line} ${code}`);
    })
    .toSorted();

const actual = (diagnostics: readonly Diagnostic[], name: string): readonly string[] =>
  diagnostics
    .filter((diagnostic) => path.basename(diagnostic.file) === name)
    .map((diagnostic) => `${diagnostic.line} ${diagnostic.code}`)
    .toSorted();

const format = (diagnostics: readonly Diagnostic[]): string =>
  diagnostics
    .map(
      ({ file, line, column, code, message }) =>
        `${path.relative(fixtures, file)}:${line}:${column} ${message} (${code})`,
    )
    .join('\n');

const run = (options: Omit<CheckOptions, 'project'> = {}): readonly Diagnostic[] =>
  check({ project, ...options });

const all = run({ include: files.filter((name) => !separate.has(name)) });

describe('check on fixtures', () => {
  for (const name of files.filter((file) => !separate.has(file))) {
    it(`reports what the markers in ${name} expect`, () => {
      expect(actual(all, name)).toStrictEqual(expected(name));
    });
  }

  it('words every finding the same way', () => {
    expect(format(all)).toMatchSnapshot();
  });
});

describe('options', () => {
  it('reports what it cannot follow when asked to', () => {
    const diagnostics = run({ include: 'unresolved.ts', reportUnresolved: true });

    expect(actual(diagnostics, 'unresolved.ts')).toStrictEqual(expected('unresolved.ts'));
    expect(format(diagnostics)).toMatchSnapshot();
  });

  it('stays silent on what it cannot follow by default', () => {
    expect(run({ include: 'unresolved.ts' })).toStrictEqual([]);
  });

  it('reads the include globs relative to the tsconfig', () => {
    const diagnostics = run({ include: ['direct.*'] });

    expect(new Set(diagnostics.map((diagnostic) => path.basename(diagnostic.file)))).toStrictEqual(
      new Set(['direct.ts']),
    );
  });

  it('counts a wider documented type as thrown when allowed', () => {
    const strict = run({ include: 'options.ts' }).filter((item) => item.code === 'unused');
    const loose = run({ include: 'options.ts', allowUnusedSupertypes: true }).filter(
      (item) => item.code === 'unused',
    );

    expect(strict.map((item) => item.message)).toContain(
      'redundant documents a @throws for Error, which it never throws',
    );
    expect(loose.map((item) => item.message)).not.toContain(
      'redundant documents a @throws for Error, which it never throws',
    );
  });

  it('takes extra builtins and removes defaults', () => {
    const messages = run({
      include: 'options.ts',
      builtins: { 'JSON.parse': [], 'Math.sqrt': ['RangeError'] },
    }).map((item) => item.message);

    expect(messages).toContain(
      'root can throw RangeError from Math.sqrt() without a @throws for it',
    );
    expect(messages.some((message) => message.includes('SyntaxError'))).toBe(false);
  });

  it('takes extra synchronous callers', () => {
    const before = run({ include: 'options.ts' }).map((item) => item.message);
    const after = run({ include: 'options.ts', syncCallbacks: ['now'] }).map(
      (item) => item.message,
    );

    expect(before.some((message) => message.startsWith('immediate'))).toBe(false);
    expect(after).toContain('immediate can throw RangeError without a @throws for it');
  });

  it('refuses a project it cannot read', () => {
    expect(() => check({ project: path.join(fixtures, 'missing.json') })).toThrow(Error);
  });
});
