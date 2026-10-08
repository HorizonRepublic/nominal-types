import { n, Nominal, NonEmptyString, PositiveInteger } from '../../src/index.ts';
import type { Email, RuleVerdict, Uuid } from '../../src/index.ts';

export class Row extends Nominal(
  'test.Row',
  n.object({ sku: NonEmptyString, quantity: PositiveInteger }),
) {}

export const uniqueSku = n.rule((rows: readonly Row[], report) => {
  const seen = new Map<string, number>();

  rows.forEach((row, index) => {
    const first = seen.get(row.sku.value);

    if (first === undefined) {
      seen.set(row.sku.value, index);
    } else {
      report({ path: [index, 'sku'], code: 'duplicate_sku', params: { row: first + 1 } });
    }
  });
});

export const Sheet = n.of(Row).array({ max: 10_000 }).check(uniqueSku);

export const rowsOf = (
  count: number,
  repeats: ReadonlyMap<number, number> = new Map(),
): Array<{ sku: string; quantity: number }> =>
  Array.from({ length: count }, (_, index) => ({
    sku: `SKU-${String(repeats.get(index) ?? index)}`,
    quantity: 1,
  }));

export const uuid = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

export const fewInStock = n.rule((stock: Readonly<Record<string, PositiveInteger>>, report) => {
  for (const [key, count] of Object.entries(stock)) {
    if (count.value > 10) report({ path: [key], code: 'too_many' });
  }
});

export const forwards = n.rule(
  ([low, high]: readonly [PositiveInteger, PositiveInteger]) =>
    low.value <= high.value || 'must not run backwards',
);

export const atWork = n.rule(
  (email: Email) => email.value.endsWith('@example.com') || 'must be work',
);

export const twoIds = n.rule((ids: readonly Uuid[]) => ids.length === 2 || 'must hold two');

export const pairs = (ids: readonly unknown[]): RuleVerdict => ids.length < 2 || 'too many';
