import { describe, expect, it } from 'vitest';

import { AnyString, Email, matching, Nominal, schemaOf, Uuid } from '../../src/index.ts';

const v4 = '6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718';
const v7 = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

interface Describable {
  readonly '~standard': {
    readonly jsonSchema: {
      readonly input: (options: { readonly target: string }) => Record<string, unknown>;
    };
  };
}

const draft = (type: Describable): Record<string, unknown> =>
  type['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
const openApi = (type: Describable): Record<string, unknown> =>
  type['~standard'].jsonSchema.input({ target: 'openapi-3.0' });

const hasExamples = (part: unknown): boolean =>
  typeof part === 'object' && part !== null && 'examples' in part;

const partsWithExamples = (schema: Record<string, unknown>): number => {
  const parts: unknown = schema['allOf'];
  return Array.isArray(parts) ? parts.filter((part) => hasExamples(part)).length : 0;
};

describe('examples across a hierarchy', () => {
  it('keeps the examples of a subtype without a rule, under its own title', () => {
    class UserId extends Uuid.subtype('UserId') {}

    expect(draft(UserId)).toMatchObject({ title: 'UserId', examples: [v7] });
  });

  it('drops a parent example the subtype rejects', () => {
    class UuidV4 extends Uuid.subtype('UuidV4', matching(/^.{14}4/u, 'a version 4 UUID')) {}
    const schema = draft(UuidV4);

    expect(schema).not.toHaveProperty('examples');
    expect(JSON.stringify(schema)).not.toContain(v7);
  });

  it("moves a subtype's own examples to the top and keeps them out of allOf", () => {
    class UuidV4 extends Uuid.subtype(
      'UuidV4',
      matching(/^.{14}4/u, 'a version 4 UUID', { examples: [v4] }),
    ) {}
    const schema = draft(UuidV4);

    expect(schema).toMatchObject({ title: 'UuidV4', examples: [v4] });
    expect(partsWithExamples(schema)).toBe(0);
    expect(schema['allOf']).toHaveLength(2);
    expect(openApi(UuidV4)).toMatchObject({ example: v4 });
  });

  it('keeps a parent example the subtype also accepts, once', () => {
    class CompanyEmail extends Email.subtype(
      'CompanyEmail',
      matching(/@example\.com$/u, 'a company address', { examples: ['jane.doe@example.com'] }),
    ) {}

    expect(draft(CompanyEmail)['examples']).toStrictEqual(['jane.doe@example.com']);
  });

  it("gives a variant only examples its own rule accepts, not its source's", () => {
    class Code extends AnyString.subtype(
      'Code',
      matching(/^C-\d{3}$/u, 'a code', { examples: ['C-001'] }),
    ) {}
    class LegacyCode extends Code.variant(
      'LegacyCode',
      matching(/^L\d{2}$/u, 'a legacy code', { examples: ['L01'] }),
    ) {}

    expect(draft(LegacyCode)).toMatchObject({ title: 'LegacyCode', examples: ['L01'] });
  });

  it('checks examples against a rule added with extends', () => {
    class Code extends Nominal(
      'Code2',
      matching(/^C-\d{3}$/u, 'a code', { examples: ['C-001', 'C-900'] }),
    ) {}
    class HighCode extends Code {
      public static override readonly rule = matching(/^C-9/u, 'a high code');
    }

    expect(draft(HighCode)['examples']).toStrictEqual(['C-900']);
    expect(draft(Code)['examples']).toStrictEqual(['C-001', 'C-900']);
  });

  it('carries the item examples into an array schema', () => {
    expect(draft(schemaOf(Uuid).array())).toMatchObject({ items: { examples: [v7] } });
  });
});
