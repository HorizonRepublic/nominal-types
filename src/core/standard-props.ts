import { Rejection } from './rejection.ts';
import type { StandardProps } from './standard-schema.ts';
import type { StandardJSONSchemaV1 } from './standard-spec.ts';

export type { StandardProps } from './standard-schema.ts';

/**
 * Internal: the vendor every schema of this package names in its `~standard`, which is also how
 * another copy of the package is recognised.
 */
export const vendor = '@horizon-republic/nominal-types';

/**
 * Internal: runs a schema, returning the accepted value itself or a `Rejection`.
 */
export type Run<Output> = (input: unknown) => Output | Rejection;

/**
 * Internal: describes a schema as JSON Schema for one side and target.
 */
export type Describe = (
  side: 'input' | 'output',
  options: StandardJSONSchemaV1.Options,
) => Record<string, unknown>;

/**
 * Internal: the `~standard` property of a schema, built from how it runs and how it describes
 * itself.
 */
export const standardProps = <Input, Output>(
  run: Run<Output>,
  describe: Describe,
): StandardProps<Input, Output> => ({
  version: 1,
  vendor,
  validate: (value) => {
    const result = run(value);

    return result instanceof Rejection ? { issues: result.issues } : { value: result };
  },
  jsonSchema: {
    input: (options) => describe('input', options),
    output: (options) => describe('output', options),
  },
});
