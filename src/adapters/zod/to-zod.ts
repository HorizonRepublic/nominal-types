import { z } from 'zod';

import type { AnyNominalType, InputOf } from '../../core/contracts.ts';
import { Rejection } from '../../core/rejection.ts';
import { instanceParserFor } from '../../core/type-functions.ts';
import { plainPath } from '../issue-path.ts';
import { typeJsonOf } from '../type-json.ts';

/**
 * The Zod schema `toZod()` returns: it takes the type's input and gives an instance.
 *
 * @typeParam Target - The nominal type the schema parses into.
 *
 * @see {@link toZod}
 */
export type ZodField<Target extends AnyNominalType> = z.ZodType<
  Target['prototype'],
  InputOf<Target['rule']>
>;

/**
 * A nominal type as a Zod schema, for fields of Zod objects that should come out as instances.
 *
 * @remarks
 * The field runs the type's own check and makes the instance in one step, with the type's
 * messages. Its JSON Schema, from `z.toJSONSchema(schema, { io: 'input' })`, is the type's own:
 * pattern, format, limits and examples. Use Zod's `.array()`, `.optional()` and `.nullable()`
 * around it.
 *
 * @typeParam Target - The nominal type the schema parses into.
 * @param target - The nominal type to wrap.
 * @returns A Zod schema that parses the type's input into an instance.
 *
 * @example
 * ```ts
 * import { Email, Uuid } from '@horizon-republic/nominal-types';
 * import { toZod } from '@horizon-republic/nominal-types/adapters/zod';
 * import { z } from 'zod';
 *
 * const CreateUser = z.object({ id: toZod(Uuid), email: toZod(Email), name: z.string() });
 *
 * declare const body: unknown;
 *
 * const user = CreateUser.parse(body);
 * user.email; // an Email instance
 * ```
 *
 * @see {@link constrainZod}
 */
export const toZod = <Target extends AnyNominalType>(target: Target): ZodField<Target> => {
  const parse = instanceParserFor(target);
  const schema = z.unknown().transform((value, context) => {
    const result = parse(value);

    if (!(result instanceof Rejection)) {
      return result;
    }

    for (const issue of result.issues) {
      context.issues.push({
        code: 'custom',
        message: issue.message,
        input: value,
        ...(issue.path === undefined ? {} : { path: plainPath(issue.path) }),
      });
    }

    return z.NEVER;
  });
  const json = typeJsonOf(target);
  const described = json === undefined ? schema : schema.meta(json);

  // The transform returns an instance of `target` for the type's input, which is what the type says.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return described as unknown as ZodField<Target>;
};
