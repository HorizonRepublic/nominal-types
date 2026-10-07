import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import { matching, Nominal, NominalError, PatternSchema, schemaOf } from '../../src/index.ts';
import { issuesOf, outputOf, thrownBy, valueOf } from '../support/results.ts';

class Code extends Nominal('PatternCode', /^C-\d{3}$/u) {}

class Ticket extends Nominal('PatternTicket', matching(/^T-\d{3}$/u, 'a ticket number')) {}

describe('PatternSchema', () => {
  describe('declaring a type from a regular expression', () => {
    it('builds an instance for a matching string', () => {
      expect(new Code('C-001').value).toBe('C-001');
    });

    it('keeps the pattern on the schema', () => {
      expect(Code.rule).toBeInstanceOf(PatternSchema);
      expect(Code.rule).toHaveProperty('pattern', /^C-\d{3}$/u);
    });

    it.each(['', 'C-01', 'C-0001', 'c-001', 'C-001\n', ' C-001'])('rejects %j', (text) => {
      expect(() => new Code(text)).toThrow(NominalError);
    });

    it('answers the same way however often the pattern runs', () => {
      const results = Array.from({ length: 5 }, () => Code.parse('C-001').ok);

      expect(results).toStrictEqual([true, true, true, true, true]);
    });
  });

  describe('messages', () => {
    it('quotes the pattern when no description is given', () => {
      expect(issuesOf(Code.parse('x'))).toStrictEqual([
        { message: String.raw`must be matched by ^C-\d{3}$ (was "x")` },
      ]);
    });

    it('uses the description when one is given', () => {
      expect(issuesOf(Ticket.parse('x'))).toStrictEqual([
        { message: 'must be a ticket number (was "x")' },
      ]);
    });

    it.each([
      [42, '42'],
      [-0, '-0'],
      [Number.NaN, 'NaN'],
      [true, 'true'],
      [Symbol('code'), 'symbol'],
      [null, 'null'],
      [undefined, 'undefined'],
      [{ value: 'C-001' }, 'object'],
      [['C-001'], 'array'],
    ])('reports %s as not a string', (input, kind) => {
      expect(issuesOf(Code.parse(input))).toStrictEqual([
        { message: `must be a string (was ${kind})` },
      ]);
    });

    it('throws the same issues from new', () => {
      expect(thrownBy(() => new Ticket('x'))).toMatchObject({
        message: 'PatternTicket: must be a ticket number (was "x")',
      });
    });
  });

  describe('flags', () => {
    it.each([/a/u, /a/])('accepts %s', (pattern) => {
      expect(matching(pattern).pattern).toBe(pattern);
    });

    it.each([/a/iu, /a/gu, /a/uy, /a/mu, /a/su, /a/v])('refuses %s', (pattern) => {
      expect(() => matching(pattern)).toThrow(/only the u flag is supported/u);
    });

    it('refuses a flagged pattern passed to Nominal directly', () => {
      expect(() => Nominal('Flagged', /a/iu)).toThrow(TypeError);
    });
  });

  describe('Standard Schema', () => {
    it('validates on its own', () => {
      expect(outputOf(matching(/^a$/u)['~standard'].validate('a'))).toBe('a');
      expect(matching(/^a$/u)['~standard'].validate('b').issues).toHaveLength(1);
    });

    it('validates to an instance through the type', () => {
      expect(outputOf(Code['~standard'].validate('C-001'))).toBeInstanceOf(Code);
    });

    it('embeds into an ArkType object', () => {
      expect(type({ code: schemaOf(Code) }).assert({ code: 'C-001' }).code).toBeInstanceOf(Code);
    });
  });

  describe('JSON Schema', () => {
    it.each([
      ['draft-2020-12', { $schema: 'https://json-schema.org/draft/2020-12/schema' }],
      ['draft-07', { $schema: 'http://json-schema.org/draft-07/schema#' }],
      ['openapi-3.0', {}],
    ])('describes the pattern for %s', (target, header) => {
      expect(Ticket['~standard'].jsonSchema.input({ target })).toStrictEqual({
        ...header,
        title: 'PatternTicket',
        type: 'string',
        pattern: String.raw`^T-\d{3}$`,
        description: 'a ticket number',
      });
    });

    it('leaves the description out when there is none', () => {
      expect(Code['~standard'].jsonSchema.output({ target: 'openapi-3.0' })).toStrictEqual({
        title: 'PatternCode',
        type: 'string',
        pattern: String.raw`^C-\d{3}$`,
      });
    });

    it('refuses a target it does not know', () => {
      expect(() => Code['~standard'].jsonSchema.input({ target: 'draft-04' })).toThrow(
        /draft-04 is not supported/u,
      );
    });

    it.each(['C-001', 'C-999', 'C-01', 'C-001\n', 'x'])(
      'accepts %j in the JSON Schema exactly when the type does',
      (text) => {
        const schema = Code['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
        const pattern = new RegExp(String(schema['pattern']), 'u');

        expect(pattern.test(text)).toBe(Code.parse(text).ok);
      },
    );
  });

  describe('narrowing', () => {
    it('narrows a parent built from a pattern', () => {
      class EvenCode extends Code.subtype('PatternEvenCode', /[02468]$/u) {}

      expect(valueOf(EvenCode.parse(new Code('C-002')))).toBeInstanceOf(EvenCode);
      expect(EvenCode.parse(new Code('C-001')).ok).toBe(false);
    });
  });
});
