import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import {
  AnyNumber,
  AnyString,
  n,
  NegativeNumber,
  Nominal,
  PositiveNumber,
} from '../../src/index.ts';

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

const isNumber = (value: unknown): value is number => typeof value === 'number';
const isSmall = (value: unknown): value is number => isNumber(value) && value >= 1 && value <= 5;
const isSign = (value: unknown): value is number => isNumber(value) && value !== 0;
const isPositive = (value: unknown): value is number => isNumber(value) && value > 0;

class Small extends Nominal(
  'openapi.Small',
  n.satisfying(isSmall, 'a small number', {
    type: 'number',
    minimum: 1,
    exclusiveMinimum: 0,
    maximum: 5,
    exclusiveMaximum: 9,
  }),
) {}

class Sign extends AnyNumber.subtype(
  'openapi.Sign',
  n.satisfying(isSign, 'not zero', { anyOf: [{ exclusiveMinimum: 0 }, { exclusiveMaximum: 0 }] }),
) {}

class Measure extends Nominal(
  'openapi.Measure',
  n.satisfying(isNumber, 'a number or nothing', { type: 'number', nullable: true }),
) {}

class Above extends Measure.subtype(
  'openapi.Above',
  n.satisfying(isPositive, 'a positive number', { anyOf: [{ exclusiveMinimum: 0 }] }),
) {}

describe('exclusive bounds for OpenAPI 3.0', () => {
  const positive = { anyOf: [{ minimum: 0, exclusiveMinimum: true }] };

  it('become an inclusive bound with a flag', () => {
    expect(PositiveNumber['~standard'].jsonSchema.input(openApi)).toStrictEqual({
      title: 'nominal.PositiveNumber',
      type: 'number',
      format: 'double',
      minimum: 0,
      exclusiveMinimum: true,
      description: 'a positive number',
    });
    expect(NegativeNumber['~standard'].jsonSchema.input(openApi)).toMatchObject({
      maximum: 0,
      exclusiveMaximum: true,
    });
  });

  it('stay numbers for JSON Schema', () => {
    const schema = PositiveNumber['~standard'].jsonSchema.input({ target: 'draft-07' });

    expect(schema).toMatchObject({ exclusiveMinimum: 0 });
    expect(schema).not.toHaveProperty('minimum');
  });

  it('give way to a stricter inclusive bound in the same schema', () => {
    expect(Small['~standard'].jsonSchema.input(openApi)).toStrictEqual({
      title: 'openapi.Small',
      type: 'number',
      minimum: 1,
      maximum: 5,
      description: 'a small number',
    });
  });

  it('are written that way inside anyOf, allOf and items too', () => {
    expect(Sign['~standard'].jsonSchema.input(openApi)).toMatchObject({
      type: 'number',
      anyOf: [
        { minimum: 0, exclusiveMinimum: true },
        { maximum: 0, exclusiveMaximum: true },
      ],
    });
    expect(Above['~standard'].jsonSchema.input(openApi)).toMatchObject({
      allOf: [{ nullable: true }, positive],
    });
    expect(n.of(Above).array()['~standard'].jsonSchema.input(openApi)).toMatchObject({
      items: { allOf: [{}, positive] },
    });
  });
});
