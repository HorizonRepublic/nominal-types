/**
 * Internal: a property of any value, `undefined` for a value that holds none.
 */
export const propertyOf = (value: unknown, key: string): unknown =>
  (typeof value === 'object' || typeof value === 'function') && value !== null
    ? Reflect.get(value, key)
    : undefined;

/**
 * Internal: what calling a method of a value returns, `undefined` when it has no such method.
 */
export const callOf = (value: unknown, key: string, ...args: readonly unknown[]): unknown => {
  const method = propertyOf(value, key);

  return typeof method === 'function' ? Reflect.apply(method, value, args) : undefined;
};

/**
 * Internal: the JSON Schema of the rule a class declares itself, or `undefined` when it declares
 * none or the rule can't describe itself.
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
