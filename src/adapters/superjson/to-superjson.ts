import type { AnyNominalType } from '../../core/contracts.ts';
import { jsonText } from '../../core/messages.ts';
import { NominalError } from '../../core/nominal-error.ts';
import { Rejection } from '../../core/rejection.ts';
import { instanceParserFor } from '../../core/type-functions.ts';

/**
 * A JSON value, as superjson takes it from a custom transformer.
 */
export type SuperjsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SuperjsonValue[]
  | { [key: string]: SuperjsonValue };

/**
 * A superjson custom transformer for one nominal type.
 *
 * @typeParam Instance - The instances of the type.
 */
export interface SuperjsonTransformer<Instance> {
  /**
   * Tells superjson whether a value is an instance of this very type.
   */
  readonly isApplicable: (value: unknown) => value is Instance;
  /**
   * Writes an instance as its JSON value.
   */
  readonly serialize: (value: Instance) => SuperjsonValue;
  /**
   * Checks a JSON value with the type and makes it an instance again.
   *
   * @throws {@link NominalError} when the type rejects the value.
   */
  readonly deserialize: (value: SuperjsonValue) => Instance;
}

const isPrimitive = (value: unknown): value is SuperjsonValue =>
  value === null ||
  value === undefined ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

const jsonOf = (instance: { readonly value: unknown }): SuperjsonValue => {
  const { value } = instance;

  if (isPrimitive(value)) {
    return value;
  }

  // @throws-ignore jsonText writes plain JSON text
  const parsed: unknown = JSON.parse(jsonText(instance));

  // jsonText writes plain JSON text, and JSON.parse gives back a JSON value.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return typeof value === 'bigint' ? String(value) : (parsed as SuperjsonValue);
};

/**
 * A superjson transformer for a nominal type, and the name to register it under, so instances
 * cross the wire in tRPC, Next.js or Remix and arrive as instances.
 *
 * @remarks
 * Only instances of this very class are taken, not of its subtypes, so register each type that is
 * sent. What arrives is checked by the type; a value it refuses throws a {@link NominalError}.
 *
 * @typeParam Target - The nominal type.
 * @param target - The nominal type whose instances superjson writes and reads.
 * @returns The transformer and the type's name, in the order `superjson.registerCustom()` takes
 * them.
 *
 * @example
 * ```ts
 * import superjson from 'superjson';
 * import { Email, Uuid } from '@horizon-republic/nominal-types';
 * import { toSuperjson } from '@horizon-republic/nominal-types/adapters/superjson';
 *
 * superjson.registerCustom(...toSuperjson(Email));
 * superjson.registerCustom(...toSuperjson(Uuid));
 *
 * const text = superjson.stringify({ contact: new Email('jane@example.com') });
 * const { contact } = superjson.parse<{ contact: Email }>(text);
 * ```
 */
export const toSuperjson = <Target extends AnyNominalType>(
  target: Target,
): [SuperjsonTransformer<Target['prototype']>, string] => {
  const parse = instanceParserFor(target);

  return [
    {
      isApplicable: (value): value is Target['prototype'] =>
        typeof value === 'object' && value !== null && Reflect.get(value, 'constructor') === target,
      serialize: (value) => jsonOf(value),
      deserialize: (value) => {
        const result = parse(value);

        if (result instanceof Rejection) {
          throw new NominalError(target.typeName, result.issues);
        }

        // The parser gave an instance of `target`.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        return result as Target['prototype'];
      },
    },
    target.typeName,
  ];
};
