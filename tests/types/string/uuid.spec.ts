import { describe, expect, it } from 'vitest';

import { NominalError, Uuid, UuidV4, UuidV7 } from '../../../src/index.ts';
import { disagreementsOf } from '../../support/json-schema.ts';

const samples = [
  '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f',
  '6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718',
  '00000000-0000-0000-0000-000000000000',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  ...['1', '2', '3', '5', '6', '8'].map(
    (version) => `c232ab00-9414-${version}1e8-a8b1-0242ac120002`,
  ),
];
const replacements = [
  ...Array.from('0123456789abcdefABCDEFgGzZ-_ \n\0'),
  'é',
  'İ',
  '０',
  '\uD800',
  '😀',
];

const casesOf = (sample: string): string[] => [
  ...new Set([
    sample,
    sample.toUpperCase(),
    sample.replaceAll(/[a-f]/gu, (digit) => digit.toUpperCase()),
  ]),
];

const swapsOf = (text: string): string[] =>
  Array.from(text, (_, at) =>
    replacements.map((replacement) => `${text.slice(0, at)}${replacement}${text.slice(at + 1)}`),
  ).flat();

// Each text, cut or lengthened by one character, and with each character swapped for each
// replacement.
const nearMissesOf = (text: string): string[] =>
  [text, text.slice(1), text.slice(0, -1), `${text}0`, `0${text}`].concat(swapsOf(text));

const generated = samples
  .flatMap((sample) => casesOf(sample))
  .flatMap((text) => nearMissesOf(text));

describe('Uuid', () => {
  it.each([Uuid, UuidV4, UuidV7])(
    '%o accepts exactly the strings its pattern matches, as its JSON Schema does',
    (type) => {
      expect(generated.filter((text) => type.pattern.test(text)).length).toBeGreaterThan(100);
      expect(generated.filter((text) => type.parse(text).ok !== type.pattern.test(text))).toEqual(
        [],
      );
      expect(generated.filter((text) => type.accepts(text) !== type.pattern.test(text))).toEqual(
        [],
      );
      expect(disagreementsOf(type, generated)).toEqual([]);
    },
  );

  it.each([undefined, null, 36, ['0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f'], {}])(
    'rejects %o, which is not a string',
    (value) => {
      expect(Uuid.accepts(value)).toBe(false);
      expect(Uuid.parse(value)).toMatchObject({ ok: false });
    },
  );

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
