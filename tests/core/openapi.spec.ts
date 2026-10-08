import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import { AnyString, n, Nominal } from '../../src/index.ts';

const openApi = { target: 'openapi-3.0' } as const;

describe('JSON Schema for OpenAPI 3.0', () => {
  it('describes a rule from a library that knows no OpenAPI 3.0 as draft-07', () => {
    const Code = Nominal('openapi.Code', type('string == 3'));

    expect(Code['~standard'].jsonSchema.input(openApi)).toStrictEqual({
      title: 'openapi.Code',
      type: 'string',
      minLength: 3,
      maxLength: 3,
    });
  });

  it('picks its example from those the whole type accepts', () => {
    const Sku = AnyString.subtype(
      'openapi.Sku',
      n.matching(/^[A-Z]{3}-\d{4}$/u, 'a SKU', { examples: ['ABC-1234', 'TOY-0001'] }),
    );
    const ToySku = Sku.subtype('openapi.ToySku', /^TOY-/u);

    expect(ToySku['~standard'].jsonSchema.input(openApi)).toMatchObject({ example: 'TOY-0001' });
    expect(Sku['~standard'].jsonSchema.input(openApi)).toMatchObject({ example: 'ABC-1234' });
  });

  it.each([
    ['Base64', { contentEncoding: 'base64' }, { format: 'byte' }],
    ['Binary', { contentEncoding: 'base64', format: 'binary' }, { format: 'binary' }],
    ['Base32', { contentEncoding: 'base32' }, {}],
  ])('writes the encoding of %s without contentEncoding', (name, json, written) => {
    const rule = n.matching(/^[A-Z]*$/u, 'encoded text', json);
    const Encoded = AnyString.subtype(`openapi.${name}`, rule);

    for (const schema of [
      rule['~standard'].jsonSchema.input(openApi),
      Encoded['~standard'].jsonSchema.input(openApi),
    ]) {
      expect(schema).not.toHaveProperty('contentEncoding');
      expect(schema['format']).toBe(Reflect.get(written, 'format'));
    }
  });

  it('names the type whose rule has no JSON Schema, on every target', () => {
    const Even = Nominal(
      'openapi.Even',
      n.satisfying((value: unknown): value is number => value === 2, 'two'),
    );

    for (const target of ['draft-2020-12', 'draft-07', 'openapi-3.0'] as const) {
      expect(() => Even['~standard'].jsonSchema.input({ target })).toThrow(
        new TypeError('openapi.Even: the schema cannot describe itself as JSON Schema'),
      );
    }
  });
});
