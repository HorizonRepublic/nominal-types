import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import { n, Nominal } from '../../src/index.ts';
import { Sku } from '../support/fixtures.ts';
import { handWritten, issuesOf, outputOf, stringOnly } from '../support/results.ts';

describe('Standard Schema', () => {
  describe('Standard Schema', () => {
    it('validates to an instance', () => {
      expect(outputOf(Sku['~standard'].validate('SKU-0007'))).toBeInstanceOf(Sku);
    });

    it('reports issues for a rejected value', () => {
      expect(Sku['~standard'].validate('x').issues).not.toHaveLength(0);
    });

    it('describes itself as JSON Schema through its schema', () => {
      const schema = Sku['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

      expect(schema).toMatchObject({ type: 'string', pattern: '^SKU-\\d{4}$' });
    });

    it('embeds into an ArkType object and yields instances', () => {
      const order = type({ sku: n.of(Sku) });

      expect(order.assert({ sku: 'SKU-0003' }).sku).toBeInstanceOf(Sku);
    });
  });

  describe('schemas from other libraries', () => {
    it('accepts any Standard Schema that answers synchronously', () => {
      const Code = Nominal('Code', handWritten(stringOnly));

      expect(new Code('abc').value).toBe('abc');
      expect(issuesOf(Code.parse(1))).toStrictEqual([{ message: 'must be a string' }]);
    });

    it('flattens path segments into plain keys', () => {
      const Nested = Nominal(
        'Nested',
        handWritten(() => ({ issues: [{ message: 'bad', path: [{ key: 'a' }, 0, 'b'] }] })),
      );

      expect(issuesOf(Nested.parse('x'))).toStrictEqual([{ message: 'bad', path: ['a', 0, 'b'] }]);
    });

    it('rejects a schema that answers asynchronously', () => {
      const Remote = Nominal(
        'Remote',
        handWritten(async (value) => {
          await Promise.resolve();

          return { value: String(value) };
        }),
      );

      expect(() => Remote.parse('x')).toThrow(/asynchronous schemas are not supported/u);
    });

    it('refuses to describe itself as JSON Schema without a converter', () => {
      const Opaque = Nominal(
        'Opaque',
        handWritten((value) => ({ value: String(value) })),
      );

      expect(() => Opaque['~standard'].jsonSchema.output({ target: 'draft-07' })).toThrow(
        /cannot describe itself as JSON Schema/u,
      );
    });
  });
});
