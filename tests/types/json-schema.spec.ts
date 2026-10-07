import { describe, expect, it } from 'vitest';

import { Email, Uuid } from '../../src/index.ts';
import type { AnyNominalType } from '../../src/index.ts';

const patternOf = (nominal: AnyNominalType): RegExp => {
  const schema = nominal['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
  const pattern: unknown = schema['pattern'];
  if (typeof pattern !== 'string') {
    throw new TypeError(`${nominal.typeName} describes no pattern`);
  }
  return new RegExp(pattern, 'u');
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
