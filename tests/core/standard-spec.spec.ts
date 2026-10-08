import type * as published from '@standard-schema/spec';
import { describe, expectTypeOf, it } from 'vitest';

import type * as copied from '../../src/core/standard-spec.ts';

// The package carries its own copy of the spec's interfaces; these checks fail when the copy
// and the published spec stop being the same types.
describe('the copied Standard Schema interfaces', () => {
  it('are the published Standard Schema interfaces', () => {
    expectTypeOf<copied.StandardSchemaV1<string, number>>().toEqualTypeOf<
      published.StandardSchemaV1<string, number>
    >();
    expectTypeOf<copied.StandardSchemaV1.Issue>().toEqualTypeOf<published.StandardSchemaV1.Issue>();
    expectTypeOf<copied.StandardSchemaV1.Result<number>>().toEqualTypeOf<
      published.StandardSchemaV1.Result<number>
    >();
  });

  it('are the published Standard JSON Schema interfaces', () => {
    expectTypeOf<copied.StandardJSONSchemaV1<string, number>>().toEqualTypeOf<
      published.StandardJSONSchemaV1<string, number>
    >();
    expectTypeOf<copied.StandardJSONSchemaV1.Options>().toEqualTypeOf<published.StandardJSONSchemaV1.Options>();
  });

  it('are the published Standard Typed interfaces', () => {
    expectTypeOf<copied.StandardTypedV1<string, number>>().toEqualTypeOf<
      published.StandardTypedV1<string, number>
    >();
  });
});
