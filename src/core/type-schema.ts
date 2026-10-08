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
  checkedPaths,
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
import { checkedRun, ruleOf } from './rule.ts';
import type { Rule, RuleCheck } from './rule.ts';
import { runners } from './runner.ts';
import { arrayShape, nullableShape, optionalShape, textShape } from './shapes.ts';
import type { Shape } from './shapes.ts';
import { shared } from './shared.ts';
import { standardProps, vendor } from './standard-props.ts';
import type { StandardProps } from './standard-schema.ts';
import type { TextForm } from './text-form.ts';

/**
 * The parts of a schema before `check()` and the rules added to it, so a second `check()` adds
 * its rules to the same list.
 *
 * @typeParam Output - What the schema gives back.
 *
 * @internal
 */
interface Checked<Output> {
  /**
   * The parts of the schema without its rules.
   */
  readonly parts: BuiltParts<Output>;
  /**
   * The rules, in the order they were added.
   */
  readonly rules: ReadonlyArray<Rule<Output>>;
}

// Kept beside the schema rather than in a private field, whose type would tie schemas of
// different values together.
const checkedOf = new WeakMap<object, object>();

/**
 * The parts of a schema that also runs `rules` on the value it gave; the parts themselves when
 * there are no rules.
 *
 * @internal
 */
export const withRules = <Output>(
  parts: BuiltParts<Output>,
  rules: ReadonlyArray<Rule<Output>>,
): BuiltParts<Output> => {
  if (rules.length === 0) {
    return parts;
  }

  const run = checkedRun(parts.shape.run, rules);

  return { shape: { ...parts.shape, run }, paths: checkedPaths(parts.paths, run) };
};

/**
 * Whether a schema accepts an array at its top, also behind `optional()` and
 * `nullable()`, so an adapter can wrap a lone value from a query string.
 *
 * @internal
 */
export const isArraySchema = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && shared.arraySchemas.has(value);

/**
 * Whether a value is a schema built by `n.of()`, including one from another copy of
 * this package.
 *
 * @internal
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
 *
 * @typeParam Input - The type of the values the schema accepts.
 * @typeParam Output - The type of the value the schema gives back.
 *
 * @example
 * ```ts
 * import { n, Uuid } from '@horizon-republic/nominal-types';
 *
 * const OrderIds = n.of(Uuid).array({ max: 100 });
 *
 * OrderIds.accepts(['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f']); // true
 * ```
 */
export class TypeSchema<Input, Output> {
  /**
   * The Standard Schema and Standard JSON Schema properties, which let libraries such as tRPC,
   * Hono and OpenAPI generators use the schema.
   */
  public readonly '~standard': StandardProps<Input, Output>;
  #shape: Shape<Output>;
  readonly #textForm: TextForm | undefined;
  #paths: FastPaths;
  readonly #name: string;
  #stringify: ((value: unknown) => string) | undefined;
  #build: (() => BuiltParts<Output>) | undefined;

