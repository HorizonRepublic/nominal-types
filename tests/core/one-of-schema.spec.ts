import { describe, expect, expectTypeOf, it } from 'vitest';

import type { OneOfSchema } from '../../src/index.ts';
import { AnyNumber, AnyString, n, Nominal, NominalError } from '../../src/index.ts';
import { satisfiesSchema } from '../support/json-schema.ts';

class OrderStatus extends AnyString.subtype(
  'OneOfSchemaStatus',
  n.oneOf('draft', 'paid', 'shipped'),
) {}

class Rating extends AnyNumber.subtype('OneOfSchemaRating', n.oneOf(1, 2, 3)) {}

class Answer extends Nominal(
  'OneOfSchemaAnswer',
  n.oneOf('yes', 'no', true, false, 0, 1.5, null),
) {}

describe('n.oneOf() described and typed', () => {
  describe('JSON Schema', () => {
    it.each([
      ['strings', n.oneOf('a', 'b'), { type: 'string', enum: ['a', 'b'] }],
      ['integers', n.oneOf(1, 2), { type: 'integer', enum: [1, 2] }],
      ['numbers with fractions', n.oneOf(1, 2.5), { type: 'number', enum: [1, 2.5] }],
      ['booleans', n.oneOf(true), { type: 'boolean', enum: [true] }],
      ['null alone', n.oneOf(null), { enum: [null] }],
      ['several kinds', n.oneOf('a', 1, null), { enum: ['a', 1, null] }],
    ])('describes %s as enum', (_, schema, body) => {
      expect(schema['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toStrictEqual({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        ...body,
        description: schema.description,
      });
      expect(schema['~standard'].jsonSchema.output({ target: 'openapi-3.0' })).toStrictEqual({
        ...body,
        description: schema.description,
      });
    });

    it('leaves out the string check of AnyString, which the list implies', () => {
      expect(OrderStatus['~standard'].jsonSchema.input({ target: 'draft-07' })).toStrictEqual({
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'OneOfSchemaStatus',
        type: 'string',
        enum: ['draft', 'paid', 'shipped'],
        description: 'one of "draft", "paid", "shipped"',
      });
    });

    it.each([OrderStatus, Rating, Answer])('accepts exactly what %o accepts at runtime', (type) => {
      const candidates: unknown[] = [
        'draft',
        'Draft',
        'paid',
        '',
        'yes',
        'no',
        1,
        2,
        3,
        4,
        0,
        -0,
        1.5,
        '1',
        true,
        false,
        'true',
        null,
        ['draft'],
        {},
      ];

      for (const target of ['draft-2020-12', 'draft-07', 'openapi-3.0']) {
        const schema = type['~standard'].jsonSchema.input({ target });

        for (const candidate of candidates) {
          expect(satisfiesSchema(schema, candidate), `${target} ${String(candidate)}`).toBe(
            type.parse(candidate).ok,
          );
        }
      }
    });
  });

  describe('TypeScript enums', () => {
    enum Size {
      Small = 'S',
      Large = 'L',
    }

    enum Level {
      Low = 0,
      High = 1,
    }

    it('takes the values of a string enum', () => {
      const SizeType = Nominal('OneOfEnumSize', n.oneOf(...Object.values(Size)));

      expect(SizeType.parse('S').ok).toBe(true);
      expect(SizeType.parse('Small').ok).toBe(false);
      expectTypeOf(new SizeType(Size.Small).value).toEqualTypeOf<Size>();
    });

    it('refuses the member names a numeric enum also holds (class-validator #1060)', () => {
      const LevelType = Nominal('OneOfEnumLevel', n.oneOf(Level.Low, Level.High));

      expect(Object.values(Level)).toContain('Low');
      expect(LevelType.parse(0).ok).toBe(true);
      expect(LevelType.parse('Low').ok).toBe(false);
      expect(LevelType.parse('0').ok).toBe(false);
    });
  });

  describe('types', () => {
    it('gives the union of the listed literals as the value', () => {
      expectTypeOf(new OrderStatus('draft').value).toEqualTypeOf<'draft' | 'paid' | 'shipped'>();
      expectTypeOf(new Rating(1).value).toEqualTypeOf<1 | 2 | 3>();
      expectTypeOf(new Answer('yes').value).toEqualTypeOf<
        'yes' | 'no' | true | false | 0 | 1.5 | null
      >();
      expectTypeOf(n.oneOf('a', 'b')).toEqualTypeOf<OneOfSchema<'a' | 'b'>>();
    });

    it('keeps the narrowed value in a subtype of a subtype', () => {
      class Paid extends OrderStatus.subtype('OneOfPaid') {}

      expectTypeOf(new Paid('paid').value).toEqualTypeOf<'draft' | 'paid' | 'shipped'>();
      expectTypeOf<Paid>().toExtend<OrderStatus>();
      expectTypeOf<Paid>().toExtend<AnyString>();
    });

    it('refuses values of another kind than the parent at compile time', () => {
      // @ts-expect-error a number is not a string
      AnyString.subtype('OneOfMixed', n.oneOf('a', 1));
      // @ts-expect-error a listed value is required by new for a type declared with Nominal()
      expect(() => new Answer('maybe')).toThrow(NominalError);
    });
  });
});
