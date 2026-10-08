import { describe, expect, it } from 'vitest';

import { constraint, isConstraint } from '../../src/core/constraint.ts';
import { hideValues } from '../../src/core/hidden-values.ts';
import { isNominalType } from '../../src/core/nominal.ts';
import { isObjectSchema, objectOf } from '../../src/core/object-schema.ts';
import { oneOf } from '../../src/core/one-of.ts';
import { matching } from '../../src/core/pattern-schema.ts';
import { satisfying } from '../../src/core/predicate-schema.ts';
import { schemaOf } from '../../src/core/type-schema.ts';
import * as library from '../../src/index.ts';

const members = {
  constraint,
  hideValues,
  isConstraint,
  isObject: isObjectSchema,
  isType: isNominalType,
  matching,
  object: objectOf,
  of: schemaOf,
  oneOf,
  satisfying,
};

describe('n', () => {
  it('holds exactly the functions that build schemas, rules and checks', () => {
    expect(Object.keys(library.n).toSorted()).toStrictEqual(Object.keys(members).toSorted());
  });

  it.each(Object.entries(members))('n.%s is the function itself', (name, member) => {
    expect(Reflect.get(library.n, name)).toBe(member);
  });

  it.each([
    'constraint',
    'hideValues',
    'isConstraint',
    'isNominalType',
    'isObjectSchema',
    'matching',
    'objectOf',
    'oneOf',
    'satisfying',
    'schemaOf',
  ])('leaves %s out of the root exports', (name) => {
    expect(Object.keys(library)).not.toContain(name);
  });

  it('keeps the classes at the root', () => {
    expect(library.ObjectSchema).toBeTypeOf('function');
    expect(library.TypeSchema).toBeTypeOf('function');
    expect(library.Constraint).toBeTypeOf('function');
    expect(library.PatternSchema).toBeTypeOf('function');
    expect(library.PredicateSchema).toBeTypeOf('function');
    expect(library.OneOfSchema).toBeTypeOf('function');
  });
});
