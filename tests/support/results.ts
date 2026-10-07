import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { Parsed } from '../../src/index.ts';

export const thrownBy = (build: () => unknown): unknown => {
  try {
    build();
  } catch (error) {
    return error;
  }

  throw new Error('expected the call to throw');
};

export const valueOf = <Instance>(parsed: Parsed<Instance>): Instance => {
  if (!parsed.ok) {
    throw new Error('expected a parsed value');
  }

  return parsed.value;
};

export const issuesOf = (parsed: Parsed<unknown>): readonly StandardSchemaV1.Issue[] => {
  if (parsed.ok) {
    throw new Error('expected issues');
  }

  return parsed.issues;
};

export const outputOf = <Output>(result: StandardSchemaV1.Result<Output>): Output => {
  if (result.issues !== undefined) {
    throw new Error('expected a value');
  }

  return result.value;
};

export const handWritten = (
  validate: (
    value: unknown,
  ) => StandardSchemaV1.Result<string> | Promise<StandardSchemaV1.Result<string>>,
): StandardSchemaV1<string, string> => ({
  '~standard': { version: 1, vendor: 'hand-written', validate },
});

export const stringOnly = (value: unknown): StandardSchemaV1.Result<string> =>
  typeof value === 'string' ? { value } : { issues: [{ message: 'must be a string' }] };
