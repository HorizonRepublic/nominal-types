import { describe, expect, expectTypeOf, it } from 'vitest';

import type { NonBlankString, StandardSchemaV1 } from '../../src/index.ts';
import { Email, n, Nominal } from '../../src/index.ts';
import {
  card,
  Card,
  disagreements,
  inputJson,
  invoice,
  Invoice,
  Payment,
} from '../support/object-fixtures.ts';
import { valueOf } from '../support/results.ts';

type Value = StandardSchemaV1.InferOutput<typeof Payment>;

type Input = StandardSchemaV1.InferInput<typeof Payment>;

class PaymentMethod extends Nominal('union.TypedPayment', Payment) {}

const tried = [
  card,
  invoice,
  { ...card, extra: 1 },
  { method: 'card' },
  { method: 'card', token: '' },
  { method: 'cash', token: 'a' },
  { method: 'invoice', email: 'x' },
  { token: 'a' },
  {},
  [],
  null,
  'card',
];

describe('n.union JSON Schema', () => {
  it('is a oneOf of the variants, each with its tag as a constant and required', () => {
    const schema = inputJson(Payment);

    expect(schema).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      oneOf: [
        {
          type: 'object',
          properties: { method: { const: 'card' } },
          required: ['method', 'token'],
        },
        {
          type: 'object',
          properties: { method: { const: 'invoice' } },
          required: ['method', 'email'],
        },
      ],
    });
    expect(Object.keys(schema)).toStrictEqual(['$schema', 'oneOf']);
  });

  it('names the discriminator for OpenAPI 3.0, which has no const', () => {
    const schema = inputJson(Payment, 'openapi-3.0');

    expect(schema['discriminator']).toStrictEqual({ propertyName: 'method' });
    expect(schema['oneOf']).toMatchObject([
      { properties: { method: { type: 'string', enum: ['card'] } } },
      { properties: { method: { type: 'string', enum: ['invoice'] } } },
    ]);
    expect(inputJson(Payment, 'draft-07')).not.toHaveProperty('discriminator');
  });

  it('describes the output side with no other keys', () => {
    expect(Payment['~standard'].jsonSchema.output({ target: 'draft-2020-12' })).toMatchObject({
      oneOf: [{ additionalProperties: false }, { additionalProperties: false }],
    });
  });

  it('agrees with what parse() accepts', () => {
    expect(disagreements(Payment, tried)).toStrictEqual([]);
    expect(
      disagreements(n.union('method', { card: Card.strict(), invoice: Invoice }), tried),
    ).toStrictEqual([]);
    expect(
      disagreements(
        Payment.array(),
        tried.map((input) => [input]),
      ),
    ).toStrictEqual([]);
  });
});

describe('n.union types', () => {
  it('is a union of the variants, each with its tag', () => {
    expectTypeOf<Value>().toEqualTypeOf<
      | { readonly method: 'card'; readonly token: NonBlankString }
      | { readonly method: 'invoice'; readonly email: Email }
    >();
    expectTypeOf<Input>().toEqualTypeOf<
      | { readonly method: 'card'; readonly token: string | NonBlankString }
      | { readonly method: 'invoice'; readonly email: string | Email }
    >();
  });

  it('narrows by the tag', () => {
    const value = valueOf(Payment.parse(card));

    expectTypeOf<
      Extract<typeof value, { method: 'card' }>['token']
    >().toEqualTypeOf<NonBlankString>();
    expectTypeOf<Exclude<typeof value, { method: 'card' }>['email']>().toEqualTypeOf<Email>();
  });

  it('types the value of a nominal type built on it', () => {
    expectTypeOf<PaymentMethod['value']>().toEqualTypeOf<Value>();
  });

  it('refuses what is not a variant map at compile time', () => {
    // @ts-expect-error: a variant must be an n.object() schema
    expect(() => n.union('kind', { a: Email })).toThrow(TypeError);
  });
});
