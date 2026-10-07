import { type } from 'arktype';
import { describe, expect, it, vi } from 'vitest';

import { NominalError } from '../../src/index.ts';
import { PromoSku, Sku, Slug } from '../support/fixtures.ts';
import { issuesOf, outputOf, thrownBy, valueOf } from '../support/results.ts';

const take = (sku: Sku): string => sku.value;
const takePromo = (sku: PromoSku): string => sku.value;

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

    it('passes an existing instance through without validating it again', () => {
      const sku = new Sku('SKU-0001');

      expect(valueOf(Sku.parse(sku))).toBe(sku);
      expect(outputOf(Sku['~standard'].validate(sku))).toBe(sku);
    });

    it('passes a refined instance through its parent type', () => {
      const promo = new PromoSku('SKU-9001');

      expect(valueOf(Sku.parse(promo))).toBe(promo);
    });

    it('rejects a parent instance whose value the refined type does not accept', () => {
      expect(issuesOf(PromoSku.parse(new Sku('SKU-0001')))).not.toHaveLength(0);
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

  describe('types', () => {
    it('keeps nominal types apart at compile time', () => {
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
