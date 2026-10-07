import { describe, expect, it } from 'vitest';

import { AnyBoolean } from '../../../src/index.ts';
import { issuesOf } from '../../support/results.ts';

describe('AnyBoolean', () => {
  it.each([true, false])('accepts %s', (flag) => {
    expect(new AnyBoolean(flag).value).toBe(flag);
  });

  it.each([0, 1, 'true', '', null, undefined, new Object(false), [true]])('rejects %s', (input) => {
    expect(issuesOf(AnyBoolean.parse(input))).toHaveLength(1);
  });

  it('reports the value it got', () => {
    expect(issuesOf(AnyBoolean.parse(1))).toStrictEqual([{ message: 'must be a boolean (was 1)' }]);
  });

  it('describes itself as a boolean', () => {
    expect(AnyBoolean['~standard'].jsonSchema.input({ target: 'openapi-3.0' })).toStrictEqual({
      type: 'boolean',
      description: 'a boolean',
    });
  });

  it('brands a flag with a meaning of its own', () => {
    class Consent extends AnyBoolean.subtype('Consent') {}

    expect(new Consent(true)).toBeInstanceOf(AnyBoolean);
    expect(new AnyBoolean(true)).not.toBeInstanceOf(Consent);
  });
});
