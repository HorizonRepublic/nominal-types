import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import { arkOf, arkSchema, constrain } from '../../../src/adapters/arktype/index.ts';
import { constraint, Email, PositiveInteger, Uuid } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';

const withinCapacity = constraint(
  { guests: PositiveInteger, capacity: PositiveInteger },
  ({ guests, capacity }) => guests <= capacity,
);

const Booking = arkSchema(
  type({
    id: arkOf(Uuid),
    email: type('string.trim').pipe(arkOf(Email)),
    'backup?': arkOf(Email).or('null'),
    status: "'new' | 'paid'",
    stays: constrain(
      type({ guests: arkOf(PositiveInteger), capacity: arkOf(PositiveInteger) }),
      withinCapacity,
    ).array(),
  }),
);

const propertyOf = (schema: Record<string, unknown>, key: string): unknown => {
  const properties: unknown = schema['properties'];

  return typeof properties === 'object' && properties !== null
    ? Reflect.get(properties, key)
    : undefined;
};

const uuidSchema = (target: 'draft-2020-12' | 'openapi-3.0'): unknown => {
  const { $schema: _schema, ...body } = Uuid['~standard'].jsonSchema.input({ target });

  return body;
};

describe('JSON Schema of arkSchema', () => {
  const schema = Booking['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

  it('describes each arkOf() field by its type', () => {
    expect(schema).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        id: uuidSchema('draft-2020-12'),
        stays: { type: 'array', items: { properties: { guests: { title: 'PositiveInteger' } } } },
      },
      required: ['email', 'id', 'status', 'stays'],
    });
  });

  it('describes the input side of a morph', () => {
    expect(schema).toMatchObject({ properties: { email: { type: 'string' } } });
  });

  it('leaves the constraint marker out', () => {
    expect(JSON.stringify(schema)).not.toContain('x-nominal');
  });

  it('agrees with the runtime on the UUID field', () => {
    const id = propertyOf(schema, 'id');

    expect(satisfiesSchema(id, '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f')).toBe(true);
    expect(satisfiesSchema(id, 'nope')).toBe(false);
  });

  it('describes the output side the same way', () => {
    expect(Booking['~standard'].jsonSchema.output({ target: 'draft-07' })).toMatchObject({
      $schema: 'http://json-schema.org/draft-07/schema#',
      properties: { id: { title: 'Uuid' } },
    });
  });

  it('writes OpenAPI 3.0: no $schema, nullable, enum and example', () => {
    const openApi = Booking['~standard'].jsonSchema.input({ target: 'openapi-3.0' });

    expect(openApi).not.toHaveProperty('$schema');
    expect(openApi).toMatchObject({
      properties: {
        id: uuidSchema('openapi-3.0'),
        backup: { title: 'Email', nullable: true },
        status: { enum: ['new', 'paid'] },
      },
    });
    expect(JSON.stringify(openApi)).not.toContain('"examples"');
  });

  it('throws for an unknown target', () => {
    expect(() => Booking['~standard'].jsonSchema.input({ target: 'draft-04' })).toThrow(
      new TypeError('JSON Schema target draft-04 is not supported'),
    );
  });
});
