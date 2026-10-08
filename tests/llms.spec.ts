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

// The names in `export { … }` and `export type { … }` lists of a file, as they are exported.
const listedExportsOf = (source: string): string[] =>
  [...source.matchAll(/export (?:type )?\{([^}]*)\}/gu)].flatMap((match) =>
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

// The names an index file exports, values, types and namespaces alike.
const exportsOf = (file: string): string[] => {
  const source = readFileSync(join(root, file), 'utf8');
  const namespaces = [...source.matchAll(/export \* as (\w+)/gu)].map((match) => match[1] ?? '');

  return [...namespaces, ...listedExportsOf(source)];
};

// The members of the namespace `n`, which llms.txt names in their `n.` form.
const namespaceMembers = listedExportsOf(readFileSync(join(root, 'src/core/n.ts'), 'utf8'));

const markdownIn = (folder: string): string[] =>
  readdirSync(join(root, folder), { withFileTypes: true }).flatMap((entry) => {
    const path = `${folder}/${entry.name}`;

    if (entry.isDirectory()) {
      return markdownIn(path);
    }

    return path.endsWith('.md') ? [path] : [];
  });

const docsPages = markdownIn('docs');

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

  it.each(namespaceMembers)('names n.%s', (name) => {
    expect(llms).toContain(`\`n.${name}`);
  });

  it.each(docsPages)('links the docs page %s, which ships in the package', (page) => {
    expect(llms).toContain(`](${page})`);
  });

  it('stays small enough for an agent to read whole', () => {
    expect(llms.length).toBeLessThan(80_000);
  });
});
