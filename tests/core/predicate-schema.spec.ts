import { describe, expect, it } from 'vitest';

import { Nominal, NominalError, PredicateSchema, satisfying } from '../../src/index.ts';
import { issuesOf, outputOf, valueOf } from '../support/results.ts';

const isEven = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value % 2 === 0;

class EvenNumber extends Nominal(
  'PredicateEven',
  satisfying(isEven, 'an even number', { type: 'integer', multipleOf: 2 }),
) {}

const isSmall = (value: unknown): value is number => typeof value === 'number' && value < 10;

class Opaque extends Nominal('PredicateOpaque', satisfying(isEven, 'an even number')) {}

describe('PredicateSchema', () => {
  it('throws for a value the guard refuses', () => {
    expect(() => new EvenNumber(3)).toThrow(NominalError);
  });

  it('builds an instance for a value the guard approves', () => {
    expect(new EvenNumber(4).value).toBe(4);
    expect(EvenNumber.rule).toBeInstanceOf(PredicateSchema);
  });

  it.each([3, 2.5, Number.NaN, '4', null, undefined, Number.POSITIVE_INFINITY])(
    'rejects %j',
    (input) => {
      expect(EvenNumber.parse(input).ok).toBe(false);
      expect(issuesOf(EvenNumber.parse(input))).toHaveLength(1);
    },
  );

  it.each([
    [3, 'must be an even number (was 3)'],
    ['4', 'must be an even number (was "4")'],
    [null, 'must be an even number (was null)'],
  ])('reports %j in words', (input, message) => {
    expect(issuesOf(EvenNumber.parse(input))).toStrictEqual([{ message }]);
  });

  it('validates on its own as a Standard Schema', () => {
    const schema = satisfying(isEven, 'an even number');

    expect(outputOf(schema['~standard'].validate(8))).toBe(8);
    expect(schema['~standard'].validate(7).issues).toHaveLength(1);
  });

  it('validates to an instance through the type', () => {
    expect(outputOf(EvenNumber['~standard'].validate(6))).toBeInstanceOf(EvenNumber);
  });

  describe('JSON Schema', () => {
    it.each([
      ['draft-2020-12', { $schema: 'https://json-schema.org/draft/2020-12/schema' }],
      ['draft-07', { $schema: 'http://json-schema.org/draft-07/schema#' }],
      ['openapi-3.0', {}],
    ])('describes the guard for %s', (target, header) => {
      expect(EvenNumber['~standard'].jsonSchema.input({ target })).toStrictEqual({
        ...header,
        title: 'PredicateEven',
        type: 'integer',
        multipleOf: 2,
        description: 'an even number',
      });
    });

    it('takes its description from the schema rather than the body', () => {
      const schema = satisfying(isEven, 'an even number', { description: 'something else' });

      expect(schema['~standard'].jsonSchema.output({ target: 'openapi-3.0' })).toStrictEqual({
        description: 'an even number',
      });
    });

    it('refuses to describe itself without a body', () => {
      expect(() => Opaque['~standard'].jsonSchema.input({ target: 'draft-07' })).toThrow(
        /cannot describe itself as JSON Schema/u,
      );
    });

    it('refuses a target it does not know', () => {
      expect(() => EvenNumber['~standard'].jsonSchema.input({ target: 'draft-04' })).toThrow(
        /draft-04 is not supported/u,
      );
    });
  });

  it('constrains a subtype', () => {
    class SmallEven extends EvenNumber.subtype(
      'PredicateSmallEven',
      satisfying(isSmall, 'below 10'),
    ) {}

    expect(valueOf(SmallEven.parse(new EvenNumber(4)))).toBeInstanceOf(SmallEven);
    expect(issuesOf(SmallEven.parse(12))).toStrictEqual([{ message: 'must be below 10 (was 12)' }]);
  });
});
