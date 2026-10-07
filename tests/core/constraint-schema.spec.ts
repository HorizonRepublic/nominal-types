import type { StandardSchemaV1 } from '@standard-schema/spec';
import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import { constraint, isConstraint, PositiveInteger, schemaOf, Uint8 } from '../../src/index.ts';

const endAfterStart = constraint(
  { start: PositiveInteger, end: PositiveInteger },
  ({ start, end }) => end > start,
  { path: 'end' },
);

const plainSchema = (jsonSchema?: unknown): StandardSchemaV1<unknown, unknown> => ({
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value) => ({ value }),
    ...(jsonSchema === undefined ? {} : { jsonSchema }),
  },
});

describe('constraint', () => {
  describe('JSON Schema', () => {
    it('describes the listed fields, the required ones and nothing else', () => {
      const rule = constraint({ min: schemaOf(Uint8).optional(), max: Uint8 }, () => true);
      const schema = rule['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

      expect(schema).toMatchObject({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: { min: { title: 'Uint8' }, max: { title: 'Uint8' } },
        required: ['max'],
      });
      expect(schema['properties']).not.toHaveProperty('min.$schema');
    });

    it('leaves $schema out for OpenAPI', () => {
      const schema = endAfterStart['~standard'].jsonSchema.output({ target: 'openapi-3.0' });

      expect(schema).not.toHaveProperty('$schema');
      expect(schema).toMatchObject({ required: ['start', 'end'] });
    });

    it('throws for a field that cannot describe itself', () => {
      const rule = constraint({ a: plainSchema() }, () => true);

      expect(() => rule['~standard'].jsonSchema.input({ target: 'draft-07' })).toThrow(
        new TypeError('a field of the constraint cannot describe itself as JSON Schema'),
      );
    });
  });

  it.each([
    ['no converter for the side', { output: () => ({}) }],
    ['a converter that returns no object', { input: () => 'schema' }],
  ])('throws for a field schema with %s', (_name, jsonSchema) => {
    const rule = constraint({ a: plainSchema(jsonSchema) }, () => true);

    expect(() => rule['~standard'].jsonSchema.input({ target: 'draft-07' })).toThrow(TypeError);
  });

  describe('isConstraint', () => {
    it('tells a constraint from other values', () => {
      expect(isConstraint(endAfterStart)).toBe(true);
      expect(isConstraint(schemaOf(Uint8))).toBe(false);
      expect(isConstraint(null)).toBe(false);
      expect(isConstraint('constraint')).toBe(false);
    });

    it('recognises a constraint built by another copy of the package', async () => {
      vi.resetModules();
      const copy: typeof library = await import('../../src/index.ts');

      expect(isConstraint(copy.constraint({ a: copy.Uint8 }, () => true))).toBe(true);
    });
  });
});
