import { describe, expect, it } from 'vitest';

import * as library from '../../src/index.ts';
import {
  Base64,
  Base64Url,
  Email,
  HexColor,
  isNominalType,
  LanguageTag,
  MediaType,
  NonBlankString,
  ObjectId,
  SemVer,
  Ulid,
  Uuid,
  UuidV4,
  UuidV7,
} from '../../src/index.ts';
import type { AnyNominalType } from '../../src/index.ts';
import { satisfiesSchema } from '../support/json-schema.ts';

const patternsIn = (schema: unknown): string[] => {
  if (typeof schema !== 'object' || schema === null) {
    return [];
  }

  const own: unknown = Reflect.get(schema, 'pattern');
  const parts: unknown = Reflect.get(schema, 'allOf');

  return [
    ...(typeof own === 'string' ? [own] : []),
    ...(Array.isArray(parts) ? parts.flatMap((part: unknown) => patternsIn(part)) : []),
  ];
};

const patternOf = (nominal: AnyNominalType): { test: (text: string) => boolean } => {
  const patterns = patternsIn(nominal['~standard'].jsonSchema.input({ target: 'draft-2020-12' }));

  if (patterns.length === 0) {
    throw new TypeError(`${nominal.typeName} describes no pattern`);
  }

  const compiled = patterns.map((pattern) => new RegExp(pattern, 'u'));

  return { test: (text) => compiled.every((pattern) => pattern.test(text)) };
};

const cases: ReadonlyArray<readonly [AnyNominalType, readonly string[], readonly string[]]> = [
  [
    Email,
    ['a+tag@b.co', 'Jane.Doe+news@Example.com', 'a@xn--80ak6aa92e.com', `${'x'.repeat(64)}@b.co`],
    ['.a@b.co', 'a..b@c.co', 'a@localhost', `${'x'.repeat(65)}@b.co`, 'юзер@пошта.укр'],
  ],
  [
    Uuid,
    [
      '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
      '6F1C2A3E-8B9D-4E5F-A1B2-C3D4E5F60718',
      '00000000-0000-0000-0000-000000000000',
      'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
    ],
    ['6f1c2a3e-8b9d-9e5f-a1b2-c3d4e5f60718', '6f1c2a3e8b9d4e5fa1b2c3d4e5f60718', 'not-a-uuid'],
  ],
  [
    LanguageTag,
    ['en', 'EN-us', 'zh-Hant-TW', 'de-CH-1996', 'en-u-ca-gregory', 'en-t-zh', 'en-x-a'],
    ['en_US', 'french', 'i-klingon', 'zh-yue', 'x-private', 'en-', 'abcdefghi'],
  ],
  [
    MediaType,
    ['text/plain', 'Image/SVG+XML', 'text/plain ;\tcharset="utf-8"', 'a/b;x="\\"";y="é"'],
    ['*/*', 'text/plain;', 'text/plain;charset', 'text/plain ', 'a/b;x="ā"', 'a/b;x="'],
  ],
  [HexColor, ['#fff', '#FFF8', '#1e90ff', '#1E90FF80'], ['fff', '#ff', '#fffff', '#fffffffff']],
  [Base64, ['', 'Zg==', 'Zm8=', 'Zm9v', '+/+/'], ['QR==', 'QUJ=', 'Zg', 'Zg=', '====', '-_-_']],
  [Base64Url, ['', 'Zg', 'Zm8', 'Zm9v', '-_-_'], ['QR', 'QUJ', 'Zg==', 'Q', '+/+/']],
  [
    UuidV4,
    ['6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718', '6F1C2A3E-8B9D-4E5F-A1B2-C3D4E5F60718'],
    ['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', '00000000-0000-0000-0000-000000000000'],
  ],
  [
    UuidV7,
    ['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', '0190F1C2-3B4A-7C5D-8E9F-0A1B2C3D4E5F'],
    ['6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718', 'ffffffff-ffff-ffff-ffff-ffffffffffff'],
  ],
  [
    Ulid,
    ['01ARZ3NDEKTSV4RRFFQ69G5FAV', '01arz3ndektsv4rrffq69g5fav', `7${'Z'.repeat(25)}`],
    [`8${'0'.repeat(25)}`, '01ARZ3NDEKTSV4RRFFQ69G5FAI', '01ARZ3NDEKTSV4RRFFQ69G5FA'],
  ],
  [
    ObjectId,
    ['507f1f77bcf86cd799439011', '507F1F77BCF86CD799439011'],
    ['507f1f77bcf86cd79943901', '507f1f77bcf86cd79943901g'],
  ],
  [
    SemVer,
    ['0.0.0', '1.0.0-alpha.1+build.01', `${Number.MAX_SAFE_INTEGER}.0.0`],
    ['v1.0.0', '1.0.0-01', `${Number.MAX_SAFE_INTEGER + 1}.0.0`, `1.0.0+${'b'.repeat(251)}`],
  ],
  [NonBlankString, ['a', ' a '], ['  ', '\t\n']],
];

describe('JSON Schema patterns', () => {
  describe.each(cases)('%o', (nominal, accepted, rejected) => {
    const pattern = patternOf(nominal);

    it.each(accepted)('accepts %s like the type does', (value) => {
      expect(nominal.parse(value).ok).toBe(true);
      expect(pattern.test(value)).toBe(true);
    });

    it.each(rejected)('rejects %s like the type does', (value) => {
      expect(nominal.parse(value).ok).toBe(false);
      expect(pattern.test(value)).toBe(false);
    });
  });
});

const examplesIn = (schema: unknown): unknown[] => {
  if (typeof schema !== 'object' || schema === null) {
    return [];
  }

  const own: unknown = Reflect.get(schema, 'examples');
  const parts: unknown = Reflect.get(schema, 'allOf');

  return [
    ...(Array.isArray(own) ? (own as unknown[]) : []),
    ...(Array.isArray(parts) ? parts.flatMap((part: unknown) => examplesIn(part)) : []),
  ];
};

const builtIns = Object.values(library).filter((value) => isNominalType(value));

describe('JSON Schema examples', () => {
  it.each(builtIns.map((type) => [type.typeName, type] as const))(
    'are values %s accepts',
    (_, type) => {
      const examples = examplesIn(type['~standard'].jsonSchema.input({ target: 'draft-2020-12' }));

      expect(examples.every((example) => type.parse(example).ok)).toBe(true);
    },
  );

  it('become a single example for OpenAPI 3.0', () => {
    const schema = Email['~standard'].jsonSchema.input({ target: 'openapi-3.0' });

    expect(schema).toMatchObject({ example: 'jane.doe@example.com' });
    expect(schema).not.toHaveProperty('examples');
  });

  it.each(builtIns.map((type) => [type.typeName, type] as const))(
    'give %s its name as the title',
    (name, type) => {
      expect(type['~standard'].jsonSchema.input({ target: 'openapi-3.0' })).toMatchObject({
        title: name,
      });
    },
  );
});

describe('JSON Schema length limits', () => {
  const longest = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(58)}.co`;
  const schema = Email['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

  it('build the longest address the type allows', () => {
    expect(longest).toHaveLength(254);
  });

  it.each([
    ['a@b.co', true],
    ['a@b.c', false],
    [longest, true],
    [`a${longest}`, false],
  ])('agree with Email on %s', (value, accepted) => {
    expect(Email.parse(value).ok).toBe(accepted);
    expect(satisfiesSchema(schema, value)).toBe(accepted);
  });
});
