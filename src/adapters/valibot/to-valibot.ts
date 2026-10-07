import type { StandardSchemaV1 } from '@standard-schema/spec';
import * as v from 'valibot';

import type { AnyNominalType, InputOf } from '../../core/contracts.ts';
import { issueText } from '../../core/issue-text.ts';
import { Rejection } from '../../core/rejection.ts';
import { instanceParserFor } from '../../core/type-functions.ts';

/**
 * The Valibot schema `toValibot()` returns: it takes the type's input and gives an instance.
 */
export type ValibotField<Target extends AnyNominalType> = v.BaseSchema<
  InputOf<Target['rule']>,
  Target['prototype'],
  v.BaseIssue<unknown>
>;

// The schema's own issues carry no path: issues inside a type are written into the message.
const standardIssue = (issue: v.BaseIssue<unknown>): StandardSchemaV1.Issue => ({
  message: issue.message,
});

/**
 * A nominal type as a Valibot schema, for fields of Valibot objects that should come out as
 * instances.
 *
 * @remarks
 * It is a schema of its own rather than a pipe: Valibot runs the type's own check and the type
 * makes the instance in one step, with the type's messages. Use Valibot's `v.array()`,
 * `v.optional()` and `v.nullable()` around it.
 *
 * @example
 * ```ts
 * const CreateUser = v.object({ id: toValibot(Uuid), email: toValibot(Email), name: v.string() });
 * ```
 */
export const toValibot = <Target extends AnyNominalType>(target: Target): ValibotField<Target> => {
  const parse = instanceParserFor(target);
  const schema: ValibotField<Target> = {
    kind: 'schema',
    type: 'nominal',
    reference: toValibot,
    expects: target.typeName,
    async: false,
    get '~standard'(): ValibotField<Target>['~standard'] {
      return {
        version: 1,
        vendor: 'valibot',
        validate: (value: unknown) => {
          const result = v.safeParse(schema, value);

          return result.success
            ? { value: result.output }
            : { issues: result.issues.map((issue) => standardIssue(issue)) };
        },
      };
    },
    '~run'(dataset, config) {
      const result = parse(dataset.value);

      if (result instanceof Rejection) {
        // Valibot's own helper for schemas written outside the library; the underscore is its name.
        // oxlint-disable-next-line no-underscore-dangle
        v._addIssue(this, 'type', dataset, config, {
          message: result.issues.map((issue) => issueText(issue)).join('; '),
        });
      } else {
        // Valibot's datasets are written in place; the dataset now holds an instance of `target`.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const accepted = dataset as unknown as { typed: boolean; value: unknown };

        accepted.typed = true;
        accepted.value = result;
      }

      // Valibot's datasets carry the outcome on themselves; the schema hands back the same one.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return dataset as unknown as v.OutputDataset<Target['prototype'], v.BaseIssue<unknown>>;
    },
  };

  return schema;
};
