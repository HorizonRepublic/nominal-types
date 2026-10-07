import { describe, expect, it } from 'vitest';

import { Email, matching, NominalError } from '../../../src/index.ts';

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

  it('reports the rejection in words', () => {
    expect(Email.parse('nope')).toMatchObject({
      ok: false,
      issues: [{ message: 'must be an email address (was "nope")' }],
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
      public static override readonly rule = matching(CompanyEmail.pattern);
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
