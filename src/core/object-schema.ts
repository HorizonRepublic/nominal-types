import type { BuiltParts } from './built-parts.ts';
import { checkConstraintFields } from './constraint-fields.ts';
import type { AnyConstraint } from './constraint-types.ts';
import { objectPaths } from './fast-paths.ts';
import {
  checkedKeys,
  constraintKeys,
  fieldsOf,
  gatedConstraints,
  hidingValues,
  keptPresence,
  noPresence,
  objectParts,
  textFields,
  withPresence,
} from './object-helpers.ts';
import type { ObjectParts, Presence } from './object-helpers.ts';
import { objectMembers } from './object-members.ts';
import { objectMark, objectMembersSlot } from './object-rule.ts';
import { objectShape } from './object-shape.ts';
import type { ObjectField } from './object-shape.ts';
import type {
  Extended,
  FieldKey,
  Loosened,
  LoosenedValue,
  ObjectFields,
  ObjectInput,
  ObjectValue,
  Omitted,
  Picked,
  TextInput,
  Tightened,
} from './object-types.ts';
import { TypeSchema } from './type-schema.ts';

export type { ObjectFields, ObjectInput, ObjectValue, TextInput } from './object-types.ts';

/**
 * An object made of fields, each checked by its own schema: what `n.object()` returns.
 *
 * @remarks
 * It is a `TypeSchema`, so `array()`, `optional()` and `nullable()` build on it, and a nominal type
 * takes it as its rule.
 */
export class ObjectSchema<Input, Output> extends TypeSchema<Input, Output> {
  /**
   * The names of the fields, in the order they were declared.
   */
  public readonly keys: readonly string[];
  readonly #source: ObjectFields;
  readonly #constraints: readonly AnyConstraint[];
  readonly #strict: boolean;
  readonly #hidden: boolean;
  readonly #presence: Presence;

  /**
   * Internal: built by `n.object()` and the methods below; `hidden` leaves the values out of the
   * messages, `presence` makes fields optional (`true`) or required (`false`); `deferred` builds
   * the checks at the first use, for the objects of built-in types.
   */
  public constructor(
    source: ObjectFields,
    constraints: readonly AnyConstraint[],
    strict: boolean,
    hidden: boolean = false,
    presence: Presence = noPresence,
    deferred: boolean = false,
  ) {
    const build = (fields: readonly ObjectField[]): BuiltParts<never> => {
      const effective = gatedConstraints(constraints, presence);
      const shape = objectShape(fields, effective, strict);
      const ownShape = hidden ? hidingValues(shape) : shape;
      const paths = objectPaths(fields, source, {
        strict,
        constraints: effective,
        run: ownShape.run,
      });

      // The shape returns a new object of the fields, which is what Output describes.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return { shape: ownShape as never, paths };
    };

    const keys = Object.keys(source);

    checkConstraintFields('n.object', keys, constraints);

    super(deferred ? () => build(fieldsOf(source, presence)) : build(fieldsOf(source, presence)), {
      name: 'n.object()',
    });

    this.keys = keys;
    this.#source = source;
    this.#constraints = constraints;
    this.#strict = strict;
    this.#hidden = hidden;
    this.#presence = presence;
    objectParts.set(this, { source, constraints, strict, hidden, presence });
    Object.defineProperty(this, objectMark, { value: true });
    Object.defineProperty(this, objectMembersSlot, { value: objectMembers });
  }

  /**
   * This schema, refusing keys it doesn't declare instead of dropping them.
   */
  public strict(): ObjectSchema<Input, Output> {
    return this.#with({ strict: true });
  }

  /**
   * This schema, reading each field of a nominal type with a text form from a string: numbers,
   * booleans, big integers and strings. For configuration read from environment variables, and
   * any other record of strings, such as query parameters.
   *
   * @remarks
   * Fields of other kinds, such as `n.of()` and `n.object()` schemas, are kept as they are;
   * give them `fromString()` yourself where they read text. Undeclared keys are dropped, so the
   * whole `process.env` can be passed. Messages leave the values out, as those of a sensitive type
   * do, since configuration holds secrets: `must be a URL (was a string of 31 characters)`.
   *
   * @example
   * ```ts
   * export class Config extends Nominal(
   *   'app.Config',
   *   n.object({ PORT: Port, DEBUG: AnyBoolean, DATABASE_URL: Url }).fromEnv(),
   * ) {}
   *
   * export const config = new Config(process.env);
   * config.PORT; // Port, from the text '3000'
   * ```
   */
  public fromEnv(): ObjectSchema<TextInput<Input>, Output> {
    return this.#with({ source: textFields(this.#source), hidden: true });
  }

