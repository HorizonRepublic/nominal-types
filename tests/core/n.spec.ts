// Every member of `n` is imported from its own module, to compare them one by one.
/* oxlint-disable import/max-dependencies */
import { describe, expect, it } from 'vitest';

import { configure } from '../../src/core/configure.ts';
import { constraint, isConstraint } from '../../src/core/constraint.ts';
import { hideValues } from '../../src/core/hidden-values.ts';
import { isNominalType } from '../../src/core/nominal.ts';
import { isObjectSchema, objectOf } from '../../src/core/object-of.ts';
import { oneOf } from '../../src/core/one-of.ts';
import { matching } from '../../src/core/pattern-schema.ts';
import { plain } from '../../src/core/plain.ts';
import { satisfying } from '../../src/core/predicate-schema.ts';
import { record } from '../../src/core/record-schema.ts';
import { rule } from '../../src/core/rule.ts';
import { schemaOf } from '../../src/core/schema-of.ts';
import { tuple } from '../../src/core/tuple-schema.ts';
import { union } from '../../src/core/union-schema.ts';
import * as library from '../../src/index.ts';

const members = {
  configure,
  constraint,
  hideValues,
  isConstraint,
  isObject: isObjectSchema,
  isType: isNominalType,
  matching,
  object: objectOf,
  of: schemaOf,
  oneOf,
  plain,
  record,
  rule,
  satisfying,
  tuple,
  union,
};

describe('n', () => {
  it('holds exactly the functions that build schemas, rules and checks', () => {
    expect(Object.keys(library.n).toSorted()).toStrictEqual(Object.keys(members).toSorted());
  });

  it.each(Object.entries(members))('n.%s is the function itself', (name, member) => {
    expect(Reflect.get(library.n, name)).toBe(member);
  });

  it.each([
    'configure',
    'constraint',
    'hideValues',
    'isConstraint',
    'isNominalType',
    'isObjectSchema',
    'matching',
    'objectOf',
    'oneOf',
    'plain',
    'record',
    'rule',
    'satisfying',
    'schemaOf',
    'tuple',
    'union',
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
    expect(library.UnionSchema).toBeTypeOf('function');
    expect(library.RecordSchema).toBeTypeOf('function');
    expect(library.TupleSchema).toBeTypeOf('function');
  });
});
