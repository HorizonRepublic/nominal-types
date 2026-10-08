import type { NominalInstance } from './contracts.ts';
import { isNominalType, ownTypes } from './nominal.ts';

/**
 * A value with every nominal instance in it replaced by what its `toJSON()` returns: the plain
 * value, a decimal string for the big integer types, text for the date and time types.
 *
 * @remarks
 * Arrays and objects become new, mutable ones. Other objects, such as a `Date` or an instance of a
 * class of your own, keep their type.
 *
 * @typeParam Value - The value whose instances are replaced.
 */
export type Plain<Value> =
  Value extends NominalInstance<string, unknown>
    ? unknown extends ReturnType<Value['toJSON']>
      ? Plain<Value['value']>
      : Plain<ReturnType<Value['toJSON']>>
    : Value extends
          | string
          | number
          | bigint
          | boolean
          | symbol
          | null
          | undefined
          | ((...parameters: never[]) => unknown)
      ? Value
      : { -readonly [Key in keyof Value]: Plain<Value[Key]> };

const enter = (value: object, path: object[]): void => {
  if (path.includes(value)) {
    throw new TypeError('n.plain(): the value refers to itself, which JSON cannot write');
  }

  path.push(value);
};

// Copying first and replacing only the objects inside lets V8 clone the array or object in one
// step, about twice as fast as building the copy key by key.
const plainArray = (value: readonly unknown[], path: object[]): unknown[] => {
  enter(value, path);

  const copy = value.slice();
  const count = copy.length;

  for (let index = 0; index < count; index += 1) {
    const item = copy[index];

    if (typeof item === 'object' && item !== null) {
      copy[index] = plainOf(item, path);
    }
  }

  path.pop();

  return copy;
};

const plainRecord = (value: object, path: object[]): object => {
  enter(value, path);

  const copy: Record<string, unknown> = { ...value };

  for (const key in copy) {
    const item = copy[key];

    if (typeof item === 'object' && item !== null && Object.hasOwn(copy, key)) {
      copy[key] = plainOf(item, path);
    }
  }

  path.pop();

  return copy;
};

const plainInstance = (value: { toJSON(): unknown }, path: object[]): unknown => {
  const json = value.toJSON();

  if (typeof json !== 'object' || json === null) {
    return json;
  }

  enter(value, path);

  const plain = plainOf(json, path);

  path.pop();

  return plain;
};

const plainOf = (value: object, path: object[]): unknown => {
  if (value instanceof ownTypes.root) {
    return plainInstance(value, path);
  }

  if (Array.isArray(value)) {
    return plainArray(value, path);
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  if (prototype === Object.prototype || prototype === null) {
    return plainRecord(value, path);
  }

  return isNominalType(Reflect.get(value, 'constructor'))
    ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      plainInstance(value as { toJSON(): unknown }, path)
    : value;
};

/**
 * `n.plain()` without its type, for the writers that know a schema's shape and fall
 * back to it for the parts they don't.
 *
 * @internal
 */
export const plainValue = (value: unknown): unknown =>
  typeof value === 'object' && value !== null ? plainOf(value, []) : value;

/**
 * A copy of a value with every nominal instance in it replaced by its JSON form, for a response
 * that goes to `JSON.stringify()` or a framework that serializes it.
 *
 * @remarks
 * `JSON.stringify()` calls `toJSON()` on every instance it meets, which makes a response several
 * times slower to write than the same plain values. The copy holds only plain values, so it is
 * written at plain speed. Arrays and plain objects are copied at any depth, an instance becomes
 * what its `toJSON()` returns, including instances from another copy of the package, and any other
 * value is kept as it is: a `Date`, a `Map`, an instance of a class of your own. The input is not
 * changed. For an `n.object()` or `n.of()` schema, its `toPlain()` is faster still.
 *
 * @typeParam Value - The type of the value to copy.
 * @param value - The value to copy, such as a response body.
 * @returns A copy that holds plain values in place of the instances.
 * @throws {@link TypeError} when the value refers to itself, which `JSON.stringify()` refuses too.
 *
 * @example
 * ```ts
 * import { n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
 *
 * const order = {
 *   id: new Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f'),
 *   quantity: new PositiveInteger(2),
 * };
 *
 * n.plain(order); // { id: '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', quantity: 2 }
 * ```
 */
export const plain = <Value>(value: Value): Plain<Value> => {
  // The walk above builds exactly the shape `Plain` describes.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return plainValue(value) as Plain<Value>;
};
