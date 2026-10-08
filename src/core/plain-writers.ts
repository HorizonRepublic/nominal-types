import { generateFunction } from './compile.ts';
import { settleParts } from './deferred-parts.ts';
import { isNominalType, ownTypes } from './nominal.ts';
import { plainValue } from './plain.ts';

/**
 * Internal: turns a value a schema gives into plain values, as `n.plain()` does, knowing the
 * schema's shape.
 */
export type Write = (value: unknown) => unknown;

/**
 * Internal: the writers of the schemas this copy of the package built, so an object that holds one
 * as a field can call it directly.
 */
export const writers: WeakMap<object, Write> = new WeakMap();

const isWrite = (value: unknown): value is Write => typeof value === 'function';

// An instance whose class keeps the root's `toJSON()` gives its value; reading it straight away
// skips a call and the walk up the prototype chain `instanceof` would take.
const instanceSource = `function writeInstance(value) {
  if (typeof value !== 'object' || value === null) return value;
  if (value.toJSON !== rootToJson) return plain(value);
  const json = value.value;
  return typeof json === 'object' && json !== null ? plain(json) : json;
}`;

// Without code generation every field shares one call site, so the walk of `n.plain()` is as fast.
const instanceLoop: Write = (value) =>
  typeof value === 'object' && value !== null ? plainValue(value) : value;

/**
 * Internal: the writer for a field of a nominal type: an instance becomes what its `toJSON()`
 * returns, generated so V8 sees the field's class at its call.
 */
export const instanceWriter = (generate?: boolean): Write => {
  const built = generateFunction(
    ['rootToJson', 'plain'],
    instanceSource,
    [Reflect.get(ownTypes.root.prototype, 'toJSON'), plainValue],
    generate,
  );

  return isWrite(built) ? built : instanceLoop;
};

const arraySource = `function writeArray(value) {
  if (!Array.isArray(value)) return plain(value);
  const count = value.length;
  const copy = [];
  for (let index = 0; index < count; index += 1) copy.push(item(value[index]));
  return copy;
}`;

/**
 * Internal: the writer for an array of what `item` writes.
 */
export const arrayWriter = (item: Write, generate?: boolean): Write => {
  const built = generateFunction(['item', 'plain'], arraySource, [item, plainValue], generate);

  if (isWrite(built)) {
    return built;
  }

  return (value) =>
    Array.isArray(value) ? value.map((entry: unknown) => item(entry)) : plainValue(value);
};

/**
 * Internal: the writer for `item` or `undefined`, or `null`; both are written as they are.
 */
export const emptyOrWriter =
  (item: Write, empty: undefined | null): Write =>
  (value) =>
    value === empty ? value : item(value);

/**
 * Internal: the writer for a field of an object or a constraint: its schema's own writer when it
 * has one, `n.plain()` otherwise.
 */
export const writerOf = (field: unknown): Write => {
  if (isNominalType(field)) {
    return instanceWriter();
  }

  if (typeof field !== 'object' || field === null) {
    return plainValue;
  }

  settleParts(field);

  const own = writers.get(field);

  if (own !== undefined) {
    return own;
  }

  const toPlain: unknown = Reflect.get(field, 'toPlain');

  return isWrite(toPlain) ? (value) => Reflect.apply(toPlain, field, [value]) : plainValue;
};

/**
 * Internal: a field of an object as its writer sees it.
 */
export interface WrittenField {
  readonly key: string;
  readonly write: Write;
  readonly optional: boolean;
}

// The fields before the first optional one go in an object literal, which V8 builds fastest; the
// rest are stored in order, so the copy keeps the declared order with optional fields missing.
const objectSource = (fields: readonly WrittenField[]): string => {
  const reads = fields.map(
    ({ key }, index) => `const v${String(index)} = value[${JSON.stringify(key)}];`,
  );
  const firstOptional = fields.findIndex(({ optional }) => optional);
  const literalCount = firstOptional === -1 ? fields.length : firstOptional;
  const literal = fields
    .slice(0, literalCount)
    .map(({ key }, index) => `${JSON.stringify(key)}: write${String(index)}(v${String(index)})`)
    .join(', ');
  const stores = fields.slice(literalCount).map(({ key, optional }, offset) => {
    const index = String(literalCount + offset);
    const store = `copy[${JSON.stringify(key)}] = write${index}(v${index});`;

    return optional ? `if (v${index} !== undefined) ${store}` : store;
  });

  return `function writeObject(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return plain(value);
    ${reads.join('\n')}
    const copy = { ${literal} };
    ${stores.join('\n')}
    return copy;
  }`;
};

const objectLoop =
  (fields: readonly WrittenField[]): Write =>
  (value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return plainValue(value);
    }

    const copy: Record<string, unknown> = {};

    for (const { key, write, optional } of fields) {
      const item: unknown = Reflect.get(value, key);

      if (!optional || item !== undefined) {
        copy[key] = write(item);
      }
    }

    return copy;
  };

/**
 * Internal: the writer for an `n.object()` schema: a new object of the declared fields, each
 * through its own writer, generated per object so every field has a call site of its own.
 *
 * @remarks
 * Keys the object doesn't declare are left out, as `parse()` leaves them out.
 */
export const objectWriter = (fields: readonly WrittenField[], generate?: boolean): Write => {
  const built = generateFunction(
    ['plain', ...fields.map((_field, index) => `write${String(index)}`)],
    objectSource(fields),
    [plainValue, ...fields.map(({ write }) => write)],
    generate,
  );

  return isWrite(built) ? built : objectLoop(fields);
};
