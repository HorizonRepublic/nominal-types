import { describe, expect, it } from 'vitest';

import { Email, n, NominalError } from '../../../src/index.ts';
import { randomTexts } from '../../support/random-text.ts';

const domainOf = (length: number): string =>
  `${`${'b'.repeat(63)}.`.repeat(3)}${'c'.repeat(length - 195)}.co`;

const odd = ['@', '.', '-', ' ', 'é', '😀', '\n', '"'];
const locals = [
  ...randomTexts(['jane', 'x', 'doe', '.', '+', "'", 'abcdefgh'], 20_000, 16, 1),
  ...randomTexts(['jane', 'x', '.', '+', ...odd], 20_000, 8, 2),
];
const domains = [
  ...randomTexts(['example.', 'b.', 'mail-1.', `${'b'.repeat(60)}.`], 20_000, 6, 3),
  ...randomTexts(['example', 'b.', '-', 'xn--p1ai', ...odd], 20_000, 6, 4),
];
const generated = [
  ...randomTexts(['a', 'Z', '0', 'co', 'xn--', '+', ...odd], 20_000, 12, 5),
  ...locals.map((local, index) => `${local}@${domains[index] ?? ''}${index % 3 ? 'co' : ''}`),
];

describe('Email', () => {
  it.each([
    'a+tag@b.co',
    'Jane.Doe+news@Example.com',
    "o'brien!#$%&*+/=?^_`{|}~-x@sub.example.org",
    'a@xn--80ak6aa92e.com',
    'a@b.xn--p1ai',
    `${'x'.repeat(64)}@b.co`,
  ])('accepts %s', (address) => {
    expect(new Email(address).value).toBe(address);
  });

  it.each([
    '.a@b.co',
    'a.@b.co',
    'a..b@c.co',
    'a@localhost',
    'a@b',
    'a b@c.co',
    'юзер@пошта.укр',
    'a@-b.co',
    'a@b-.co',
    `${'x'.repeat(65)}@b.co`,
    `a@${Array.from({ length: 5 }, () => 'b'.repeat(60)).join('.')}.co`,
    '"quoted"@b.co',
    'a@[127.0.0.1]',
    'a@b.c',
    'a@b.co.',
    '@b.co',
  ])('rejects %s', (address) => {
    expect(() => new Email(address)).toThrow(NominalError);
  });

  describe('length limits', () => {
    it.each([
      ['six characters', 'a@b.co', true],
      ['five characters', 'a@b.c', false],
      ['254 characters', `a@${domainOf(252)}`, true],
      ['255 characters', `a@${domainOf(253)}`, false],
      ['64 characters before the @', `${'x'.repeat(64)}@b.co`, true],
      ['65 characters before the @', `${'x'.repeat(65)}@b.co`, false],
    ])('%s', (_title, address, accepted) => {
      expect(Email.parse(address).ok).toBe(accepted);
    });

    it('builds the boundary addresses it means to', () => {
      expect(`a@${domainOf(252)}`).toHaveLength(254);
      expect(`a@${domainOf(253)}`).toHaveLength(255);
    });
  });

  it.each([undefined, null, 42, ['a@b.co'], { value: 'a@b.co' }, new Object('a@b.co')])(
    'rejects %o, which is not a string',
    (input) => {
      expect(Email.parse(input).ok).toBe(false);
    },
  );

  it.each(['a@b.co\n', '\na@b.co', 'a😀@b.co', 'a@b.co😀', 'a@@b.co', 'a@b@c.co'])(
    'rejects %j',
    (address) => {
      expect(Email.parse(address).ok).toBe(false);
    },
  );

  it('accepts exactly the strings its pattern matches', () => {
    const disagreements = generated.filter(
      (text) => Email.parse(text).ok !== Email.pattern.test(text),
    );

    expect(generated.filter((text) => Email.pattern.test(text)).length).toBeGreaterThan(500);
    expect(disagreements).toEqual([]);
  });

  it('reports the rejection in words', () => {
    expect(Email.parse('nope')).toMatchObject({
      ok: false,
      issues: [{ message: 'must be an email address (was a string of 4 characters)' }],
    });
  });

  describe('parts', () => {
    const email = new Email('Jane.Doe+news@Example.com');

    it('splits the address at the @', () => {
      expect(email.local).toBe('Jane.Doe+news');
      expect(email.domain).toBe('Example.com');
    });

    it('separates the mailbox from the plus tag', () => {
      expect(email.mailbox).toBe('Jane.Doe');
      expect(email.tag).toBe('news');
    });

    it('has no tag when the local part carries no plus', () => {
      expect(new Email('jane@example.com').tag).toBeUndefined();
    });

    it('keeps everything after the first plus as the tag', () => {
      expect(new Email('jane+a+b@example.com').tag).toBe('a+b');
    });
  });

  describe('overriding the pattern', () => {
    class CompanyEmail extends Email {
      public static override readonly pattern = /^[a-z.]+@example\.com$/u;
      public static override readonly rule = n.matching(CompanyEmail.pattern);
    }

    it('validates with the subclass pattern and keeps the behaviour', () => {
      expect(new CompanyEmail('jane.doe@example.com').mailbox).toBe('jane.doe');
      expect(() => new CompanyEmail('jane@elsewhere.com')).toThrow(NominalError);
    });

    it('builds on the fragments of the base pattern', () => {
      expect(new RegExp(`^${Email.atom}$`, 'u').test("o'brien+x")).toBe(true);
    });
  });

  describe('plus addressing', () => {
    const email = new Email('Jane.Doe+news@Example.com');

    it('drops the tag', () => {
      expect(email.withoutTag().value).toBe('Jane.Doe@Example.com');
    });

    it('replaces the tag', () => {
      expect(email.withTag('billing').value).toBe('Jane.Doe+billing@Example.com');
    });

    it('refuses a tag an address cannot hold', () => {
      expect(() => email.withTag('no spaces')).toThrow(NominalError);
    });

    it('lowers and strips the address for comparison', () => {
      expect(email.canonical().value).toBe('jane.doe@example.com');
    });

    it('treats tagged and differently cased addresses as one mailbox', () => {
      expect(email.isSameMailbox(new Email('jane.doe@EXAMPLE.com'))).toBe(true);
      expect(email.isSameMailbox(new Email('john.doe@example.com'))).toBe(false);
    });

    it('still compares exactly through equals', () => {
      expect(email.equals(new Email('jane.doe@example.com'))).toBe(false);
    });
  });
});
