import { type } from 'arktype';

import { Nominal } from '../../src/index.ts';

export class Sku extends Nominal('Sku', type(/^SKU-\d{4}$/u)) {
  public get number(): number {
    return Number(this.value.slice(4));
  }
}

export class Slug extends Nominal('Slug', type(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)) {}

export class PromoSku extends Sku.subtype('PromoSku', /^SKU-9/u) {}

export class FlashSku extends PromoSku.subtype('FlashSku', /^SKU-99/u) {}

export class LowSku extends Sku {
  public static override readonly schema = type(/^SKU-0/u);
}
