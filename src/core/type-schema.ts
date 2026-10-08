// The schema keeps its shape and paths private, built at once or at the first use, and every
// method reads them; that makes the file longer than the usual limit.
/* oxlint-disable max-lines */
import type { ArrayOptions } from './array-bounds.ts';
import { standInParts } from './built-parts.ts';
import type { BuiltParts } from './built-parts.ts';
import type { Parsed } from './contracts.ts';
import { deferParts } from './deferred-parts.ts';
import {
  arrayPaths,
  nullablePaths,
  optionalPaths,
  registerPaths,
  stringifyFor,
  textPaths,
} from './fast-paths.ts';
import type { FastPaths, Plain } from './fast-paths.ts';
import { forTarget } from './json-target.ts';
import { settled } from './nominal-error.ts';
import { Rejection } from './rejection.ts';
import { runners } from './runner.ts';
import { arrayShape, nullableShape, optionalShape, textShape } from './shapes.ts';
import type { Shape } from './shapes.ts';
import { shared } from './shared.ts';
import { standardProps, vendor } from './standard-props.ts';
import type { StandardProps } from './standard-schema.ts';
import type { TextForm } from './text-form.ts';

/**
 * Internal: whether a schema accepts an array at its top, also behind `optional()` and
 * `nullable()`, so an adapter can wrap a lone value from a query string.
 */
export const isArraySchema = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && shared.arraySchemas.has(value);

/**
 * Internal: whether a value is a schema built by `n.of()`, including one from another copy of
 * this package.
 */
export const isTypeSchema = (value: unknown): value is TypeSchema<unknown, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'parse') === 'function' &&
  typeof Reflect.get(value, 'array') === 'function' &&
  Reflect.get(Reflect.get(value, '~standard') ?? {}, 'vendor') === vendor;

/**
 * A nominal type, or a shape around one, as a plain Standard Schema object: what `n.of()`
 * returns.
 *
 * @remarks
 * Each method returns a new schema and leaves this one as it is, so a schema can be shared and
 * extended freely. The methods read left to right: `n.of(Uuid).array().optional()` is an
 * optional array, `n.of(Uuid).optional().array()` an array of optional items.
 */
export class TypeSchema<Input, Output> {
  public readonly '~standard': StandardProps<Input, Output>;
  #shape: Shape<Output>;
  readonly #textForm: TextForm | undefined;
  #paths: FastPaths;
  readonly #name: string;
  #stringify: ((value: unknown) => string) | undefined;
  #build: (() => BuiltParts<Output>) | undefined;

