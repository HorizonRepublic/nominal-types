import { generateFunction } from '../../core/compile.ts';

type Build = (value: unknown) => unknown;

/**
 * A field ArkType declared on an object, with the builder for its value, if any.
 *
 * @internal
 */
export interface DeclaredField {
  /**
   * The field's key.
   */
  readonly key: string;

  /**
   * Whether ArkType declared the field optional.
   */
  readonly optional: boolean;

  /**
   * The builder for the field's value, or `undefined` where the value stays as it is.
   */
  readonly build: Build | undefined;
}

const isBuild = (value: unknown): value is Build => typeof value === 'function';

// An own property even for `__proto__`, which an assignment would take as the prototype.
const copyUndeclared = (built: object, value: object): void => {
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(built, key)) {
      Object.defineProperty(built, key, {
        value: Reflect.get(value, key),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
};

const fieldSource = (field: DeclaredField, index: number): string => {
  const key = JSON.stringify(field.key);
  const read = `value[${key}]`;

  return field.build === undefined ? read : `build${String(index)}(${read})`;
};

/**
 * A generated function that builds an object from one ArkType accepted: a literal with
 * every declared field, optional ones only where present, and undeclared keys copied only when the
 * value has any; `undefined` where code generation is forbidden.
 *
 * @remarks
 * A literal gives V8 one shape and no keyed stores, about five times faster than a loop over the
 * fields with a spread.
 *
 * @internal
 */
export const generatedObjectBuilder = (
  fields: readonly DeclaredField[],
  keepsUndeclared: boolean,
  generate?: boolean,
): Build | undefined => {
  const required = fields.filter((field) => !field.optional);
  const optional = fields.filter((field) => field.optional);
  const literal = required
    .map((field) => `${JSON.stringify(field.key)}: ${fieldSource(field, fields.indexOf(field))}`)
    .join(', ');
  const optionalLines = optional.map((field) => {
    const key = JSON.stringify(field.key);
    const index = fields.indexOf(field);
    const item =
      field.build === undefined
        ? `value[${key}]`
        : `item === undefined ? item : build${String(index)}(item)`;

    return `if (${key} in value) { const item = value[${key}]; built[${key}] = ${item}; count += 1; }`;
  });
  const undeclared = keepsUndeclared
    ? 'let keys = 0; for (const key in value) keys += 1; if (keys !== count) copyUndeclared(built, value);'
    : '';
  const source = `function buildObject(value) {
    if (typeof value !== 'object' || value === null) return value;
    const built = { ${literal} };
    let count = ${String(required.length)};
    ${optionalLines.join('\n')}
    ${undeclared}
    return built;
  }`;
  const names = ['copyUndeclared', ...fields.map((_field, index) => `build${String(index)}`)];
  const values = [copyUndeclared, ...fields.map((field) => field.build)];
  const built = generateFunction(names, source, values, generate);

  return isBuild(built) ? built : undefined;
};

/**
 * A generated function that builds every item of an array with one builder, or
 * `undefined` where code generation is forbidden.
 *
 * @internal
 */
export const generatedArrayBuilder = (build: Build, generate?: boolean): Build | undefined => {
  const built = generateFunction(
    ['build'],
    `function buildArray(value) {
      if (!Array.isArray(value)) return value;
      const built = [];
      for (let index = 0; index < value.length; index += 1) built.push(build(value[index]));
      return built;
    }`,
    [build],
    generate,
  );

  return isBuild(built) ? built : undefined;
};
