import * as v from 'valibot';

import { checkConstraintFields } from '../../core/constraint-fields.ts';
import type { AnyConstraint } from '../../core/constraint-types.ts';
import type { StandardSchemaV1 } from '../../core/standard-spec.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const pathItems = (
  root: unknown,
  path: StandardSchemaV1.Issue['path'],
): [v.IssuePathItem, ...v.IssuePathItem[]] | undefined => {
  const items: v.IssuePathItem[] = [];
  let input = root;

  for (const segment of path ?? []) {
    const key = String(typeof segment === 'object' ? segment.key : segment);
    const value: unknown = isRecord(input) ? input[key] : undefined;

    items.push({
      type: 'object',
      origin: 'value',
      input: isRecord(input) ? input : {},
      key,
      value,
    });
    input = value;
  }

  const [first, ...rest] = items;

  return first === undefined ? undefined : [first, ...rest];
};

/**
 * Attaches constraints to a Valibot object, so they run on it wherever it sits, once every field
 * of it is valid.
 *
 * @remarks
 * The constraints see the object Valibot gives, with `toValibot()` fields as instances, and add
 * their issues with paths from this object.
 *
 * @typeParam Schema - The Valibot object schema the constraints check.
 * @param object - The Valibot object to check.
 * @param constraints - The constraints to run on the object, made with `n.constraint()`.
 * @returns A Valibot schema that runs the object, then the constraints.
 * @throws {@link TypeError} when a constraint reads a field the object does not declare, and the
 * object drops or refuses undeclared keys.
 *
 * @example
 * ```ts
 * import { n, PositiveInteger } from '@horizon-republic/nominal-types';
 * import { constrainValibot, toValibot } from '@horizon-republic/nominal-types/adapters/valibot';
 * import * as v from 'valibot';
 *
 * const withinCapacity = n.constraint(
 *   { guests: PositiveInteger, capacity: PositiveInteger },
 *   ({ guests, capacity }) => guests <= capacity || 'must not exceed the capacity',
 *   { path: 'guests' },
 * );
 *
 * const Stay = constrainValibot(
 *   v.object({ guests: toValibot(PositiveInteger), capacity: toValibot(PositiveInteger) }),
 *   withinCapacity,
 * );
 * ```
 *
 * @see {@link toValibot}
 */
export const constrainValibot = <
  Schema extends v.BaseSchema<unknown, Record<string, unknown>, v.BaseIssue<unknown>>,
>(
  object: Schema,
  ...constraints: AnyConstraint[]
): v.SchemaWithPipe<readonly [Schema, v.RawCheckAction<v.InferOutput<Schema>>]> => {
  const entries: unknown = Reflect.get(object, 'entries');

  // An object that drops or refuses undeclared keys never hands them to a constraint.
  if (
    (object.type === 'object' || object.type === 'strict_object') &&
    typeof entries === 'object' &&
    entries !== null
  ) {
    checkConstraintFields('constrainValibot', Object.keys(entries), constraints);
  }

  return v.pipe(
    object,
    v.rawCheck(({ dataset, addIssue }) => {
      if (!dataset.typed) {
        return;
      }

      for (const constraint of constraints) {
        for (const issue of constraint.issuesOf(dataset.value)) {
          const path = pathItems(dataset.value, issue.path);

          addIssue({ message: issue.message, ...(path === undefined ? {} : { path }) });
        }
      }
    }),
  );
};
