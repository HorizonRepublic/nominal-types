/**
 * A property of any value, `undefined` for a value that holds none.
 *
 * @internal
 */
export const propertyOf = (value: unknown, key: string): unknown =>
  (typeof value === 'object' || typeof value === 'function') && value !== null
    ? Reflect.get(value, key)
    : undefined;

/**
 * What calling a method of a value returns, `undefined` when it has no such method.
 *
 * @internal
 */
export const callOf = (value: unknown, key: string, ...args: readonly unknown[]): unknown => {
  const method = propertyOf(value, key);

  return typeof method === 'function' ? Reflect.apply(method, value, args) : undefined;
};

/**
 * The JSON Schema of the rule a class declares itself, or `undefined` when it declares
 * none or the rule can't describe itself.
 *
 * @internal
 */
export const ownRuleJson = (level: object): unknown => {
  const rule: unknown = Object.hasOwn(level, 'rule') ? Reflect.get(level, 'rule') : undefined;
  const jsonSchema = propertyOf(propertyOf(rule, '~standard'), 'jsonSchema');

  try {
    return callOf(jsonSchema, 'input', { target: 'draft-2020-12' });
  } catch {
    return undefined;
  }
};
