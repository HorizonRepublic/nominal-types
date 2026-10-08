/**
 * Internal: a new instance of the class `instance` belongs to, built from `value`, for methods of
 * built-in types such as `canonical()` that keep a subtype: a `StaffEmail` gives a `StaffEmail`.
 *
 * @throws NominalError when the class refuses the value, such as a subtype whose rule the new
 * value breaks.
 */
export const sameType = <Instance extends object>(instance: Instance, value: unknown): Instance => {
  const type: unknown = instance.constructor;

  if (typeof type !== 'function') {
    throw new TypeError('the instance has no class to build a copy with');
  }

  // A class built from a nominal type makes instances of itself.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Reflect.construct(type, [value]) as Instance;
};
