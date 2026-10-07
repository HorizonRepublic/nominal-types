import type { z } from 'zod';

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
): Shape =>
  object.superRefine((value, context) => {
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