  /**
   * Internal: built by `n.of()` and the methods below from its shape and the paths that know it,
   * or from a function that builds them at the first use; `name` is the function that built it,
   * for the message of `parseAsync()`.
   */
  public constructor(
    parts: BuiltParts<Output> | (() => BuiltParts<Output>),
    options: {
      readonly textForm?: TextForm | undefined;
      readonly array?: boolean;
      readonly name?: string;
    } = {},
  ) {
    this.#textForm = options.textForm;
    this.#name = options.name ?? 'n.of()';

    this.#build = typeof parts === 'function' ? parts : () => parts;
    ({ shape: this.#shape, paths: this.#paths } = standInParts(() => this.#settled()));

    if (typeof parts === 'function') {
      deferParts(this, () => this.#settled());
    } else {
      this.#settled();
    }

    const { run, describe } = this.#shape;

    this['~standard'] = standardProps(run, (side, target) =>
      forTarget(target, describe(side, target)),
    );

    if (options.array === true) {
      shared.arraySchemas.add(this);
    }
  }

  #settled(): BuiltParts<Output> {
    const build = this.#build;

    if (build !== undefined) {
      this.#build = undefined;
      ({ shape: this.#shape, paths: this.#paths } = build());
      runners.set(this, this.#shape.run);
      registerPaths(this, this.#paths);
    }

    return { shape: this.#shape, paths: this.#paths };
  }

  /**
   * Checks a value without throwing: the result, or the issues that prevented it.
   *
   * @example
   * ```ts
   * n.of(Uuid).array().parse(['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', 'nope']);
   * // { ok: false, issues: [{ message: 'must be a UUID (was "nope")', path: [1] }] }
   * ```
   */
  public parse(input: unknown): Parsed<Output> {
    const result = this.#shape.run(input);

    return result instanceof Rejection
      ? { ok: false, issues: result.issues }
      : { ok: true, value: result };
  }

  /**
   * The value, or a Promise rejected with a `NominalError`, for libraries that await a parser and
   * expect it to throw, such as tRPC.
   *
   * @remarks
   * tRPC calls a schema's `parseAsync()` before its `parse()`, so `.input(schema)` refuses a bad
   * value with `BAD_REQUEST`. In your own code, read the result of `parse()`, which builds no
   * exception.
   *
   * @example
   * ```ts
   * await n.object({ customer: Email }).parseAsync({ customer: 'jane' });
   * // rejects: NominalError: n.object(): customer: must be an email address (was a string of 4 characters)
   * ```
   */
  public parseAsync(input: unknown): Promise<Output> {
    return settled(this.#shape.run(input), this.#name);
  }

  /**
   * Whether `parse()` would accept the input, answered without building the value or issues: for a
   * cheap yes or no.
   *
   * @remarks
   * A constructor of your own is not run, so a type whose constructor changes or refuses the input
   * can disagree with `parse()`. The answer doesn't narrow the input's type.
   *
   * @example
   * ```ts
   * n.of(Uuid).array({ max: 10 }).accepts(['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f']); // true
   * ```
   */
  public accepts(input: unknown): boolean {
    return this.#paths.accepts(input);
  }

  /**
   * A copy of a value this schema gave, with every instance replaced by its JSON form, for a
   * framework that writes the response itself; `stringify()` writes the text faster still.
   *
   * @remarks
   * It does what `n.plain()` does, only faster, since it knows where the instances are. An object
   * keeps only the declared fields, in declared order, as `parse()` keeps them. Parts the schema
   * doesn't describe, such as a field from another library, go through `n.plain()`. The value is
   * not changed.
   *
   * @example
   * ```ts
   * const Order = n.object({ id: Uuid, quantity: PositiveInteger });
   * const order = Order.parse(body);
   *
   * if (order.ok) Order.toPlain(order.value); // { id: '0190f1c2-…', quantity: 2 }
   * ```
   */
  public toPlain(value: Output): Plain<Output> {
    // The writer builds exactly the shape `Plain` describes.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return this.#paths.write(value) as Plain<Output>;
  }

  /**
   * The JSON text of a value this schema gave, written straight from its instances: what
   * `JSON.stringify(n.plain(value))` writes, several times faster, for a response body.
   *
   * @remarks
   * An object keeps only the declared fields, in declared order, as `toPlain()` does. Parts the
   * schema doesn't describe, such as a field from another library or an instance whose `value` was
   * changed, go through `JSON.stringify()`, so the text is the same.
   *
   * @throws TypeError for a value JSON has no text for, such as `undefined`.
   *
   * @example
   * ```ts
   * const Order = n.object({ id: Uuid, quantity: PositiveInteger });
   * const order = Order.parse(body);
   *
   * if (order.ok) Order.stringify(order.value); // '{"id":"0190f1c2-…","quantity":2}'
   * ```
   */
  public stringify(value: Output): string {
    return (this.#stringify ??= stringifyFor(this.#settled().paths))(value);
  }

  /**
   * A new array of values this schema accepts, read-only by type.
   *
   * @remarks
   * The number of items is checked before any item, so an array that is too long costs nothing
   * more. Every item is checked, and each issue carries the item's index in its path. With
   * `unique: true`, an item equal to an earlier one is refused once every item is valid, compared
   * as `equals()` compares them, and the issue carries the index of the repeat.
   *
   * @throws TypeError when the counts are not whole numbers from 0 up, `length` is mixed with `min`
   * or `max`, `min` is above `max`, or `unique` is not a boolean.
   *
   * @example
   * ```ts
   * n.of(Url).array({ max: 10 });
   * n.of(UserId).array({ length: 3 });
   * n.of(Uuid).array({ unique: true });
   * ```
   */
  public array(options: ArrayOptions = {}): TypeSchema<readonly Input[], readonly Output[]> {
    const { shape: item, paths } = this.#settled();
    const shape = arrayShape(item, options);

    return new TypeSchema(
      { shape, paths: arrayPaths(paths, options, shape.run) },
      {
        array: true,
        name: this.#name,
      },
    );
  }

  /**
   * This schema, reading its value from text first, for values that arrive as strings: environment
   * variables, query strings, form fields, CSV.
   *
   * @remarks
   * Only a string is read; any other value goes to the rule as it is. Numbers are read the way
   * JSON writes them (`'2'`, `'-1.5'`, `'1e3'`), booleans from `'true'` and `'false'`; other text
   * reaches the rule unchanged and is rejected with the usual message. String and bigint types
   * take text already. Call it on `n.of(Type)` itself, before `array()`, `optional()` or
   * `nullable()`.
   *
   * @throws TypeError when called after another method, or for a type with no text form, such as
   * one declared from scratch with `Nominal()`.
   *
   * @example
   * ```ts
   * n.of(Port).fromString().parse(process.env.PORT);
   * n.of(PositiveInteger).fromString().array();
   * ```
   */
  public fromString(): TypeSchema<Input | string, Output> {
    const form = this.#textForm;

    if (form === undefined) {
      throw new TypeError(
        'fromString(): call it on n.of(Type) of a string, number, bigint or boolean type, before array(), optional() or nullable(); for an n.object() schema, call fromEnv()',
      );
    }

    const { shape, paths } = this.#settled();

    return new TypeSchema<Input | string, Output>(
      { shape: textShape(shape, form), paths: textPaths(paths, form) },
      {
        name: this.#name,
      },
    );
  }

  /**
   * This schema, or `undefined`, for a value that may be missing.
   *
   * @remarks
   * JSON has no `undefined`, so the JSON Schema is that of the value; a missing property is
   * expressed by leaving it out of `required` in the object around it.
   */
  public optional(): TypeSchema<Input | undefined, Output | undefined> {
    const { shape, paths } = this.#settled();

    return new TypeSchema(
      { shape: optionalShape(shape), paths: optionalPaths(paths) },
      {
        array: isArraySchema(this),
        name: this.#name,
      },
    );
  }

  /**
   * This schema, or `null`, for a value that may be explicitly empty.
   *
   * @remarks
   * In JSON Schema it becomes an `anyOf` with `{ type: 'null' }`; for OpenAPI 3.0, which has no
   * `null` type, the value's schema with `nullable: true`.
   */
  public nullable(): TypeSchema<Input | null, Output | null> {
    const { shape, paths } = this.#settled();

    return new TypeSchema(
      { shape: nullableShape(shape), paths: nullablePaths(paths) },
      {
        array: isArraySchema(this),
        name: this.#name,
      },
    );
  }
}
