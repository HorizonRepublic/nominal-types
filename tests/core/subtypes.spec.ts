import { type } from 'arktype';
import { describe, expect, it, vi } from 'vitest';

import { Nominal, NominalError } from '../../src/index.ts';
import { FlashSku, LowSku, PromoSku, Sku } from '../support/fixtures.ts';
import { issuesOf, outputOf, valueOf } from '../support/results.ts';

describe('Subtypes', () => {
  describe('subtype', () => {
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
    it('turns a parent instance into the subtype when its value fits', () => {
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

    it('returns an instance of the subtype itself without checking it again', () => {
      const promo = new PromoSku('SKU-9001');

      expect(valueOf(PromoSku.parse(promo))).toBe(promo);
    });
  });

  describe('extending a type with a schema of its own', () => {
    it('adds the subclass rule to the parent rule', () => {
      expect(new LowSku('SKU-0042').number).toBe(42);
      expect(issuesOf(LowSku.parse('SKU-9001'))).toStrictEqual([
        { message: 'must be matched by ^SKU-0 (was "SKU-9001")' },
      ]);
      expect(issuesOf(LowSku.parse('nope'))).toStrictEqual([
        { message: String.raw`must be matched by ^SKU-\d{4}$ (was "nope")` },
      ]);
    });

    it('cannot loosen the parent rule', () => {
      class Lenient extends Sku {
        public static override readonly schema = type(/^SKU-\d{4,6}$/u);
      }

      expect(() => new Lenient('SKU-123456')).toThrow(NominalError);
    });

    it('stays the same type in both directions, so a parent instance passes as the subclass', () => {
      expect(new LowSku('SKU-0001')).toBeInstanceOf(Sku);
      expect(new Sku('SKU-9001')).toBeInstanceOf(LowSku);
    });
  });

  describe('a subtype without a constraint', () => {
    it('is a new type with exactly the parent rules', () => {
      class ArchivedSku extends Sku.subtype('ArchivedSku') {}

      expect(new ArchivedSku('SKU-0001')).toBeInstanceOf(Sku);
      expect(new Sku('SKU-0001')).not.toBeInstanceOf(ArchivedSku);
      expect(() => new ArchivedSku('nope')).toThrow(NominalError);
    });
  });
});
