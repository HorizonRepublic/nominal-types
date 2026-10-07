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
 */
export interface SuperjsonTransformer<Instance> {
  readonly isApplicable: (value: unknown) => value is Instance;
  readonly serialize: (value: Instance) => SuperjsonValue;
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
 * sent. What arrives is checked by the type; a value it refuses throws a `NominalError`.
 *
 * @example
 * ```ts
 * import superjson from 'superjson';
 *
 * superjson.registerCustom(...toSuperjson(Email));
 * superjson.registerCustom(...toSuperjson(Uuid));
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
