import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

const markdownIn = (folder: string): string[] =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);

    if (statSync(path).isDirectory()) {
      return markdownIn(path);
    }

    return path.endsWith('.md') ? [path] : [];
  });

const pages = [
  join(root, 'README.md'),
  join(root, 'CONTRIBUTING.md'),
  join(root, 'llms.txt'),
  ...markdownIn(join(root, 'docs')),
].filter((path) => existsSync(path));

// Code blocks hold examples, not links.
const withoutCode = (text: string): string => text.replaceAll(/```[\s\S]*?```/gu, '');

// GitHub's anchor for a heading: lower case, punctuation dropped, spaces as hyphens.
const anchorOf = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s_-]/gu, '')
    .replaceAll(/\s/gu, '-');

const anchorsOf = (path: string): Set<string> => {
  const headings = withoutCode(readFileSync(path, 'utf8')).match(/^#{1,6} .+$/gmu) ?? [];

  return new Set(headings.map((heading) => anchorOf(heading.replace(/^#+ /u, ''))));
};

const linksOf = (path: string): string[] =>
  [...withoutCode(readFileSync(path, 'utf8')).matchAll(/\]\(([^)\s]+)\)/gu)]
    .map((match) => match[1] ?? '')
    .filter((target) => !/^[a-z]+:/u.test(target));

// Each link as the file it points to and the heading it names, if any.
const links = pages.flatMap((page) =>
  linksOf(page).map((target) => {
    const [file = '', anchor = ''] = target.split('#');
    const path = file === '' ? page : resolve(dirname(page), file);

    return { page: relative(root, page), target, path, anchor };
  }),
);

const anchored = links.filter((link) => link.anchor !== '' && link.path.endsWith('.md'));

describe('documentation links', () => {
  it('finds the pages to check', () => {
    expect(pages.length).toBeGreaterThan(20);
  });

  it.each(links)('$page links to $target, which exists', ({ path }) => {
    expect(existsSync(path)).toBe(true);
  });

  it.each(anchored)('$page links to $target, a heading that exists', ({ path, anchor }) => {
    expect([...anchorsOf(path)]).toContain(anchor);
  });
});

// A building function called or imported by itself rather than through the namespace `n`.
const outsideN =
  /(?<![.\w$])(?:objectOf|schemaOf|isNominalType|isObjectSchema|hideValues|oneOf|matching|satisfying|isConstraint|constraint)(?:\(|[\s,][\w\s,]*\}\s*from)/u;

describe('documentation names', () => {
  it.each(pages.map((path) => relative(root, path)))(
    '%s reaches the building functions through n',
    (page) => {
      expect(readFileSync(join(root, page), 'utf8')).not.toMatch(outsideN);
    },
  );
});
