import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const llms = readFileSync(join(root, 'llms.txt'), 'utf8');

const entryPoints = [
  ['@horizon-republic/nominal-types', 'src/index.ts'],
  ['@horizon-republic/nominal-types/temporal', 'src/temporal/index.ts'],
  ...readdirSync(join(root, 'src/adapters'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'orm')
    .map(
      (entry) =>
        [
          `@horizon-republic/nominal-types/adapters/${entry.name}`,
          `src/adapters/${entry.name}/index.ts`,
        ] as const,
    ),
] as const;

// The names an index file exports, values and types alike.
const exportsOf = (file: string): string[] =>
  [...readFileSync(join(root, file), 'utf8').matchAll(/export (?:type )?\{([^}]*)\}/gu)].flatMap(
    (match) =>
      (match[1] ?? '')
        .split(',')
        .map(
          (name) =>
            name
              .trim()
              .split(/\s+as\s+/u)
              .at(-1) ?? '',
        )
        .filter((name) => name !== ''),
  );

const exported = entryPoints.flatMap(([entry, file]) =>
  exportsOf(file).map((name) => ({ entry, name })),
);

describe('llms.txt', () => {
  it('finds the exports to check', () => {
    expect(exported.length).toBeGreaterThan(80);
  });

  it.each(entryPoints.map(([entry]) => entry))('names the entry point %s', (entry) => {
    expect(llms).toContain(entry);
  });

  it.each(exported)('names $name from $entry', ({ name }) => {
    expect(llms).toContain(`\`${name}`);
  });

  it('stays small enough for an agent to read whole', () => {
    expect(llms.length).toBeLessThan(60_000);
  });
});
