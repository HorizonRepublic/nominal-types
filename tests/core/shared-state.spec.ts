import { afterEach, describe, expect, it, vi } from 'vitest';

import { NominalPipe } from '../../src/adapters/nest/index.ts';
import { applyNominalTypes } from '../../src/adapters/swagger/index.ts';
import type * as library from '../../src/index.ts';
import { Email, n, Nominal, Uuid } from '../../src/index.ts';
import { issuesOf, valueOf } from '../support/results.ts';

const first = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

type Library = typeof library;

const anotherCopy = (): Promise<Library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

describe('state shared by copies of the package', () => {
  it('finds a type declared by another copy when filling an OpenAPI document', async () => {
    const copy = await anotherCopy();

    copy.Nominal('CopyOnlyType', /^c$/u);
    const document = applyNominalTypes({
      components: { schemas: { CopyOnlyType: { type: 'object', properties: {} } } },
    });

    expect(document.components?.schemas?.['CopyOnlyType']).toMatchObject({
      type: 'string',
      pattern: '^c$',
    });
  });

  it('reads strings for a type from another copy', async () => {
    const copy = await anotherCopy();

    expect(valueOf(n.of(copy.PositiveInteger).fromString().parse('2')).value).toBe(2);
    expect(
      new NominalPipe().transform('2', { type: 'query', metatype: copy.PositiveInteger }),
    ).toBeInstanceOf(copy.PositiveInteger);
  });

  it('wraps a lone query value for an array schema from another copy', async () => {
    const copy = await anotherCopy();

    expect(
      new NominalPipe(copy.n.of(copy.Uuid).array()).transform(first, { type: 'query' }),
    ).toHaveLength(1);
  });
});

describe('a type name declared twice', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns once when two different types take one name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    Nominal('TwiceDeclared', /^a$/u);
    Nominal('TwiceDeclared', /^b$/u);
    Nominal('TwiceDeclared', /^c$/u);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('"TwiceDeclared" is declared twice');
  });

  it('tells patterns apart by their flags', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    Nominal('DeclaredWithFlags', /^a$/u);
    Nominal('DeclaredWithFlags', /^a$/u);

    expect(warn).not.toHaveBeenCalled();

    // The same pattern without the u flag is the point of this test.
    // oxlint-disable-next-line require-unicode-regexp
    Nominal('DeclaredWithFlags', /^a$/);

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the same type is declared again', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    Nominal('DeclaredAgain', n.matching(/^a$/u, 'an a'));
    Nominal('DeclaredAgain', n.matching(/^a$/u, 'an a'));

    expect(warn).not.toHaveBeenCalled();
  });

  it('stays silent when another copy declares the built-in types again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await anotherCopy();

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('equals across a line of types', () => {
  class UserId extends Uuid.subtype('EqualsUserId') {}
  class OrderId extends Uuid.subtype('EqualsOrderId') {}
  class CompanyEmail extends Email.subtype('EqualsCompanyEmail', /@example\.com$/u) {}
  class TrackedEmail extends Email {}
  const LegacyEmail = Email.variant('EqualsLegacyEmail', /^legacy:/u);

  it.each([
    ['a type and its subtype', new Uuid(first), new UserId(first), true],
    [
      'a type and its subtype, in either case',
      new UserId(first.toUpperCase()),
      new Uuid(first),
      true,
    ],
    ['two siblings with one value', new UserId(first), new OrderId(first), false],
    [
      'an email and a narrower one',
      new Email('jane@example.com'),
      new CompanyEmail('jane@example.com'),
      true,
    ],
    [
      'an email and a class extending it',
      new TrackedEmail('jane@example.com'),
      new Email('jane@example.com'),
      true,
    ],
    ['a different value', new Email('jane@example.com'), new Email('john@example.com'), false],
  ])('%s: %s', (_, left, right, expected) => {
    expect(left.equals(right)).toBe(expected);
    expect(right.equals(left)).toBe(expected);
  });

  it('keeps a variant apart from its source', () => {
    expect(new LegacyEmail('legacy:jane@example.com').equals(new Email('jane@example.com'))).toBe(
      false,
    );
  });

  it('is false for anything that is not an instance', () => {
    expect(new Email('jane@example.com').equals('jane@example.com')).toBe(false);
    expect(new Email('jane@example.com').equals(null)).toBe(false);
  });

  it('holds for an instance from another copy', async () => {
    const copy = await anotherCopy();

    expect(new copy.Email('jane@example.com').equals(new Email('jane@example.com'))).toBe(true);
    expect(issuesOf(Email.parse('nope'))).toHaveLength(1);
  });
});
