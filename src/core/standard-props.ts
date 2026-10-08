import { Rejection } from './rejection.ts';
import type { StandardProps } from './standard-schema.ts';
import type { StandardJSONSchemaV1 } from './standard-spec.ts';

export type { StandardProps } from './standard-schema.ts';

/**
 * The vendor every schema of this package names in its `~standard`, which is also how
 * another copy of the package is recognised.
 *
 * @internal
 */
export const vendor = '@horizon-republic/nominal-types';

/**
 * Whether a schema names this package as its vendor, also one from another copy.
 *
 * @internal
 */
export const isOwnVendor = (schema: object): boolean =>
  Reflect.get(Reflect.get(schema, '~standard') ?? {}, 'vendor') === vendor;

/**
 * Runs a schema, returning the accepted value itself or a `Rejection`.
 *
 * @internal
 */
export type Run<Output> = (input: unknown) => Output | Rejection;

/**
 * Describes a schema as JSON Schema for one side and target.
 *
 * @internal
 */
export type Describe = (
  side: 'input' | 'output',
  options: StandardJSONSchemaV1.Options,
) => Record<string, unknown>;

/**
 * The `~standard` property of a schema, built from how it runs and how it describes
 * itself.
 *
 * @internal
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
