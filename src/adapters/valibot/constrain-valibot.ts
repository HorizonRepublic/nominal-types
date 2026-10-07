import type { StandardSchemaV1 } from '@standard-schema/spec';
import * as v from 'valibot';

import { checkConstraintFields } from '../../core/constraint-fields.ts';
import type { AnyConstraint } from '../../core/constraint-types.ts';

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
 * @example
 * ```ts
 * const Stay = constrainValibot(
 *   v.object({ guests: toValibot(PositiveInteger), capacity: toValibot(PositiveInteger) }),
 *   withinCapacity,
 * );
 * ```
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
