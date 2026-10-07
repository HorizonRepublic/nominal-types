import { describe, expect, it, vi } from 'vitest';

import { Nominal, NominalError } from '../../src/index.ts';
import { PromoSku, Sku } from '../support/fixtures.ts';
import { issuesOf, valueOf } from '../support/results.ts';

class WideSku extends Sku.variant('WideSku', /^SKU-\d{4,6}$/u) {}

class ClearanceSku extends PromoSku.variant('ClearanceSku', /^SKU-8/u) {}

const takeSku = (sku: Sku): number => sku.number;

describe('Variants', () => {
  describe('rules', () => {
    it('validates with its own rule in place of the source rule', () => {
      expect(new WideSku('SKU-123456').value).toBe('SKU-123456');
      expect(() => new Sku('SKU-123456')).toThrow(NominalError);
    });

    it('keeps the rules of the levels above the source', () => {
      expect(new ClearanceSku('SKU-8001').value).toBe('SKU-8001');
      expect(issuesOf(ClearanceSku.parse('SKU-9001'))).toStrictEqual([
        { message: 'must be matched by ^SKU-8 (was "SKU-9001")' },
      ]);
      expect(issuesOf(ClearanceSku.parse('SKU-80'))).toStrictEqual([
        { message: String.raw`must be matched by ^SKU-\d{4}$ (was "SKU-80")` },
      ]);
    });

    it('describes its own rules as JSON Schema', () => {
      expect(ClearanceSku['~standard'].jsonSchema.input({ target: 'draft-07' })).toStrictEqual({
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'ClearanceSku',
        allOf: [
          { type: 'string', pattern: String.raw`^SKU-\d{4}$` },
          { type: 'string', pattern: '^SKU-8' },
        ],
      });
    });
  });

  describe('behaviour', () => {
    it('carries the methods of its source', () => {
      expect(new WideSku('SKU-123456').number).toBe(123_456);
    });
  });

  describe('identity', () => {
    it('is not an instance of its source, and the source is not an instance of it', () => {
      expect(new WideSku('SKU-0001')).not.toBeInstanceOf(Sku);
      expect(new Sku('SKU-0001')).not.toBeInstanceOf(WideSku);
    });

    it('sits next to its source under the same parent', () => {
      expect(new ClearanceSku('SKU-8001')).toBeInstanceOf(Sku);
      expect(new ClearanceSku('SKU-8001')).not.toBeInstanceOf(PromoSku);
    });

    it('keeps its own identity across copies of the package', async () => {
      vi.resetModules();
      const copy = await import('../../src/core/nominal.ts');
      const OtherSku = copy.Nominal('Sku', /^SKU-\d{4}$/u);

      expect(new WideSku('SKU-0001')).not.toBeInstanceOf(OtherSku);
    });

    it('does not pass for its source at compile time, nor the source for it', () => {
      const takeWide = (sku: WideSku): string => sku.value;

      // @ts-expect-error a variant is not its source
      takeSku(new WideSku('SKU-0001'));
      // @ts-expect-error the source is not its variant
      takeWide(new Sku('SKU-0001'));

      expect(takeWide(new WideSku('SKU-0001'))).toBe('SKU-0001');
    });

    it('still passes for the parent above its source at compile time', () => {
      expect(takeSku(new ClearanceSku('SKU-8001'))).toBe(8001);
    });
  });

  describe('moving a value between a variant and its source', () => {
    it('turns a variant into the source when the value fits the source rules', () => {
      expect(valueOf(Sku.parse(new WideSku('SKU-0001')))).toBeInstanceOf(Sku);
    });

    it('refuses when the value does not fit the source rules', () => {
      expect(issuesOf(Sku.parse(new WideSku('SKU-123456')))).toHaveLength(1);
    });

    it('turns the source into a variant when the value fits the variant rules', () => {
      expect(valueOf(WideSku.parse(new Sku('SKU-0001')))).toBeInstanceOf(WideSku);
    });

    it('checks a sibling against its own rules through their common parent', () => {
      expect(issuesOf(PromoSku.parse(new ClearanceSku('SKU-8001')))).toStrictEqual([
        { message: 'must be matched by ^SKU-9 (was "SKU-8001")' },
      ]);
    });

    it('still refuses an unrelated type', () => {
      class Code extends Nominal('VariantCode', /^SKU-\d{4}$/u) {}

      expect(issuesOf(WideSku.parse(new Code('SKU-0001')))).toHaveLength(1);
    });
  });
});
