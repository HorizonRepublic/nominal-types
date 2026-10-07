import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// Builds llms-full.txt: llms.txt, the README and every docs page in one file, for agents that
// read the package from node_modules. The order runs from the summary down to the details.

const root = resolve(import.meta.dirname, '..');

const sections = ['reference', 'guides', 'explanation', 'tutorials'];

const markdownIn = (folder: string): string[] =>
  readdirSync(folder)
    .toSorted()
    .flatMap((name) => {
      const path = join(folder, name);

      if (statSync(path).isDirectory()) {
        return markdownIn(path);
      }

      return path.endsWith('.md') ? [path] : [];
    });

const pages = [
  join(root, 'llms.txt'),
  join(root, 'README.md'),
  ...sections.flatMap((section) => markdownIn(join(root, 'docs', section))),
];

const text = pages
  .map((page) => `<!-- file: ${relative(root, page)} -->\n\n${readFileSync(page, 'utf8').trim()}\n`)
  .join('\n');

writeFileSync(join(root, 'llms-full.txt'), text);
