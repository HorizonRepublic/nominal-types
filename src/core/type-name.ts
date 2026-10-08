const typeNamePattern = /^[\w-]+(?:\.[\w-]+)*$/u;

/**
 * Refuses a type name that can't serve as a schema name in OpenAPI: one or more parts of
 * letters, digits, `_` and `-`, joined by dots, such as `billing.InvoiceNumber`.
 *
 * @throws {@link TypeError} when the name is anything else.
 *
 * @internal
 */
export const checkTypeName = (name: unknown): void => {
  if (typeof name !== 'string' || !typeNamePattern.test(name)) {
    throw new TypeError(
      `${JSON.stringify(name) ?? String(name)} is not a valid type name: use letters, digits, _ and -, with dots between parts, such as billing.InvoiceNumber`,
    );
  }
};
