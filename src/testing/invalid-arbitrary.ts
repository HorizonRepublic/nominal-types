import * as fc from 'fast-check';
import type { Arbitrary } from 'fast-check';

const wrongKind: Arbitrary<unknown> = fc.oneof(
  fc.constantFrom(null, false),
  fc.option(fc.constant(true), { nil: undefined, freq: 1 }),
  fc.boolean(),
  fc.double(),
  fc.string(),
  fc.bigInt(),
  fc.array(fc.oneof(fc.string(), fc.integer())),
  fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer())),
);

const textChange = (text: string): Arbitrary<unknown> =>
  fc.oneof(
    fc
      .tuple(fc.nat({ max: text.length }), fc.string({ minLength: 1, maxLength: 2 }))
      .map(([at, inserted]) => text.slice(0, at) + inserted + text.slice(at)),
    fc
      .nat({ max: Math.max(0, text.length - 1) })
      .map((at) => text.slice(0, at) + text.slice(at + 1)),
    fc.constantFrom(
      '',
      ` ${text}`,
      `${text} `,
      text.toUpperCase(),
      text.toLowerCase(),
      text.slice(0, Math.floor(text.length / 2)),
      text.repeat(2),
      text.padEnd(300, text === '' ? 'a' : text),
    ),
  );

const numberChange = (value: number): Arbitrary<unknown> =>
  fc.constantFrom(
    value + 1,
    value - 1,
    -value,
    value + 0.5,
    value * 2,
    value + Number.EPSILON * Math.max(1, Math.abs(value)),
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    String(value),
  );

const bigintChange = (value: bigint): Arbitrary<unknown> =>
  fc.constantFrom(value + 1n, value - 1n, -value, `${value}.5`, `${value}n`, Number(value) + 0.5);

// A list one item shorter or longer, or with one item changed.
const listChange = (list: readonly unknown[]): Arbitrary<unknown> => {
  const at = fc.nat({ max: Math.max(0, list.length - 1) });

  return fc.oneof(
    fc.constant(list.slice(1)),
    fc.constant([...list, ...list.slice(0, 1)]),
    fc.constant([...list, ...list]),
    list.length === 0
      ? wrongKind.map((item) => [item])
      : fc.oneof(
          fc.tuple(at, wrongKind).map(([index, item]) => list.with(index, item)),
          at.chain((index) => changed(list[index]).map((item) => list.with(index, item))),
        ),
  );
};

// An object with one field left out, changed or added.
const recordChange = (record: object): Arbitrary<unknown> => {
  const keys = Object.keys(record);
  const added = fc.constant({ ...record, unexpected: 1 });

  if (keys.length === 0) {
    return added;
  }

  return fc.oneof(
    added,
    fc
      .constantFrom(...keys)
      .map((key) => Object.fromEntries(Object.entries(record).filter(([name]) => name !== key))),
    fc
      .constantFrom(...keys)
      .chain((key) =>
        changed(Reflect.get(record, key)).map((value) =>
          Object.assign({}, record, { [key]: value }),
        ),
      ),
  );
};

/**
 * A value close to a valid one, changed a little in a way that depends on its kind.
 *
 * @internal
 */
export const changed = (value: unknown): Arbitrary<unknown> => {
  if (typeof value === 'string') {
    return textChange(value);
  }

  if (typeof value === 'number') {
    return numberChange(value);
  }

  if (typeof value === 'bigint') {
    return bigintChange(value);
  }

  if (Array.isArray(value)) {
    return listChange(value);
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return recordChange(value);
  }

  return wrongKind;
};

/**
 * Values of the wrong kind and valid values changed a little, before the filter that
 * keeps the ones the target refuses.
 *
 * @internal
 */
export const nearAndWrong = (valid: Arbitrary<unknown>): Arbitrary<unknown> =>
  fc.oneof(
    { arbitrary: valid.chain((value) => changed(value)), weight: 3 },
    { arbitrary: wrongKind, weight: 1 },
  );
