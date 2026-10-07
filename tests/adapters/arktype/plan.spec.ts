import type { StandardSchemaV1 } from '@standard-schema/spec';
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import { toArk, fromArk, constrainArk } from '../../../src/adapters/arktype/index.ts';
import { describeArk } from '../../../src/adapters/arktype/json.ts';
import { planOf } from '../../../src/adapters/arktype/plan.ts';
import { constraint, Email, PositiveInteger, Uuid } from '../../../src/index.ts';
import { issuesOf } from '../../support/results.ts';

const leaf = toArk(Uuid).json;

const fakeMeta = { description: 'fake', 'x-nominal-type': 'NoSuchType' };

const planFor = (node: unknown): NonNullable<ReturnType<typeof planOf>> => {
  const plan = planOf(node);

  if (plan === undefined) {
    throw new Error('expected a plan');
  }

  return plan;
};

const verifyAll = (node: unknown, value: unknown): StandardSchemaV1.Issue[] => {
  const issues: StandardSchemaV1.Issue[] = [];

  planFor(node).verify?.(value, [], issues);

  return issues;
};

const problemOf = (node: { readonly meta: object }, data: unknown): unknown => {
  const problem: unknown = Reflect.get(node.meta, 'problem');

  return typeof problem === 'function' ? Reflect.apply(problem, undefined, [{ data }]) : undefined;
};

const positive = constraint({ count: PositiveInteger }, () => false, { message: 'never' });
const Counted = constrainArk(type({ count: toArk(PositiveInteger) }), positive);

describe('plan internals', () => {
  it('leaves a value of the wrong kind as it is', () => {
    expect(planFor(type({ id: toArk(Uuid) }).json).build('x')).toBe('x');
    expect(planFor(toArk(Uuid).array().json).build('x')).toBe('x');
  });

  it('verifies nothing in a value of the wrong kind', () => {
    expect(verifyAll(type({ inner: Counted }).json, 'x')).toStrictEqual([]);
    expect(verifyAll(Counted.array().json, 'x')).toStrictEqual([]);
    expect(verifyAll(Counted.json, null)).toStrictEqual([]);
  });

  it('runs field constraints and its own on one object', () => {
    const Outer = constrainArk(type({ inner: Counted }), positive);

    expect(issuesOf(fromArk(Outer).parse({ inner: { count: 1 } }))).toStrictEqual([
      { message: 'never', path: ['inner'] },
      { message: 'must be a number (was undefined)', path: ['count'] },
    ]);
  });

  it('throws for an id no constraint was registered under', () => {
    expect(() =>
      planOf({ required: [], domain: 'object', meta: { 'x-nominal-constraints': 'c0' } }),
    ).toThrow(new TypeError('fromArk: constraint c0 is unknown'));
  });

  it('throws for an toArk() node inside a node it does not know', () => {
    expect(() => planOf({ intersection: [leaf] })).toThrow(TypeError);
  });

  it('throws for a union branch it cannot match', () => {
    expect(() => planOf([{ sequence: leaf }, { unit: null }])).toThrow(TypeError);
  });

  it('throws for a union branch naming a type no toArk() gave', () => {
    const fake = { meta: { 'x-nominal-type': 'NoSuchType' } };

    expect(() => planOf([fake, { unit: null }])).toThrow(
      new TypeError('fromArk: no type named NoSuchType was given to toArk()'),
    );
  });

  it('throws when describing a type name no toArk() gave', () => {
    const fake = type({ a: type('string').configure(fakeMeta) });

    expect(() => describeArk(fake, 'input', { target: 'draft-07' })).toThrow(
      new TypeError('fromArk: no type named NoSuchType was given to toArk()'),
    );
  });

  it('keeps an anyOf without null for OpenAPI', () => {
    const schema = fromArk(type({ to: toArk(Email).or(toArk(Uuid)) }));

    expect(schema['~standard'].jsonSchema.input({ target: 'openapi-3.0' })).toMatchObject({
      properties: { to: { anyOf: [{ title: 'nominal.Email' }, { title: 'nominal.Uuid' }] } },
    });
  });

  it('builds the message of a value the type accepts as its name', () => {
    expect(problemOf(toArk(Uuid), '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f')).toBe(
      'must be nominal.Uuid',
    );
  });
});
