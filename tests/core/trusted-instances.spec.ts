import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import { AnyString, Email, n, Nominal, NominalError, PositiveInteger } from '../../src/index.ts';
import { issuesOf, thrownBy, valueOf } from '../support/results.ts';

type Library = typeof library;

const anotherCopy = (): Promise<Library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

const brandOf = (name: string): symbol => Symbol.for(`@horizon-republic/nominal-types/${name}`);

class Pair extends Nominal('trusted.Pair', n.object({ email: Email, count: PositiveInteger })) {}

const pairInput = { email: 'jane@example.com', count: 3 };

describe('an instance whose value was changed', () => {
  it('keeps the value as its only own key', () => {
    expect(Object.keys(new Email('jane@example.com'))).toStrictEqual(['value']);
    expect(Object.keys(new Pair(pairInput))).toStrictEqual(['value']);
  });

  it.each([
    ['assigned', (target: object, value: unknown) => Reflect.set(target, 'value', value)],
    [
      'redefined',
      (target: object, value: unknown) => Reflect.defineProperty(target, 'value', { value }),
    ],
  ])('is checked again by parse() when its value was %s', (_, change) => {
    const email = new Email('jane@example.com');

    change(email, 'nope');

    expect(issuesOf(Email.parse(email))).toStrictEqual([
      { message: 'must be an email address (was a string of 4 characters)' },
    ]);

    change(email, 'john@example.com');

    const parsed = valueOf(Email.parse(email));

    expect(parsed).not.toBe(email);
    expect(parsed.value).toBe('john@example.com');
  });

  it('is checked again as a field of an object', () => {
    const count = new PositiveInteger(1);

    Reflect.set(count, 'value', -1);

    expect(issuesOf(Pair.parse({ email: 'jane@example.com', count }))).toStrictEqual([
      { message: 'must be a positive integer (was -1)', path: ['count'] },
    ]);
  });

  it('is checked again when an object instance holds a changed value', () => {
    const pair = new Pair(pairInput);

    Reflect.set(pair, 'value', { email: 'nope', count: 1 });

    expect(issuesOf(Pair.parse(pair))).toStrictEqual([
      { message: 'must be an email address (was a string of 4 characters)', path: ['email'] },
    ]);
  });
});

describe('what parse() trusts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an instance this copy built as it is, also of a class extending the target', () => {
    class WorkEmail extends Email {}

    const email = new Email('jane@example.com');
    const work = new WorkEmail('jane@example.com');

    expect(valueOf(Email.parse(email))).toBe(email);
    expect(valueOf(Email.parse(work))).toBe(work);
    expect(valueOf(n.of(Email).parse(email))).toBe(email);
  });

  it('checks a forged object with the brand again, though instanceof passes', () => {
    const forged = { [brandOf('nominal.Email')]: true, value: 'nope' };

    expect(forged instanceof Email).toBe(true);
    expect(issuesOf(Email.parse(forged))).toStrictEqual([
      { message: 'must be an email address (was a string of 4 characters)' },
    ]);

    const valid = valueOf(Email.parse({ [brandOf('nominal.Email')]: true, value: 'a@b.co' }));

    expect(Object.getPrototypeOf(valid)).toBe(Email.prototype);
    expect(valid.value).toBe('a@b.co');
  });

  it('checks an object made from the prototype again', () => {
    expect(issuesOf(Email.parse(Object.create(Email.prototype)))).toStrictEqual([
      { message: 'must be a string (was undefined)' },
    ]);
    expect(Pair.parse(Object.create(Pair.prototype)).ok).toBe(false);
  });

  it('checks a parent instance against the rules of a class extending it', () => {
    class StaffEmail extends Email {
      public static override readonly rule = n.matching(/@staff\.example$/u, 'a staff address');
    }

    const outside = new Email('jane@example.com');

    expect(outside instanceof StaffEmail).toBe(true);
    expect(issuesOf(StaffEmail.parse(outside))).toStrictEqual([
      { message: 'must be a staff address (was a string of 16 characters)' },
    ]);

    const parsed = valueOf(StaffEmail.parse(new Email('jane@staff.example')));

    expect(Object.getPrototypeOf(parsed)).toBe(StaffEmail.prototype);
  });

  it('checks an instance of another type with the same name against its own rules', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const Letters = Nominal('trusted.Twice', /^[a-z]+$/u);
    const Digits = Nominal('trusted.Twice', /^\d+$/u);
    const letters = new Letters('abc');

    expect(letters instanceof Digits).toBe(true);
    expect(Digits.parse(letters).ok).toBe(false);
    expect(Letters.parse(new Digits('1')).ok).toBe(false);
    expect(valueOf(Letters.parse(letters))).toBe(letters);
  });

  it('builds an instance of this copy from one of another copy', async () => {
    const copy = await anotherCopy();
    const email = new copy.Email('jane@example.com');
    const parsed = valueOf(Email.parse(email));

    expect(parsed).not.toBe(email);
    expect(Object.getPrototypeOf(parsed)).toBe(Email.prototype);
    expect(parsed.equals(email)).toBe(true);
  });

  it('checks an instance of another copy again, so a changed value fails', async () => {
    const copy = await anotherCopy();
    const email = new copy.Email('jane@example.com');

    Reflect.set(email, 'value', 'nope');

    expect(Email.parse(email).ok).toBe(false);
  });

  it('builds the fields of an object instance of another copy with this copy', async () => {
    const copy = await anotherCopy();

    class CopyPair extends copy.Nominal(
      'trusted.Pair',
      copy.n.object({ email: copy.Email, count: copy.PositiveInteger }),
    ) {}

    const parsed = valueOf(Pair.parse(new CopyPair(pairInput)));

    expect(Object.getPrototypeOf(parsed)).toBe(Pair.prototype);
    expect(Object.getPrototypeOf(parsed.email)).toBe(Email.prototype);
    expect(Object.getPrototypeOf(parsed.count)).toBe(PositiveInteger.prototype);
  });
});

describe('parse() of a class whose constructor changes its input', () => {
  class Lower extends AnyString.subtype('trusted.Lower', /^[a-z]+$/u) {
    public constructor(input: string) {
      super(input.toUpperCase());
    }
  }

  it('returns the issues of the changed input instead of throwing', () => {
    expect(Lower.parse('abc')).toStrictEqual({
      ok: false,
      issues: [{ message: 'must be matched by ^[a-z]+$ (was "ABC")' }],
    });
    expect(n.of(Lower).parse('abc').ok).toBe(false);
    expect(issuesOf(n.object({ code: Lower }).parse({ code: 'abc' }))).toStrictEqual([
      { message: 'must be matched by ^[a-z]+$ (was "ABC")', path: ['code'] },
    ]);
  });

  it('still throws with new', () => {
    expect(thrownBy(() => new Lower('abc'))).toBeInstanceOf(NominalError);
  });

  it('lets an error other than NominalError through', () => {
    class Broken extends AnyString.subtype('trusted.Broken') {
      public constructor(input: string) {
        super(input);

        throw new RangeError('broken');
      }
    }

    expect(() => Broken.parse('a')).toThrow(RangeError);
  });
});
