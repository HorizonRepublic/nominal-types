import {
  AnyString,
  Email,
  FiniteNumber,
  n,
  NonEmptyString,
  NonNegativeInteger,
  PositiveInteger,
  Uuid,
} from '../src/index.ts';

class Sku extends AnyString.subtype('bench.Sku', /^[A-Z]{3}-\d{4}$/u) {}

/**
 * The order the performance review measured: seven fields of different types and 20 items.
 */
export const Order = n.object({
  id: Uuid,
  email: Email,
  name: NonEmptyString,
  count: NonNegativeInteger,
  total: FiniteNumber,
  note: n.of(AnyString).optional(),
  customer: Uuid,
  items: n.object({ sku: Sku, quantity: PositiveInteger }).array(),
});

/**
 * A valid order as plain values; every second one has a note.
 */
export const orderInput = (index: number): Record<string, unknown> => ({
  id: `0190f1c2-3b4a-7c5d-8e9f-${String(index).padStart(12, '0')}`,
  email: `customer${String(index)}@example.com`,
  name: `Customer ${String(index)}`,
  count: index % 50,
  total: index * 1.25,
  ...(index % 2 === 0 ? { note: 'leave at the door' } : {}),
  customer: `0190f1c2-3b4a-7c5d-8e9f-${String(index + 1).padStart(12, '0')}`,
  items: Array.from({ length: 20 }, (_, item) => ({
    sku: `ABC-${String(item).padStart(4, '0')}`,
    quantity: item + 1,
  })),
});

/**
 * The value of a result that has to be valid.
 */
export const valueOf = <Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value => {
  if (!result.ok) {
    throw new Error('the bench input must be valid');
  }

  return result.value;
};
