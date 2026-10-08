import type { AnyNominalType, InputOf } from './contracts.ts';
import { typePaths } from './fast-paths.ts';
import { sensitiveSlot } from './hierarchy.ts';
import { withoutUri } from './json-target.ts';
import { describeValue } from './messages.ts';
import { isNominalType, ownTypes } from './nominal.ts';
import type { Rejection } from './rejection.ts';
import { textFormOf } from './text-form.ts';
import { constructorFor } from './type-functions.ts';
import { TypeSchema } from './type-schema.ts';

/**
 * A nominal type as a plain Standard Schema object, to pass where a class doesn't fit and to
 * build arrays and optional values from.
 *
 * @remarks
 * Libraries that parse their own definitions, such as ArkType, treat a class as one of their own
 * constructs, so they take this object instead. The same object goes to `NominalPipe` and to
 * NestJS's `{ schema }`.
 *
 * @throws TypeError when `type` is not a nominal type.
 *
 * @example
 * ```ts
 * type({ email: n.of(Email), team: n.of(Uuid) });
 * n.of(Uuid).array({ min: 1, max: 100 });
 * n.of(Email).optional();
 * ```
 */
export const schemaOf = <Type extends AnyNominalType>(
  type: Type,
): TypeSchema<InputOf<Type['rule']>, Type['prototype']> => {
  if (!isNominalType(type)) {
    throw new TypeError(`n.of() takes a nominal type (was ${describeValue(type)})`);
  }

  const construct = constructorFor(type);

  return new TypeSchema<InputOf<Type['rule']>, Type['prototype']>(
    {
      // The function makes an instance of `type` or a Rejection; the compiler can't follow the
      // class hierarchy that far, and parse() would allocate a result object per value.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      run: construct as (input: unknown) => Type['prototype'] | Rejection,
      describe: (side, options) => withoutUri(type['~standard'].jsonSchema[side](options)),
      // A type from another copy of the package keeps whether it is sensitive to itself.
      sensitive: !ownTypes.isOwn(type) || Reflect.get(type, sensitiveSlot) === true,
    },
    { textForm: textFormOf(type), paths: typePaths(type) },
  );
};
