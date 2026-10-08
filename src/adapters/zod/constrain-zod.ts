import type { z } from 'zod';

import { checkConstraintFields } from '../../core/constraint-fields.ts';
import type { AnyConstraint } from '../../core/constraint-types.ts';
import { plainPath } from '../issue-path.ts';

/**
 * Attaches constraints to a Zod object, so they run on it wherever it sits, once every field of it
 * is valid.
 *
 * @remarks
 * The constraints see the object Zod gives, with `toZod()` fields as instances, and add their
 * issues with paths from this object.
 *
 * @typeParam Shape - The Zod object the constraints check.
 * @param object - The Zod object to check.
 * @param constraints - The constraints to run on the object, made with `n.constraint()`.
 * @returns The same Zod object with the constraints attached.
 * @throws {@link TypeError} when a constraint reads a field the object does not declare, and the
 * object drops or refuses undeclared keys.
 *
 * @example
 * ```ts
 * import { n, PositiveInteger } from '@horizon-republic/nominal-types';
 * import { constrainZod, toZod } from '@horizon-republic/nominal-types/adapters/zod';
 * import { z } from 'zod';
 *
 * const withinCapacity = n.constraint(
 *   { guests: PositiveInteger, capacity: PositiveInteger },
 *   ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
 *   { path: 'guests' },
 * );
 *
 * const Stay = constrainZod(
 *   z.object({ guests: toZod(PositiveInteger), capacity: toZod(PositiveInteger) }),
 *   withinCapacity,
 * );
 * ```
 *
 * @see {@link toZod}
 */
export const constrainZod = <Shape extends z.ZodObject>(
  object: Shape,
  ...constraints: AnyConstraint[]
): Shape => {
  const catchall: unknown = Reflect.get(object.def, 'catchall');
  const rest: unknown =
    typeof catchall === 'object' && catchall !== null
      ? Reflect.get(Reflect.get(catchall, 'def') ?? {}, 'type')
      : undefined;

  // An object that drops or refuses undeclared keys never hands them to a constraint.
  if (catchall === undefined || rest === 'never') {
    checkConstraintFields('constrainZod', Object.keys(object.shape), constraints);
  }

  return object.superRefine((value, context) => {
    for (const constraint of constraints) {
      for (const issue of constraint.issuesOf(value)) {
        context.addIssue({
          code: 'custom',
          message: issue.message,
          ...(issue.path === undefined ? {} : { path: plainPath(issue.path) }),
        });
      }
    }
  });
};
