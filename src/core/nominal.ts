import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

import type { AnyNominalType, NominalSchema, NominalType, Parsed } from './contracts.ts';
import { NominalError } from './nominal-error.ts';
import type { StandardProps, StandardSchema } from './standard-schema.ts';

const namespace = '@horizon-republic/nominal-types';
const brandKeySlot = Symbol('brandKey');
const standardProps = new WeakMap<object, StandardProps<unknown, NominalRoot>>();
const standardSchemas = new WeakMap<object, StandardSchema<unknown, NominalRoot>>();

let pending:
  | { readonly target: object; readonly input: unknown; readonly value: unknown }
  | undefined;

const plainIssue = (issue: StandardSchemaV1.Issue): StandardSchemaV1.Issue =>
  issue.path === undefined || issue.path.length === 0
    ? { message: issue.message }
    : {
        message: issue.message,
        path: issue.path.map((segment) => (typeof segment === 'object' ? segment.key : segment)),
      };

const check = (target: typeof NominalRoot, input: unknown): StandardSchemaV1.Result<unknown> => {
  const result = target.schema['~standard'].validate(input);
  if (result instanceof Promise) {
    throw new TypeError(`${target.typeName}: asynchronous schemas are not supported`);
  }
  return result.issues === undefined ? result : { issues: result.issues.map(plainIssue) };
};

const converterOf = (target: typeof NominalRoot): StandardJSONSchemaV1.Converter => {
  const converter = target.schema['~standard'].jsonSchema;
  if (converter === undefined) {
    throw new TypeError(`${target.typeName}: the schema cannot describe itself as JSON Schema`);
  }
  return converter;
};

class NominalRoot {
  public static readonly typeName: string = 'Nominal';
  declare public static readonly schema: NominalSchema;
  public readonly value: unknown;

  public constructor(input: unknown) {
    const target = new.target;
    if (pending !== undefined && pending.target === target && Object.is(pending.input, input)) {
      this.value = pending.value;
      pending = undefined;
      return;
    }
    const result = check(target, input);
    if (result.issues !== undefined) {
      throw new NominalError(target.typeName, result.issues);
    }
    this.value = result.value;
  }

  public static get '~standard'(): StandardProps<unknown, NominalRoot> {
    const cached = standardProps.get(this);
    if (cached !== undefined) {
      return cached;
    }
    const props: StandardProps<unknown, NominalRoot> = {
      version: 1,
      vendor: namespace,
      validate: (value) => {
        const parsed = this.parse(value);
        return parsed.ok ? { value: parsed.value } : { issues: parsed.issues };
      },
      jsonSchema: {
        input: (options) => converterOf(this).input(options),
        output: (options) => converterOf(this).output(options),
      },
    };
    standardProps.set(this, props);
    return props;
  }

  public static [Symbol.hasInstance](value: unknown): boolean {
    const key: unknown = Reflect.get(this, brandKeySlot);
    if (typeof key !== 'symbol') {
      return Function.prototype[Symbol.hasInstance].call(this, value);
    }
    return typeof value === 'object' && value !== null && Reflect.get(value, key) === true;
  }

  public static parse(this: typeof NominalRoot, input: unknown): Parsed<NominalRoot> {
    if (typeof input === 'object' && input !== null) {
      if (input instanceof this) {
        return { ok: true, value: input };
      }
      if (descendsFromTypeOf(this, input)) {
        return this.parse(Reflect.get(input, 'value'));
      }
    }
    const result = check(this, input);
    if (result.issues !== undefined) {
      return { ok: false, issues: result.issues };
    }
    pending = { target: this, input, value: result.value };
    return { ok: true, value: new this(input) };
  }

  public static is(this: typeof NominalRoot, value: unknown): value is NominalRoot {
    return value instanceof this;
  }

  public static standard(this: typeof NominalRoot): StandardSchema<unknown, NominalRoot> {
    const cached = standardSchemas.get(this);
    if (cached !== undefined) {
      return cached;
    }
    const schema: StandardSchema<unknown, NominalRoot> = { '~standard': this['~standard'] };
    standardSchemas.set(this, schema);
    return schema;
  }

  public static subtype(
    this: typeof NominalRoot,
    name: string,
    stricter: (schema: NominalSchema) => NominalSchema,
  ): typeof NominalRoot {
    return derive(this, name, stricter(this.schema));
  }

  public equals(other: unknown): boolean {
    return (
      other instanceof NominalRoot &&
      Reflect.get(other.constructor, 'typeName') === Reflect.get(this.constructor, 'typeName') &&
      Object.is(other.value, this.value)
    );
  }

  public toJSON(): unknown {
    return this.value;
  }

  public toString(): string {
    return String(this.value);
  }
}

const descendsFromTypeOf = (target: typeof NominalRoot, instance: object): boolean => {
  let ancestor: unknown = Object.getPrototypeOf(target);
  while (typeof ancestor === 'function' && ancestor !== NominalRoot) {
    if (instance instanceof ancestor) {
      return true;
    }
    ancestor = Object.getPrototypeOf(ancestor);
  }
  return false;
};

const derive = (
  base: typeof NominalRoot,
  name: string,
  schema: NominalSchema,
): typeof NominalRoot => {
  const derived = class extends base {
    public static override readonly typeName: string = name;
    public static override readonly schema: NominalSchema = schema;
  };
  const key = Symbol.for(`${namespace}/${name}`);
  Object.defineProperty(derived, 'name', { value: name });
  Object.defineProperty(derived, brandKeySlot, { value: key });
  Object.defineProperty(derived.prototype, key, { value: true });
  return derived;
};

/**
 * Tells whether a value is a nominal type class, including one loaded from another copy of this
 * package.
 *
 * @remarks
 * Adapters use it to recognise a nominal type in metadata they receive, such as the parameter type
 * a framework reflects from a decorator.
 */
export const isNominalType = (value: unknown): value is AnyNominalType =>
  typeof value === 'function' &&
  value !== NominalRoot &&
  Reflect.get(Reflect.get(value, '~standard') ?? {}, 'vendor') === namespace;

/**
 * Declares a nominal type: a class whose instances exist only for values the schema accepts.
 *
 * @remarks
 * Extend the result to add behaviour. The name brands the type at compile time and identifies it
 * at runtime across ESM and CommonJS copies of this package, so it has to be unique among the
 * nominal types one application loads. A subclass that overrides `schema` stays the same type;
 * `refine` makes a distinct one.
 *
 * @example
 * ```ts
 * export class OrderNumber extends Nominal('OrderNumber', type(/^ORD-\d{8}$/)) {
 *   get sequence(): number {
 *     return Number(this.value.slice(4));
 *   }
 * }
 * ```
 */
export function Nominal<const Name extends string, Schema extends NominalSchema>(
  name: Name,
  schema: Schema,
): NominalType<Name, Schema>;
export function Nominal(name: string, schema: NominalSchema): typeof NominalRoot | AnyNominalType {
  return derive(NominalRoot, name, schema);
}
