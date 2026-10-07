import type { StandardSchemaV1 } from '@standard-schema/spec';
import { type } from 'arktype';
import { describe, expect, it, vi } from 'vitest';

import { Nominal, NominalError } from '../../src/index.ts';
import type { Parsed } from '../../src/index.ts';

class Sku extends Nominal('Sku', type(/^SKU-\d{4}$/u)) {
  public get number(): number {
    return Number(this.value.slice(4));
  }
}

class Slug extends Nominal('Slug', type(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)) {}

class PromoSku extends Sku.refine('PromoSku', (schema) => schema.and(/^SKU-9\d{3}$/u)) {}

class LenientSku extends Sku {
  public static override readonly schema = type(/^SKU-\d{4,6}$/u);
}

const thrownBy = (build: () => unknown): unknown => {
  try {
    build();
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to throw');
};

const valueOf = <Instance>(parsed: Parsed<Instance>): Instance => {
  if (!parsed.ok) {
    throw new Error('expected a parsed value');
  }
  return parsed.value;
};

const issuesOf = (parsed: Parsed<unknown>): readonly StandardSchemaV1.Issue[] => {
  if (parsed.ok) {
    throw new Error('expected issues');
  }
  return parsed.issues;
};

const outputOf = <Output>(result: StandardSchemaV1.Result<Output>): Output => {
  if (result.issues !== undefined) {
    throw new Error('expected a value');
  }
  return result.value;
};

const handWritten = (
  validate: (
    value: unknown,
  ) => StandardSchemaV1.Result<string> | Promise<StandardSchemaV1.Result<string>>,
): StandardSchemaV1<string, string> => ({
  '~standard': { version: 1, vendor: 'hand-written', validate },
});

const stringOnly = (value: unknown): StandardSchemaV1.Result<string> =>
  typeof value === 'string' ? { value } : { issues: [{ message: 'must be a string' }] };

describe('Nominal', () => {
  describe('construction', () => {
    it('builds an instance for a value the schema accepts', () => {
      const sku = new Sku('SKU-0042');

      expect(sku.value).toBe('SKU-0042');
      expect(sku.number).toBe(42);
    });

    it('throws a NominalError carrying the issues for a value the schema rejects', () => {
      const error = thrownBy(() => new Sku('nope'));

      expect(error).toBeInstanceOf(NominalError);
      expect(error).toMatchObject({ typeName: 'Sku', issues: [expect.anything()] });
    });
  });

  describe('parse', () => {
    it('returns the instance without throwing', () => {
      const sku = valueOf(Sku.parse('SKU-0001'));

      expect(sku).toBeInstanceOf(Sku);
      expect(sku.number).toBe(1);
    });

    it('returns the issues without throwing', () => {
      expect(issuesOf(Sku.parse(42))).not.toHaveLength(0);
    });

    it('leaves later constructions of the same input validated', () => {
      Sku.parse('SKU-0001');

      expect(() => new Slug('SKU-0001')).toThrow(NominalError);
    });
  });

  describe('is and instanceof', () => {
    it('recognises its own instances only', () => {
      expect(Sku.is(new Sku('SKU-0001'))).toBe(true);
      expect(Sku.is('SKU-0001')).toBe(false);
      expect(Sku.is(new Slug('sku'))).toBe(false);
    });

    it('treats a refined instance as its parent, and not the other way round', () => {
      const promo = new PromoSku('SKU-9001');

      expect(promo).toBeInstanceOf(Sku);
      expect(promo).toBeInstanceOf(PromoSku);
      expect(new Sku('SKU-0001')).not.toBeInstanceOf(PromoSku);
    });

    it('recognises an instance built by another copy of the package', async () => {
      vi.resetModules();
      const copy = await import('../../src/core/nominal.ts');
      const OtherSku = copy.Nominal('Sku', type(/^SKU-\d{4}$/u));

      expect(new OtherSku('SKU-0001')).toBeInstanceOf(Sku);
      expect(new Sku('SKU-0001')).toBeInstanceOf(OtherSku);
    });
  });

  describe('refine', () => {
    it('applies the parent schema and the narrower one', () => {
      expect(new PromoSku('SKU-9001').value).toBe('SKU-9001');
      expect(() => new PromoSku('SKU-0001')).toThrow(NominalError);
      expect(PromoSku.typeName).toBe('PromoSku');
    });

    it('keeps the behaviour of the parent class', () => {
      expect(new PromoSku('SKU-9123').number).toBe(9123);
    });
  });

  describe('overriding the schema in a subclass', () => {
    it('validates with the subclass schema', () => {
      expect(new LenientSku('SKU-123456').number).toBe(123_456);
      expect(() => new Sku('SKU-123456')).toThrow(NominalError);
      expect(valueOf(LenientSku.parse('SKU-123456'))).toBeInstanceOf(LenientSku);
    });

    it('stays the same nominal type as the class it extends', () => {
      expect(new LenientSku('SKU-0001')).toBeInstanceOf(Sku);
      expect(new Sku('SKU-0001')).toBeInstanceOf(LenientSku);
    });
  });

  describe('value semantics', () => {
    it('compares by type and value', () => {
      expect(new Sku('SKU-0001').equals(new Sku('SKU-0001'))).toBe(true);
      expect(new Sku('SKU-0001').equals(new Sku('SKU-0002'))).toBe(false);
      expect(new Sku('SKU-0001').equals('SKU-0001')).toBe(false);
    });

    it('serialises to the bare value', () => {
      expect(JSON.stringify({ sku: new Sku('SKU-0001') })).toBe('{"sku":"SKU-0001"}');
      expect(String(new Sku('SKU-0001'))).toBe('SKU-0001');
    });
  });

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
      const order = type({ sku: Sku.standard() });

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

  describe('types', () => {
    it('keeps nominal types apart at compile time', () => {
      const take = (sku: Sku): string => sku.value;
      const takePromo = (sku: PromoSku): string => sku.value;

      // @ts-expect-error a Slug is not a Sku even though both wrap a string
      take(new Slug('sku'));
      // @ts-expect-error a plain string is not a Sku
      take('SKU-0001');
      // @ts-expect-error a Sku is not necessarily a PromoSku
      takePromo(new Sku('SKU-0001'));

      expect(take(new PromoSku('SKU-9001'))).toBe('SKU-9001');
    });
  });
});
