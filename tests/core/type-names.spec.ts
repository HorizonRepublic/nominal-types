import { describe, expect, it, vi } from 'vitest';

import { applyNominalTypes } from '../../src/adapters/swagger/index.ts';
import { Email, Nominal } from '../../src/index.ts';

describe('type names', () => {
  it.each(['Sku', 'billing.InvoiceNumber', 'a.b.c', 'snake_case', 'kebab-case', 'X1', '1'])(
    'accepts %o',
    (name) => {
      expect(Nominal(name, /^x$/u).typeName).toBe(name);
    },
  );

  it.each(['', 'billing/Email', 'has space', 'a..b', '.a', 'a.', 'émail', 'a:b'])(
    'refuses %o',
    (name) => {
      expect(() => Nominal(name, /^x$/u)).toThrow(
        new TypeError(
          `${JSON.stringify(name)} is not a valid type name: use letters, digits, _ and -, with dots between parts, such as billing.InvoiceNumber`,
        ),
      );
    },
  );

  it.each([42, undefined])('refuses %o in place of a name', (name) => {
    expect(() => {
      Reflect.apply(Nominal, undefined, [name, /^x$/u]);
    }).toThrow(`${String(name)} is not a valid type name`);
  });

  it('checks names of subtypes and variants too', () => {
    const Base = Nominal('names.Base', /^x/u);

    expect(() => Base.subtype('names/Sub')).toThrow(TypeError);
    expect(() => Base.variant('names Variant', /^y/u)).toThrow(TypeError);
  });

  it('keeps an Email of your own apart from the built-in one', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    class CorporateEmail extends Nominal('Email', /^.+@corp\.example$/u) {}

    const mine = new CorporateEmail('jane@corp.example');

    expect(mine).not.toBeInstanceOf(Email);
    expect(new Email('jane@example.com')).not.toBeInstanceOf(CorporateEmail);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('names built-in types under nominal.', () => {
    expect(Email.typeName).toBe('nominal.Email');
  });
});

describe('schema names in an OpenAPI document', () => {
  const empty = { type: 'object', properties: {} };

  it('finds a type by the last part of its name, as classes are named', () => {
    Nominal('billing.InvoiceNumber', /^INV-\d+$/u);

    const document = applyNominalTypes({ components: { schemas: { InvoiceNumber: empty } } });

    expect(document.components?.schemas?.['InvoiceNumber']).toMatchObject({
      title: 'billing.InvoiceNumber',
      pattern: '^INV-\\d+$',
    });
  });

  it('leaves a schema alone when two types end in the same part', () => {
    Nominal('first.Twin', /^a$/u);
    Nominal('second.Twin', /^b$/u);

    const document = applyNominalTypes({ components: { schemas: { Twin: empty } } });

    expect(document.components?.schemas?.['Twin']).toStrictEqual(empty);
  });
});
