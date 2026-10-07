const typeNamePattern = /^[\w-]+(?:\.[\w-]+)*$/u;

/**
 * Internal: refuses a type name that can't serve as a schema name in OpenAPI: one or more parts of
 * letters, digits, `_` and `-`, joined by dots, such as `billing.InvoiceNumber`.
 *
 * @throws TypeError for any other name.
 */
export const checkTypeName = (name: unknown): void => {
  if (typeof name !== 'string' || !typeNamePattern.test(name)) {
    throw new TypeError(
      `${JSON.stringify(name) ?? String(name)} is not a valid type name: use letters, digits, _ and -, with dots between parts, such as billing.InvoiceNumber`,
    );
  }
};
