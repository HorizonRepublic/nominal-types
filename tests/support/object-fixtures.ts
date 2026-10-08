import type { StandardSchemaV1, TypeSchema } from '../../src/index.ts';
import { AnyString, Email, n, NonBlankString, PositiveInteger } from '../../src/index.ts';
import { satisfiesSchema } from './json-schema.ts';

export const withinCapacity = n.constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
  { path: 'guests' },
);

export const Stay = n.object(
  {
    guests: PositiveInteger,
    capacity: PositiveInteger,
    contact: Email,
    note: n.of(AnyString).optional(),
  },
  withinCapacity,
);

export const stay = { guests: 2, capacity: 3, contact: 'jane@example.com' } as const;

export const Card = n.object({ token: NonBlankString });

export const Invoice = n.object({ email: Email, method: AnyString });

export const Payment = n.union('method', { card: Card, invoice: Invoice });

export const card = { method: 'card', token: 'tok_1' } as const;

export const invoice = { method: 'invoice', email: 'jane@example.com' } as const;

/**
 * The issue of a payment whose tag no variant lists.
 */
export const wrongTag = (was: string): StandardSchemaV1.Issue[] => [
  { message: `must be one of "card", "invoice" (was ${was})`, path: ['method'] },
];

/**
 * The input JSON Schema of a schema for one target.
 */
export const inputJson = (
  schema: TypeSchema<unknown, unknown>,
  target: string = 'draft-2020-12',
): Record<string, unknown> => schema['~standard'].jsonSchema.input({ target });

/**
 * The inputs on which a schema and its JSON Schema give different answers.
 */
export const disagreements = (
  schema: TypeSchema<unknown, unknown>,
  inputs: readonly unknown[],
): unknown[] =>
  inputs.filter((input) => satisfiesSchema(inputJson(schema), input) !== schema.parse(input).ok);

/**
 * Calls a method of a schema with arguments its types refuse.
 */
export const callAnyway = (target: object, name: string, ...values: unknown[]): unknown => {
  const method: unknown = Reflect.get(target, name);

  if (typeof method !== 'function') {
    throw new TypeError(`${name} is not a method`);
  }

  return Reflect.apply(method, target, values);
};

/**
 * Builds an instance of a class with an input its types refuse.
 */
export const constructAnyway = (Type: new (input: never) => unknown, input: unknown): unknown =>
  Reflect.construct(Type, [input]);
