import type { StandardSchemaV1 } from '@standard-schema/spec';
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import { matching, Nominal, NominalError } from '../../src/index.ts';
import { FlashSku, PromoSku, Sku } from '../support/fixtures.ts';
import { handWritten, issuesOf, stringOnly, valueOf } from '../support/results.ts';

class Trimmed extends Nominal(
  'TrimmedName',
  type('string').pipe((text) => text.trim()),
) {}

class ShortTrimmed extends Trimmed.subtype('ShortTrimmedName', /^.{1,5}$/u) {}

const counting = (): { calls: number; schema: StandardSchemaV1<string, string> } => {
  const state = { calls: 0 };
  const schema = handWritten((value) => {
    state.calls += 1;
    return stringOnly(value);
  });
  return {
    get calls(): number {
      return state.calls;
    },
    schema,
  };
};

const digitsOnly = handWritten((value) =>
  typeof value === 'string' && /^SKU-\d+$/u.test(value)
    ? { value }
    : { issues: [{ message: 'must hold digits only' }] },
);

const patternsOf = (schema: Record<string, unknown>): RegExp[] => {
  const parts: unknown = schema['allOf'];
  if (!Array.isArray(parts)) {
    throw new TypeError('expected allOf');
  }
  return parts.map(
    (part: unknown) =>
      new RegExp(
        String(typeof part === 'object' && part !== null ? Reflect.get(part, 'pattern') : ''),
        'u',
      ),
  );
};

describe('Subtype constraints', () => {
  it('accepts a value that passes the parent and the constraint', () => {
    expect(new PromoSku('SKU-9001').value).toBe('SKU-9001');
  });

  it('rejects a value the constraint refuses', () => {
    expect(issuesOf(PromoSku.parse('SKU-0001'))).toStrictEqual([
      { message: 'must be matched by ^SKU-9 (was "SKU-0001")' },
    ]);
  });

  it('reports the parent issues and never runs the constraint when the parent refuses', () => {
    const constraint = counting();
    class Guarded extends Sku.subtype('GuardedSku', constraint.schema) {}

    expect(issuesOf(Guarded.parse('nope'))).toStrictEqual([
      { message: String.raw`must be matched by ^SKU-\d{4}$ (was "nope")` },
    ]);
    expect(constraint.calls).toBe(0);
    expect(new Guarded('SKU-0001').value).toBe('SKU-0001');
    expect(constraint.calls).toBe(1);
  });

  it('checks the value the parent produced rather than the raw input', () => {
    expect(new ShortTrimmed('  abc  ').value).toBe('abc');
    expect(() => new ShortTrimmed('  abcdef  ')).toThrow(NominalError);
  });

  it('applies every constraint along a chain', () => {
    expect(new FlashSku('SKU-9901').value).toBe('SKU-9901');
    expect(FlashSku.parse('SKU-9001').ok).toBe(false);
    expect(FlashSku.parse('SKU-0001').ok).toBe(false);
  });

  it('accepts a schema from any library as the constraint', () => {
    class Plain extends Sku.subtype('PlainSku', digitsOnly) {}

    expect(valueOf(Plain.parse('SKU-1234'))).toBeInstanceOf(Plain);
  });

  it('refuses a constraint that answers asynchronously, naming the type', () => {
    const remote = handWritten(async (value) => {
      await Promise.resolve();
      return { value: String(value) };
    });
    class Remote extends Sku.subtype('RemoteSku', remote) {}

    expect(() => Remote.parse('SKU-0001')).toThrow(
      'RemoteSku: asynchronous schemas are not supported',
    );
  });

  it('validates through the chain schema on its own', async () => {
    const accepted = await PromoSku.schema['~standard'].validate('SKU-9001');
    const rejected = await PromoSku.schema['~standard'].validate('SKU-0001');

    expect(accepted).toStrictEqual({ value: 'SKU-9001' });
    expect(rejected.issues).toHaveLength(1);
  });

  describe('JSON Schema', () => {
    it('describes a subtype as allOf the parent and the constraint', () => {
      expect(FlashSku['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toStrictEqual({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        allOf: [
          {
            allOf: [
              { type: 'string', pattern: String.raw`^SKU-\d{4}$` },
              { type: 'string', pattern: '^SKU-9' },
            ],
          },
          { type: 'string', pattern: '^SKU-99' },
        ],
      });
    });

    it.each(['SKU-9001', 'SKU-0001', 'SKU-9', 'x'])(
      'accepts %j in JSON Schema exactly when the subtype does',
      (text) => {
        const patterns = patternsOf(PromoSku['~standard'].jsonSchema.input({ target: 'draft-07' }));

        expect(patterns.every((pattern) => pattern.test(text))).toBe(PromoSku.parse(text).ok);
      },
    );

    it('refuses to describe a constraint that cannot describe itself', () => {
      class Opaque extends Sku.subtype('OpaqueSku', handWritten(stringOnly)) {}

      expect(() => Opaque['~standard'].jsonSchema.output({ target: 'draft-07' })).toThrow(
        /cannot describe itself as JSON Schema/u,
      );
    });
  });

  describe('types', () => {
    it('takes a pattern only for types whose value is a string', () => {
      class Percentage extends Nominal('ConstraintPercentage', type('0 <= number <= 100')) {}

      // @ts-expect-error a pattern cannot constrain a number
      Percentage.subtype('Half', /5/u);

      expect(Percentage.subtype('Low', type('number < 10')).typeName).toBe('Low');
    });

    it('describes a constraint with matching', () => {
      class Labelled extends Sku.subtype('LabelledSku', matching(/^SKU-1/u, 'a first-range SKU')) {}

      expect(issuesOf(Labelled.parse('SKU-2000'))).toStrictEqual([
        { message: 'must be a first-range SKU (was "SKU-2000")' },
      ]);
    });
  });
});