  /**
   * This schema with every field, or the fields named, allowed to be missing: for a PATCH body
   * that changes only the fields it sends.
   *
   * @remarks
   * A field given as `undefined` counts as missing. A constraint that reads such a field runs only
   * when every one of those fields is present.
   *
   * @throws TypeError for a name the object doesn't declare.
   *
   * @example
   * ```ts
   * const UpdateOrder = CreateOrder.partial();
   * const UpdateNote = CreateOrder.partial('note', 'quantity');
   * ```
   */
  public partial(): ObjectSchema<Loosened<Input>, LoosenedValue<Output>>;
  public partial<const Key extends FieldKey<Output>>(
    ...keys: readonly [Key, ...Key[]]
  ): ObjectSchema<Loosened<Input, Key>, LoosenedValue<Output, Key>>;
  public partial(...keys: readonly string[]): ObjectSchema<unknown, unknown> {
    return this.#withPresence('partial', keys, true);
  }

  /**
   * This schema with every field, or the fields named, required, also those whose schema accepts
   * `undefined`: the reverse of `partial()`.
   *
   * @throws TypeError for a name the object doesn't declare.
   *
   * @example
   * ```ts
   * const CreateOrderWithNote = CreateOrder.required('note');
   * ```
   */
  public required(): ObjectSchema<Tightened<Input>, Tightened<Output>>;
  public required<const Key extends FieldKey<Output>>(
    ...keys: readonly [Key, ...Key[]]
  ): ObjectSchema<Tightened<Input, Key>, Tightened<Output, Key>>;
  public required(...keys: readonly string[]): ObjectSchema<unknown, unknown> {
    return this.#withPresence('required', keys, false);
  }

  /**
   * This schema with only the fields named, for a request that sends part of an object.
   *
   * @remarks
   * A constraint is kept when every field it reads is kept, and dropped otherwise.
   *
   * @throws TypeError for no name, or a name the object doesn't declare.
   *
   * @example
   * ```ts
   * const OrderContact = CreateOrder.pick('customer', 'note');
   * ```
   */
  public pick<const Key extends FieldKey<Output>>(
    ...keys: readonly [Key, ...Key[]]
  ): ObjectSchema<Picked<Input, Key>, Picked<Output, Key>> {
    return this.#keeping(checkedKeys('pick', this.keys, keys, true));
  }

  /**
   * This schema without the fields named, such as a field the server fills in itself.
   *
   * @remarks
   * A constraint is kept when every field it reads is kept, and dropped otherwise.
   *
   * @throws TypeError for no name, or a name the object doesn't declare.
   *
   * @example
   * ```ts
   * const OrderLine = CreateOrder.omit('customer');
   * ```
   */
  public omit<const Key extends FieldKey<Output>>(
    ...keys: readonly [Key, ...Key[]]
  ): ObjectSchema<Omitted<Input, Key>, Omitted<Output, Key>> {
    const left = checkedKeys('omit', this.keys, keys, true);

    return this.#keeping(new Set(this.keys.filter((key) => !left.has(key))));
  }

  /**
   * This schema with more fields, a field of the same name replaced, for an object that builds on
   * another.
   *
   * @remarks
   * The constraints are kept; one that reads a replaced field checks it with its own field type,
   * as before. On a schema from `fromEnv()`, the new fields are read from strings too.
   *
   * @throws TypeError for a field named `__proto__`.
   *
   * @example
   * ```ts
   * const CreateGift = CreateOrder.extend({ recipient: Email });
   * ```
   */
  public extend<const Fields extends ObjectFields>(
    fields: Fields,
  ): ObjectSchema<Extended<Input, ObjectInput<Fields>>, Extended<Output, ObjectValue<Fields>>> {
    const kept = new Set(this.keys.filter((key) => !Object.hasOwn(fields, key)));

    return this.#with({
      source: { ...this.#source, ...(this.#hidden ? textFields(fields) : fields) },
      presence: keptPresence(this.#presence, kept),
    });
  }

  #withPresence(
    method: string,
    keys: readonly string[],
    optional: boolean,
  ): ObjectSchema<never, never> {
    const named =
      keys.length === 0 ? new Set(this.keys) : checkedKeys(method, this.keys, keys, false);

    return this.#with({ presence: withPresence(this.#presence, named, optional) });
  }

  #keeping(keys: ReadonlySet<string>): ObjectSchema<never, never> {
    return this.#with({
      source: Object.fromEntries(Object.entries(this.#source).filter(([key]) => keys.has(key))),
      constraints: this.#constraints.filter((rule) =>
        constraintKeys(rule).every((key) => keys.has(key)),
      ),
      presence: keptPresence(this.#presence, keys),
    });
  }

  #with(changes: Partial<ObjectParts>): ObjectSchema<never, never> {
    const { source, constraints, strict, hidden, presence }: ObjectParts = {
      source: this.#source,
      constraints: this.#constraints,
      strict: this.#strict,
      hidden: this.#hidden,
      presence: this.#presence,
      ...changes,
    };

    return new ObjectSchema(source, constraints, strict, hidden, presence);
  }
}
