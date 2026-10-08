import { expect } from 'vitest';

import {
  CountryCode,
  DecimalString,
  Int64,
  Money,
  n,
  Nominal,
  NonEmptyString,
} from '../../src/index.ts';

/**
 * A type of your own whose values are objects.
 */
export class Address extends Nominal(
  'orm.Address',
  n.object({ city: NonEmptyString, country: CountryCode }),
) {}

/**
 * A type whose values are one of several tagged objects.
 */
export class Shape extends Nominal(
  'orm.Shape',
  n.union('kind', {
    circle: n.object({ radius: Int64 }),
    square: n.object({ side: Int64 }),
  }),
) {}

export const price = new Money({ amount: '12.30', currency: 'EUR' });
export const address = new Address({ city: 'Lisbon', country: 'PT' });
export const shape = new Shape({ kind: 'circle', radius: 2n ** 60n });
export const total = new DecimalString(
  '-12345678901234567890123456789.123456789012345678901234567890',
);

export const storedPrice = '{"amount":"12.30","currency":"EUR"}';
export const badPrice = '{"amount":"1.234","currency":"EUR"}';
export const lostDigits =
  'must come from the database as text, since a number may have lost digits';

/**
 * Checks what the JSON columns of a row read with plain SQL hold: the plain JSON as text.
 */
export const expectStored = (row: unknown): void => {
  expect(row).toMatchObject({
    price: storedPrice,
    shape: '{"kind":"circle","radius":"1152921504606846976"}',
  });
};
