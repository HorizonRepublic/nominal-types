import { describe, expect, it, vi } from 'vitest';

import { columnKindOf } from '../../../src/adapters/orm/column.ts';
import type * as library from '../../../src/index.ts';
import { NominalError, SemVer } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';
import { issuesOf, valueOf } from '../../support/results.ts';

const schema = SemVer['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
const safe = String(Number.MAX_SAFE_INTEGER);
const unsafe = String(Number.MAX_SAFE_INTEGER + 1);

// The longest version the type takes: 256 characters.
const longest = `1.0.0+${'b'.repeat(250)}`;

const accepted = [
  '0.0.0',
  '1.2.3',
  '10.20.30',
  '1.0.0-0',
  '1.0.0-0a',
  '1.0.0-a-b',
  '1.0.0--',
  '1.0.0-alpha.1',
  '1.0.0-0.3.7',
  '1.0.0-x.7.z.92',
  '1.0.0-x-y-z.--',
  '1.0.0+01',
  '1.0.0+20130313144700',
  '1.0.0-beta+exp.sha.5114f85',
  '1.0.0+21AF26D3----117B344092BD',
  `${safe}.${safe}.${safe}`,
  `1.0.0-${safe}`,
  '1000000000000000.0.0',
  longest,
];

const rejected = [
  '',
  '1',
  '1.0',
  '1.0.0.0',
  'v1.0.0',
  'V1.0.0',
  '=1.0.0',
  ' 1.0.0',
  '1.0.0 ',
  '1.0.0\n',
  '01.0.0',
  '1.01.0',
  '1.0.01',
  '1.0.0-01',
  '1.0.0-',
  '1.0.0+',
  '1.0.0-a..b',
  '1.0.0+a..b',
  '1.0.0-a.',
  '1.0.0-a_b',
  '1.0.0+a+b',
  '-1.0.0',
  '1.0.0-alpha+',
  `${unsafe}.0.0`,
  `0.${unsafe}.0`,
  `0.0.${unsafe}`,
  `1.0.0-${unsafe}`,
  `1.0.0-a.${unsafe}`,
  '90071992547409910.0.0',
  `${longest}b`,
];

describe('SemVer', () => {
  it.each(accepted)('accepts %s as given', (text) => {
    expect(new SemVer(text).value).toBe(text);
  });

  it.each(rejected)('rejects %j', (text) => {
    expect(() => new SemVer(text)).toThrow(NominalError);
  });

  it('builds the longest version it takes', () => {
    expect(longest).toHaveLength(256);
  });

  it('refuses a leading v, which the specification says is not a semantic version', () => {
    expect(issuesOf(SemVer.parse('v1.2.3'))).toStrictEqual([
      { message: 'must be a semantic version (was "v1.2.3")' },
    ]);
  });

  it.each([1, null, undefined, {}, new Object('1.0.0')])('rejects %s', (input) => {
    expect(issuesOf(SemVer.parse(input))).toHaveLength(1);
  });

  it.each([...accepted, ...rejected, 1])('agrees with its JSON Schema on %j', (value) => {
    expect(satisfiesSchema(schema, value)).toBe(SemVer.parse(value).ok);
  });

  it('takes exactly the numbers a safe integer holds', () => {
    const limit = BigInt(Number.MAX_SAFE_INTEGER);
    const candidates = [
      ...Array.from({ length: 2001 }, (_, offset) => limit - 1000n + BigInt(offset)),
      ...Array.from({ length: 17 }, (_, power) => 10n ** BigInt(power)),
      ...Array.from({ length: 17 }, (_, power) => 10n ** BigInt(power) - 1n),
      ...Array.from({ length: 16 }, (_, index) => limit - 10n ** BigInt(index)),
      ...Array.from({ length: 16 }, (_, index) => limit + 10n ** BigInt(index)),
      ...Array.from({ length: 200 }, (_, index) => (limit * BigInt(index + 1)) / 199n),
    ];
    const safeOnes = candidates.filter((candidate) => candidate <= limit);
    const takenAsNumber = candidates.filter((candidate) => SemVer.parse(`0.0.${candidate}`).ok);
    const takenAsIdentifier = candidates.filter(
      (candidate) => SemVer.parse(`${candidate}.0.0-${candidate}`).ok,
    );

    expect(takenAsNumber).toStrictEqual(safeOnes);
    expect(takenAsIdentifier).toStrictEqual(safeOnes);
  });

  it('is stored in a text column of 256 characters', () => {
    expect(columnKindOf(SemVer)).toStrictEqual({ kind: 'text', length: 256 });
  });

  describe('parts', () => {
    const version = new SemVer('2.10.0-rc.1.x-y+build.007');

    it('reads the numbers', () => {
      expect([version.major, version.minor, version.patch]).toStrictEqual([2, 10, 0]);
    });

    it('reads the prerelease identifiers, numeric ones as numbers', () => {
      expect(version.prerelease).toStrictEqual(['rc', 1, 'x-y']);
      expect(version.isPrerelease).toBe(true);
    });

    it('reads the build identifiers as written', () => {
      expect(version.build).toStrictEqual(['build', '007']);
    });

    it('has empty parts for a release without build metadata', () => {
      const release = new SemVer('1.0.0');

      expect(release.prerelease).toStrictEqual([]);
      expect(release.build).toStrictEqual([]);
      expect(release.isPrerelease).toBe(false);
    });

    it('keeps a hyphen in build metadata out of the prerelease', () => {
      const built = new SemVer('1.0.0+a-b');

      expect(built.prerelease).toStrictEqual([]);
      expect(built.build).toStrictEqual(['a-b']);
    });

    it('reads the largest safe numbers without losing digits', () => {
      const largest = new SemVer(`${safe}.0.0-${safe}`);

      expect(largest.major).toBe(Number.MAX_SAFE_INTEGER);
      expect(largest.prerelease).toStrictEqual([Number.MAX_SAFE_INTEGER]);
    });
  });

  describe('precedence', () => {
    // The chain of section 11 of the specification, lowest first.
    const chain = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
      '1.0.1',
      '1.1.0',
      '1.10.0',
      '2.0.0',
      '10.0.0',
    ].map((text) => new SemVer(text));

    const neighbours = chain.flatMap((lower, index) =>
      chain.slice(index + 1, index + 2).map((higher) => [lower, higher] as const),
    );

    it.each(neighbours)('puts %s before %s', (lower, higher) => {
      expect(lower.compare(higher)).toBe(-1);
      expect(higher.compare(lower)).toBe(1);
      expect(higher.isNewerThan(lower)).toBe(true);
      expect(lower.isNewerThan(higher)).toBe(false);
    });

    it('sorts versions', () => {
      const shuffled = chain.toReversed();

      expect(shuffled.toSorted((left, right) => left.compare(right))).toStrictEqual(chain);
    });

    it('compares numeric identifiers as numbers and before letters', () => {
      expect(new SemVer('1.0.0-2').compare(new SemVer('1.0.0-10'))).toBe(-1);
      expect(new SemVer('1.0.0-999').compare(new SemVer('1.0.0-a'))).toBe(-1);
      expect(new SemVer('1.0.0-0a').compare(new SemVer('1.0.0-1'))).toBe(1);
    });

    it('compares letters in ASCII order', () => {
      expect(new SemVer('1.0.0-Beta').compare(new SemVer('1.0.0-alpha'))).toBe(-1);
      expect(new SemVer('1.0.0--').compare(new SemVer('1.0.0-0a'))).toBe(-1);
    });

    it('ignores build metadata, while equals compares the text', () => {
      const left = new SemVer('1.0.0+a');
      const right = new SemVer('1.0.0+b');

      expect(left.compare(right)).toBe(0);
      expect(left.isNewerThan(right)).toBe(false);
      expect(left.equals(right)).toBe(false);
      expect(left.equals(new SemVer('1.0.0+a'))).toBe(true);
    });

    it('has the same precedence for the same version', () => {
      expect(new SemVer('1.0.0-rc.1').compare(new SemVer('1.0.0-rc.1'))).toBe(0);
    });
  });

  it('stays fast on long crafted inputs', () => {
    const started = performance.now();

    for (const text of [
      `1.0.0-${'a'.repeat(100_000)}`,
      `1.0.0-${'1'.repeat(100_000)}!`,
      `1.0.0-${'0.'.repeat(50_000)}`,
      `${'1'.repeat(100_000)}.0.0`,
      `1.0.0-${'a1-'.repeat(80)}!`,
      `1.0.0+${'a.'.repeat(126)}`,
    ]) {
      expect(SemVer.parse(text).ok).toBe(false);
    }

    expect(performance.now() - started).toBeLessThan(50);
  });

  it('compares a value built by another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const version = new copy.SemVer('1.2.3');

    expect(valueOf(SemVer.parse(version))).toStrictEqual(new SemVer('1.2.3'));
    expect(new SemVer('1.2.4').compare(version)).toBe(1);
    expect(new SemVer('1.2.3').equals(version)).toBe(true);
  });
});
