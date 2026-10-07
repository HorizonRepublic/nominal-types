const isPlainObject = (value: object): boolean => {
  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

/**
 * Internal: whether a value is a plain object, whose own keys are its whole content.
 */
export const isPlainRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && isPlainObject(value);

const frozenArray = (value: readonly unknown[]): readonly unknown[] => {
  const items = value.map((item: unknown) => frozen(item));

  return Object.isFrozen(value) && items.every((item, index) => item === value[index])
    ? value
    : Object.freeze(items);
};

const frozenRecord = (value: Readonly<Record<string, unknown>>): object => {
  const copy: Record<string, unknown> = {};
  let same = Object.isFrozen(value);

  for (const key of Object.keys(value)) {
    const item = value[key];
    const settled = frozen(item);

    copy[key] = settled;
    same &&= settled === item;
  }

  return same ? value : Object.freeze(copy);
};

/**
 * Internal: a value as a type holds it: a primitive as is, plain objects and arrays frozen all the
 * way down, anything else (an instance, a `Date`, a `Map`) as is.
 *
 * @remarks
 * What is not frozen yet is copied before freezing, so a caller's input stays theirs when a rule
 * hands back the object it was given; what is frozen all the way down already is kept.
 */
export const frozen = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return frozenArray(value);
  }

  return isPlainRecord(value) ? frozenRecord(value) : value;
};
