import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import { fromArk, toArk } from '../../src/adapters/arktype/index.ts';
import { columnKindOf } from '../../src/adapters/orm/column.ts';
import { readerOf } from '../../src/adapters/orm/values.ts';
import { trustedConstructorFor } from '../../src/core/type-functions.ts';
import {
  AnyString,
  Email,
  n,
  Nominal,
  NonEmptyString,
  Port,
  PositiveInteger,
  Uuid,
} from '../../src/index.ts';
import { configured, resetConfigurationAfterEach } from '../support/configuration.ts';
import { issuesOf, valueOf } from '../support/results.ts';

resetConfigurationAfterEach();

const uuid = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';
const trimming = <Result>(check: () => Result): Result =>
  configured({ normalize: { trimStrings: true } }, check);

class Password extends AnyString.subtype('trim.Password', /^.{4,}$/u, {
  sensitive: true,
  normalize: false,
}) {}
class LongPassword extends Password.subtype('trim.LongPassword', /^.{6,}$/u) {}
class Note extends Password.subtype('trim.Note', undefined, { normalize: true }) {}
const Code = Nominal('trim.Code', /^[a-z]+$/u);

describe('trimStrings', () => {
  it('is off unless configured: strings reach the check as given', () => {
    expect(Email.parse(' jane@example.com ').ok).toBe(false);
    expect(valueOf(AnyString.parse(' a ')).value).toBe(' a ');
  });

  it('trims a string before the check of every type under AnyString', () => {
    trimming(() => {
      expect(valueOf(Email.parse(' jane@example.com\n')).value).toBe('jane@example.com');
      expect(valueOf(Uuid.parse(`\t${uuid} `)).value).toBe(uuid);
      expect(valueOf(AnyString.parse('  a  ')).value).toBe('a');
      expect(new Email(' jane@example.com ').value).toBe('jane@example.com');
      expect(Email.accepts(' jane@example.com ')).toBe(true);
    });
  });

  it('trims every whitespace String.prototype.trim() removes, and nothing inside', () => {
    trimming(() => {
      expect(valueOf(AnyString.parse(' ﻿ a b  ')).value).toBe('a b');
    });
  });

  it('checks the trimmed text, so a blank string becomes empty', () => {
    trimming(() => {
      expect(NonEmptyString.parse('   ').ok).toBe(false);
      expect(NonEmptyString.accepts('   ')).toBe(false);
      expect(valueOf(AnyString.parse('   ')).value).toBe('');
    });
  });

  it('names the value as it was given in a message', () => {
    trimming(() => {
      expect(issuesOf(Uuid.parse(' nope '))).toStrictEqual([
        { message: 'must be a UUID (was " nope ")' },
      ]);
    });
  });

  it('leaves values that are not strings, and types not under AnyString, as they are', () => {
    trimming(() => {
      expect(issuesOf(AnyString.parse(1))).toStrictEqual([{ message: 'must be a string (was 1)' }]);
      expect(PositiveInteger.parse(' 1').ok).toBe(false);
      expect(Code.parse(' a ').ok).toBe(false);
    });
  });

  it('keeps the input of a type declared with normalize: false, and of its subtypes', () => {
    trimming(() => {
      expect(valueOf(Password.parse(' pa ')).value).toBe(' pa ');
      expect(Password.parse('  p ').ok).toBe(true);
      expect(LongPassword.accepts(' pass ')).toBe(true);
      expect(valueOf(Note.parse('  note  ')).value).toBe('note');
    });
  });

  it('trims the fields of objects and the items of arrays', () => {
    const Order = n.object({ id: Uuid, tags: n.of(AnyString).array(), secret: Password });

    trimming(() => {
      const order = valueOf(Order.parse({ id: ` ${uuid}`, tags: [' a '], secret: ' pass ' }));

      expect(order.id.value).toBe(uuid);
      expect(order.tags.map((tag) => tag.value)).toStrictEqual(['a']);
      expect(order.secret.value).toBe(' pass ');
      expect(Order.accepts({ id: ` ${uuid}`, tags: [' a '], secret: 'pass' })).toBe(true);
    });
  });

  it('trims text read by fromString() and fromEnv() before any type reads it', () => {
    const Env = n.object({ PORT: Port, ID: Uuid, SECRET: Password }).fromEnv();

    expect(n.of(Port).fromString().parse(' 80 ').ok).toBe(false);

    trimming(() => {
      expect(valueOf(n.of(Port).fromString().parse(' 80\n')).value).toBe(80);
      expect(n.of(Port).fromString().accepts(' 80 ')).toBe(true);
      expect(n.of(Password).fromString().accepts(' ab ')).toBe(true);

      const env = valueOf(Env.parse({ PORT: ' 3000', ID: `${uuid}\n`, SECRET: ' pw  ' }));

      expect([env.PORT.value, env.ID.value, env.SECRET.value]).toStrictEqual([3000, uuid, ' pw  ']);
    });
  });

  it('trims what the database readers build, trusted or not', () => {
    trimming(() => {
      expect(readerOf(Email, columnKindOf(Email), true)(' jane@example.com ')).toStrictEqual(
        new Email('jane@example.com'),
      );
      expect(readerOf(Email, columnKindOf(Email), false)(' jane@example.com ')).toStrictEqual(
        new Email('jane@example.com'),
      );
      expect(readerOf(Password, columnKindOf(Password), true)(' pass ')).toStrictEqual(
        new Password(' pass '),
      );
      expect(trustedConstructorFor(Uuid)(` ${uuid}`)).toStrictEqual(new Uuid(uuid));
    });
  });

  it('applies to fields of ArkType objects that fromArk() builds', () => {
    const Contact = fromArk(type({ email: toArk(Email) }));

    trimming(() => {
      expect(valueOf(Contact.parse({ email: ' jane@example.com ' }))).toStrictEqual({
        email: new Email('jane@example.com'),
      });
    });
  });

  it('leaves the JSON Schema as it is, stricter than the type while trimming is on', () => {
    const schema = Uuid['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

    trimming(() => {
      expect(Uuid['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toStrictEqual(schema);
      expect(new RegExp(String(schema['pattern']), 'u').test(` ${uuid}`)).toBe(false);
      expect(Uuid.accepts(` ${uuid}`)).toBe(true);
    });
  });

  it('applies to a type whose check was built before the setting changed', () => {
    expect(Email.parse('jane@example.com').ok).toBe(true);

    trimming(() => {
      expect(Email.parse(' jane@example.com ').ok).toBe(true);
    });

    expect(Email.parse(' jane@example.com ').ok).toBe(false);
  });
});
