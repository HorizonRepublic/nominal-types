import { AnyString } from '../../src/index.ts';

export class CountryCode extends AnyString.subtype('DocumentCountry', /^[A-Z]{2}$/u) {}

export class Postcode extends AnyString.subtype('DocumentPostcode', /^\d{5}$/u) {}

export class Sku extends AnyString.subtype('DocumentSku', /^SKU-\d{4}$/u) {}
