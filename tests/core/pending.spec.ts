import { describe, expect, it } from 'vitest';

import { nothingPending, takePending } from '../../src/core/pending.ts';
import { trustedConstructorFor } from '../../src/core/type-functions.ts';
import type { Parsed } from '../../src/index.ts';
import { AnyString, Email, n, Nominal, PositiveInteger } from '../../src/index.ts';
import { issuesOf, valueOf } from '../support/results.ts';

// `parse` checks a value once and hands it to the constructor it calls through a single slot.
// These cases call `parse` and `new` from inside constructors, the places that could see a value
// meant for another call.

const refuse = (): void => {
  throw new Error('refused');
};

const allow = (): void => {};

let beforeSuper = allow;

describe('the value parse hands to its constructor', () => {
  it('is not taken by a constructor that calls another type before super()', () => {
    class Contact extends AnyString.subtype('pending.Contact') {
      public readonly email: Parsed<Email>;

      public constructor(input: string) {
        const email = Email.parse(input);

        super(input);
        this.email = email;
      }
    }

    const contact = valueOf(Contact.parse('jane@example.com'));

    expect(contact.value).toBe('jane@example.com');
    expect(contact.email).toStrictEqual({ ok: true, value: new Email('jane@example.com') });
    expect(valueOf(Contact.parse('Jane')).email.ok).toBe(false);
  });

  it('still refuses a bad value when another type was parsed before super()', () => {
    class Count extends PositiveInteger.subtype('pending.Count') {
      public constructor(input: number) {
        PositiveInteger.parse(1);
        super(input);
      }
    }

    expect(issuesOf(Count.parse(-1))).toStrictEqual([
      { message: 'must be a positive integer (was -1)' },
    ]);
    expect(() => new Count(-1)).toThrow('pending.Count: must be a positive integer (was -1)');
  });

  it('is not taken by a field initializer that parses', () => {
    class Tagged extends AnyString.subtype('pending.Tagged') {
      public readonly size = PositiveInteger.parse(this.value.length);
    }

    const tagged = valueOf(Tagged.parse('abc'));

    expect(tagged.value).toBe('abc');
    expect(tagged.size).toStrictEqual({ ok: true, value: new PositiveInteger(3) });
    expect(issuesOf(Tagged.parse(1))).toStrictEqual([{ message: 'must be a string (was 1)' }]);
  });

  it('is checked again when the constructor passes super() another input', () => {
    class Lowered extends Email.subtype('pending.Lowered') {
      public constructor(input: string) {
        super(input.toLowerCase());
      }
    }

    expect(valueOf(Lowered.parse('Jane@Example.com')).value).toBe('jane@example.com');
    expect(() => new Lowered('NOPE')).toThrow('pending.Lowered: must be an email address');
  });

  it('is gone when the constructor throws before super()', () => {
    beforeSuper = refuse;

    class Box extends Nominal('pending.Box', n.object({ n: PositiveInteger })) {
      public constructor(input: { n: number }) {
        beforeSuper();
        super(input);
      }
    }

    const input = { n: 1 };

    expect(() => Box.parse(input)).toThrow('refused');

    beforeSuper = allow;
    input.n = -5;

    expect(() => new Box(input)).toThrow('pending.Box: n: must be a positive integer (was -5)');
  });

  it('is gone when a trusted constructor throws before super()', () => {
    beforeSuper = refuse;

    class Word extends AnyString.subtype('pending.Word') {
      public constructor(input: string) {
        beforeSuper();
        super(input);
      }
    }

    expect(() => trustedConstructorFor(Word)('ok')).toThrow('refused');
    expect(takePending(Word, 'ok')).toBe(nothingPending);

    beforeSuper = allow;

    expect(new Word('ok').value).toBe('ok');
  });
});
