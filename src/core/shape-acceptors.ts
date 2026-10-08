import { acceptors, acceptsByRunning } from './acceptor.ts';
import type { Accepts } from './acceptor.ts';
import { generateFunction } from './compile.ts';
import type { AnyNominalType } from './contracts.ts';
import { settleParts } from './deferred-parts.ts';
import { foreignRunner } from './foreign-runner.ts';
import { isNominalType, ownTypes } from './nominal.ts';
import { isOwnVendor } from './standard-props.ts';
import { rulesAcceptsOf } from './type-rules.ts';

const isAccepts = (value: unknown): value is Accepts => typeof value === 'function';

/**
 * Internal: the check of a nominal type, as `Type.accepts()` answers it, held once for a schema
 * or a field.
 */
export const typeAcceptor = (type: AnyNominalType): Accepts => {
  if (!ownTypes.isOwn(type)) {
    const accepts: unknown = Reflect.get(type, 'accepts');

    return isAccepts(accepts)
      ? (input) => Reflect.apply(accepts, type, [input])
      : (input) => type.parse(input).ok;
  }

  const check = rulesAcceptsOf(ownTypes.root, type);

  return (input) =>
    typeof input === 'object' && input !== null ? type.accepts(input) : check(input);
};

/**
 * Internal: the check of a field of an object: its schema's own check when it has one, a run of
 * the schema otherwise.
 */
export const fieldAcceptor = (field: unknown, label: string): Accepts => {
  if (isNominalType(field)) {
    return typeAcceptor(field);
  }

  if (typeof field === 'object' && field !== null) {
    settleParts(field);

    const own = acceptors.get(field);

    if (own !== undefined) {
      return own;
    }

    const accepts: unknown = Reflect.get(field, 'accepts');

    if (isAccepts(accepts) && isOwnVendor(field)) {
      return (input) => Reflect.apply(accepts, field, [input]);
    }
  }

  // Anything else that reaches here is a schema `n.object()` already accepted as a field.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return acceptsByRunning(foreignRunner(field as never, label));
};

const arraySource = `function acceptsArray(input) {
  if (!Array.isArray(input)) return false;
  const count = input.length;
  if (count < min || count > max) return false;
  for (let index = 0; index < count; index += 1) if (!item(input[index])) return false;
  return true;
}`;

/**
 * Internal: the check of an array whose count lies between `min` and `max` and whose every item
 * `item` accepts.
 */
export const arrayAcceptor = (
  item: Accepts,
  min: number,
  max: number,
  generate?: boolean,
): Accepts => {
  const built = generateFunction(['item', 'min', 'max'], arraySource, [item, min, max], generate);

  if (isAccepts(built)) {
    return built;
  }

  return (input) =>
    Array.isArray(input) &&
    input.length >= min &&
    input.length <= max &&
    input.every((entry: unknown) => item(entry));
};

/**
 * Internal: the check of `item`, letting `undefined` or `null` through.
 */
export const emptyOrAcceptor =
  (item: Accepts, empty: undefined | null): Accepts =>
  (input) =>
    input === empty || item(input);

/**
 * Internal: a field of an object as its check sees it.
 */
export interface AcceptedField {
  readonly key: string;
  readonly accepts: Accepts;
  readonly optional: boolean;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const objectSource = (fields: readonly AcceptedField[], strict: boolean): string => {
  const checks = fields.map(({ key, optional }, index) => {
    const name = JSON.stringify(key);
    const at = String(index);
    const read = `const raw${at} = hasOwn.call(input, ${name}) ? input[${name}] : undefined;`;

    return optional
      ? `${read} if (raw${at} !== undefined && !accepts${at}(raw${at})) return false;`
      : `${read} if (raw${at} === undefined || !accepts${at}(raw${at})) return false;`;
  });
  const unknownKeys = strict
    ? 'for (const key of Object.keys(input)) if (!declared.has(key)) return false;'
    : '';

  return `function acceptsObject(input) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return false;
    ${checks.join('\n')}
    ${unknownKeys}
    return true;
  }`;
};

const objectLoop =
  (fields: readonly AcceptedField[], strict: boolean): Accepts =>
  (input) => {
    if (!isRecord(input)) {
      return false;
    }

    for (const { key, accepts, optional } of fields) {
      const item = Object.hasOwn(input, key) ? input[key] : undefined;

      if (item === undefined ? !optional : !accepts(item)) {
        return false;
      }
    }

    return !strict || Object.keys(input).every((key) => fields.some((field) => field.key === key));
  };

/**
 * Internal: the check of an `n.object()` schema without constraints, generated per object like
 * its run, returning at the first field that fails.
 */
export const objectAcceptor = (
  fields: readonly AcceptedField[],
  strict: boolean,
  generate?: boolean,
): Accepts => {
  const built = generateFunction(
    ['hasOwn', 'declared', ...fields.map((_field, index) => `accepts${String(index)}`)],
    objectSource(fields, strict),
    [
      Reflect.get(Object.prototype, 'hasOwnProperty'),
      new Set(fields.map(({ key }) => key)),
      ...fields.map(({ accepts }) => accepts),
    ],
    generate,
  );

  return isAccepts(built) ? built : objectLoop(fields, strict);
};
