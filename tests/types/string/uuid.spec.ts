import { describe, expect, it } from 'vitest';

import { NominalError, Uuid } from '../../../src/index.ts';

describe('Uuid', () => {
  it.each([
    ['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f', 7],
    ['6F1C2A3E-8B9D-4E5F-A1B2-C3D4E5F60718', 4],
    ['00000000-0000-0000-0000-000000000000', 0],
    ['ffffffff-ffff-ffff-ffff-ffffffffffff', 15],
  ])('accepts %s as version %i', (text, version) => {
    expect(new Uuid(text).version).toBe(version);
  });

  it.each([
    '6f1c2a3e-8b9d-9e5f-a1b2-c3d4e5f60718',
    '6f1c2a3e8b9d4e5fa1b2c3d4e5f60718',
    '{6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718}',
    'not-a-uuid',
  ])('rejects %s', (text) => {
    expect(() => new Uuid(text)).toThrow(NominalError);
  });

  it('reads the generation time of a version 7 UUID', () => {
    expect(new Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f').timestamp).toStrictEqual(
      new Date(0x01_90_f1_c2_3b_4a),
    );
  });

  it('has no generation time for other versions', () => {
    expect(new Uuid('6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718').timestamp).toBeUndefined();
  });

  it('recognises the nil and max values', () => {
    expect(new Uuid('00000000-0000-0000-0000-000000000000').isNil).toBe(true);
    expect(new Uuid('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF').isMax).toBe(true);
    expect(new Uuid('6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718').isNil).toBe(false);
  });

  it('compares regardless of case', () => {
    const upper = new Uuid('6F1C2A3E-8B9D-4E5F-A1B2-C3D4E5F60718');

    expect(upper.equals(new Uuid('6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718'))).toBe(true);
    expect(upper.equals('6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718')).toBe(false);
  });

  it('lowers the digits for output', () => {
    expect(new Uuid('6F1C2A3E-8B9D-4E5F-A1B2-C3D4E5F60718').canonical().value).toBe(
      '6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718',
    );
  });
});
