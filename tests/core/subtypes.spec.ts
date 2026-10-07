import { type } from 'arktype';
import { describe, expect, it, vi } from 'vitest';

import { Nominal, NominalError } from '../../src/index.ts';
import { FlashSku, LenientSku, PromoSku, Sku } from '../support/fixtures.ts';
import { issuesOf, outputOf, valueOf } from '../support/results.ts';

describe('Subtypes', () => {
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

  describe('narrowing an instance of a parent type', () => {
    it('turns a parent instance into the refined type when its value fits', () => {
      const sku = new Sku('SKU-9001');
      const promo = valueOf(PromoSku.parse(sku));

      expect(promo).toBeInstanceOf(PromoSku);
      expect(promo).not.toBe(sku);
      expect(promo.value).toBe('SKU-9001');
    });

    it('narrows through every level of a chain', () => {
      const promo = valueOf(FlashSku.parse(new Sku('SKU-9901')));

      expect(promo).toBeInstanceOf(FlashSku);
      expect(issuesOf(FlashSku.parse(new PromoSku('SKU-9001')))).not.toHaveLength(0);
    });

    it('narrows through Standard Schema as well', () => {
      expect(outputOf(PromoSku['~standard'].validate(new Sku('SKU-9001')))).toBeInstanceOf(
        PromoSku,
      );
    });

    it('does not unwrap an unrelated type holding an acceptable value', () => {
      class Code extends Nominal('Code', type('string')) {}

      expect(issuesOf(Sku.parse(new Code('SKU-0001')))).not.toHaveLength(0);
    });

    it('narrows an instance built by another copy of the package', async () => {
      vi.resetModules();
      const copy = await import('../../src/core/nominal.ts');
      const OtherSku = copy.Nominal('Sku', type(/^SKU-\d{4}$/u));

      expect(valueOf(PromoSku.parse(new OtherSku('SKU-9001')))).toBeInstanceOf(PromoSku);
    });

    it('returns an instance of the refined type itself without checking it again', () => {
      const promo = new PromoSku('SKU-9001');

      expect(valueOf(PromoSku.parse(promo))).toBe(promo);
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
});
