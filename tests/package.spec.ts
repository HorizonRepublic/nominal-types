import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const manifest: unknown = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const recordAt = (key: string): Readonly<Record<string, unknown>> => {
  const value: unknown =
    typeof manifest === 'object' && manifest !== null ? Reflect.get(manifest, key) : undefined;

  return typeof value === 'object' && value !== null
    ? Object.fromEntries(Object.entries(value))
    : {};
};

describe('package.json', () => {
  it.each(Object.keys(recordAt('peerDependencies')))(
    'marks the peer %s optional, so nothing installs until its adapter is imported',
    (name) => {
      expect(recordAt('peerDependenciesMeta')[name]).toStrictEqual({ optional: true });
    },
  );

  it('ships the docs and llms.txt, so agents read the docs of the installed version', () => {
    expect(manifest).toHaveProperty('files', ['dist', 'docs', 'llms.txt']);
  });

  it('has no dependencies, since it carries the Standard Schema interfaces itself', () => {
    expect(recordAt('dependencies')).toStrictEqual({});
  });
});