  /**
   * Built by `n.of()` and the methods below from its shape and the paths that know it,
   * or from a function that builds them at the first use; `name` is the function that built it,
   * for the message of `parseAsync()`.
   *
   * @internal
   */
  public constructor(
    parts: BuiltParts<Output> | (() => BuiltParts<Output>),
    options: {
      readonly textForm?: TextForm | undefined;
      readonly array?: boolean;
      readonly name?: string;
      readonly checked?: Checked<Output>;
    } = {},
  ) {
    this.#textForm = options.textForm;
    this.#name = options.name ?? 'n.of()';

    if (options.checked !== undefined) {
      checkedOf.set(this, options.checked);
    }

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
   * @param input - The value to check.
   * @returns `{ ok: true, value }` with the value, or `{ ok: false, issues }`.
   *
   * @example
   * ```ts
   * import { n, Uuid } from '@horizon-republic/nominal-types';
   *
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
   * @param input - The value to check.
   * @returns A Promise of the value, rejected with a `NominalError` for a bad value.
   *
   * @example
   * ```ts
   * import { Email, n } from '@horizon-republic/nominal-types';
   *
   * await n.object({ customer: Email }).parseAsync({ customer: 'jane' });
   * // rejects: NominalError: n.object(): customer: must be an email address
   * // (was a string of 4 characters)
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
   * @param input - The value to check.
   * @returns `true` when `parse()` would accept the input.
   *
   * @example
   * ```ts
   * import { n, Uuid } from '@horizon-republic/nominal-types';
   *
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
   * @param value - A value this schema gave, such as the `value` of a successful `parse()`.
   * @returns A new value with plain values in place of the instances.
   *
   * @example
   * ```ts
   * import { n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
   *
   * declare const body: unknown;
   *
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
   * @param value - A value this schema gave, such as the `value` of a successful `parse()`.
   * @returns The JSON text.
   * @throws {@link TypeError} when JSON has no text for the value, such as `undefined`.
   *
   * @example
   * ```ts
   * import { n, PositiveInteger, Uuid } from '@horizon-republic/nominal-types';
   *
   * declare const body: unknown;
   *
   * const Order = n.object({ id: Uuid, quantity: PositiveInteger });
   * const order = Order.parse(body);
   *
   * if (order.ok) Order.stringify(order.value); // '{"id":"0190f1c2-…","quantity":2}'
   * ```
   */
  public stringify(value: Output): string {
    // @throws {@link TypeError} the stringifier refuses a value JSON has no text for
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
   * @param options - Limits on the number of items, and whether items must be unique.
   * @returns A new schema for an array of this schema's values.
   * @throws {@link TypeError} when the counts are not whole numbers from 0 up, `length` is mixed
   * with `min` or `max`, `min` is above `max`, or `unique` is not a boolean.
   *
   * @example
   * ```ts
   * import { n, Url, Uuid } from '@horizon-republic/nominal-types';
   *
   * n.of(Url).array({ max: 10 });
   * n.of(Uuid).array({ length: 3 });
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
   * This schema with rules that read the whole value and report any number of issues, for
   * problems found across items, such as a SKU used in two rows of an import.
   *
   * @remarks
   * The rules run in the order given, only when the value passed this schema, so they read
   * instances. Every rule runs, unless the issues reach the most one check reports
   * (`n.configure({ maxIssues })`). The JSON Schema stays the same.
   *
   * @param rules - Rules built by `n.rule()`, or checks written in place.
   * @returns A new schema that also runs the rules.
   * @throws {@link TypeError} when a rule is neither built by `n.rule()` nor a function.
   *
   * @example
   * ```ts
   * import { n, Uuid } from '@horizon-republic/nominal-types';
   *
   * const Ids = n.of(Uuid).array().check((ids, report) => {
   *   if (ids.length % 2 === 1) report({ code: 'odd_count', message: 'must have pairs of ids' });
   * });
   * ```
   */
  public check(
    ...rules: ReadonlyArray<Rule<Output> | RuleCheck<Output>>
  ): TypeSchema<Input, Output> {
    // The map holds what this schema was built from, of its own Output.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const before = checkedOf.get(this) as Checked<Output> | undefined;
    const checked: Checked<Output> = {
      parts: before?.parts ?? this.#settled(),
      rules: [...(before?.rules ?? []), ...rules.map((each) => ruleOf(each))],
    };

    return new TypeSchema(withRules(checked.parts, checked.rules), {
      array: isArraySchema(this),
      name: this.#name,
      checked,
    });
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
   * @returns A new schema that also takes the value as text.
   * @throws {@link TypeError} when called after another method, or for a type with no text form,
   * such as one declared from scratch with `Nominal()`.
   *
   * @example
   * ```ts
   * import { n, Port, PositiveInteger } from '@horizon-republic/nominal-types';
   *
   * n.of(Port).fromString().parse(process.env['PORT']);
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
   *
   * @returns A new schema that also accepts `undefined`.
   *
   * @example
   * ```ts
   * import { n, Uuid } from '@horizon-republic/nominal-types';
   *
   * n.of(Uuid).optional().parse(undefined); // { ok: true, value: undefined }
   * ```
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
   *
   * @returns A new schema that also accepts `null`.
   *
   * @example
   * ```ts
   * import { n, Uuid } from '@horizon-republic/nominal-types';
   *
   * n.of(Uuid).nullable().parse(null); // { ok: true, value: null }
   * ```
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
