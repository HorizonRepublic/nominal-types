const unsettled = new WeakMap<object, () => unknown>();

/**
 * Internal: records how to build the parts of a schema declared before it is first used, such as
 * a built-in type's object, so the package generates no code while it loads.
 */
export const deferParts = (schema: object, settle: () => unknown): void => {
  unsettled.set(schema, settle);
};

/**
 * Internal: builds the parts of a schema whose parts were deferred, so its runner, check, writer
 * and plan can be looked up; nothing for any other value.
 */
export const settleParts = (schema: unknown): void => {
  if (typeof schema !== 'object' || schema === null) {
    return;
  }

  const settle = unsettled.get(schema);

  if (settle !== undefined) {
    unsettled.delete(schema);
    settle();
  }
};
