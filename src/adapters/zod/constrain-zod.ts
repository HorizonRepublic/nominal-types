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
 * @example
 * ```ts
 * const Stay = constrainZod(
 *   z.object({ guests: toZod(PositiveInteger), capacity: toZod(PositiveInteger) }),
 *   withinCapacity,
 * );
 * ```
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
