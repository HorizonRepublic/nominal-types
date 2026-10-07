import { describe, expect, it, vi } from 'vitest';

import { AnyString, HexColor, NominalError } from '../../../src/index.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';

const schema = HexColor['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

describe('HexColor', () => {
  it.each(['#fff', '#FFF', '#fFf8', '#1e90ff', '#1E90FF', '#1e90ff80', '#00000000'])(
    'accepts %s',
    (text) => {
      expect(new HexColor(text).value).toBe(text);
    },
  );

  it.each([
    '',
    '#',
    '#f',
    '#ff',
    '#fffff',
    '#fffffff',
    '#fffffffff',
    '#ggg',
    '# fff',
    '#fff ',
    ' #fff',
    '##fff',
    '#ｆｆｆ',
    '#٠٠٠',
    'rgb(0, 0, 0)',
    'red',
  ])('rejects %j', (text) => {
    expect(() => new HexColor(text)).toThrow(NominalError);
  });

  it.each([42, 0xff_ff_ff, null, undefined, true, ['#fff'], { value: '#fff' }])(
    'rejects %o, which is not a string',
    (value) => {
      expect(HexColor.parse(value).ok).toBe(false);
    },
  );

  it('rejects colors without the # (class-validator #2566)', () => {
    expect(HexColor.parse('fff').ok).toBe(false);
    expect(HexColor.parse('6633FF').ok).toBe(false);
  });

  it('reports the rejection in words', () => {
    expect(HexColor.parse('fff')).toMatchObject({
      ok: false,
      issues: [{ message: 'must be a hex color (was "fff")' }],
    });
  });

  it('is a string type', () => {
    expect(new HexColor('#fff')).toBeInstanceOf(AnyString);
  });

  describe('channels', () => {
    it('reads six digits', () => {
      const color = new HexColor('#1E90FF');

      expect([color.red, color.green, color.blue, color.alpha]).toStrictEqual([30, 144, 255, 1]);
    });

    it('reads eight digits with the alpha as a fraction', () => {
      const color = new HexColor('#1e90ff80');

      expect([color.red, color.green, color.blue]).toStrictEqual([30, 144, 255]);
      expect(color.alpha).toBe(128 / 255);
    });

    it('doubles each digit of the short forms', () => {
      const color = new HexColor('#f808');

      expect([color.red, color.green, color.blue, color.alpha]).toStrictEqual([
        255,
        136,
        0,
        136 / 255,
      ]);
    });

    it('reads the edges of the alpha', () => {
      expect(new HexColor('#0000').alpha).toBe(0);
      expect(new HexColor('#000f').alpha).toBe(1);
    });
  });

  describe('canonical form', () => {
    it.each([
      ['#FFF', '#ffffff'],
      ['#fffF', '#ffffff'],
      ['#1E90FFFF', '#1e90ff'],
      ['#1E90FF80', '#1e90ff80'],
      ['#f808', '#ff880088'],
      ['#000', '#000000'],
    ])('writes %s as %s', (text, canonical) => {
      expect(new HexColor(text).canonical().value).toBe(canonical);
    });

    it('compares by channels', () => {
      expect(new HexColor('#FFF').equals(new HexColor('#ffffffff'))).toBe(true);
      expect(new HexColor('#fff').equals(new HexColor('#fffe'))).toBe(false);
      expect(new HexColor('#fff').equals('#fff')).toBe(false);
    });
  });

  describe('JSON Schema', () => {
    it('describes the notation with its lengths', () => {
      expect(schema).toMatchObject({
        type: 'string',
        pattern: HexColor.pattern.source,
        minLength: 4,
        maxLength: 9,
      });
    });

    it.each(['#fff', '#1e90ff80', '#fffff', 'fff', '#ggg', '#fffffffff', ''])(
      'agrees with the type on %j',
      (text) => {
        expect(satisfiesSchema(schema, text)).toBe(HexColor.parse(text).ok);
      },
    );
  });

  it('refuses a long crafted input quickly', () => {
    const start = performance.now();

    expect(HexColor.parse(`#${'f'.repeat(100_000)}`).ok).toBe(false);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('compares with a color built by another copy of the package', async () => {
    vi.resetModules();
    const copy = await import('../../../src/index.ts');

    expect(new copy.HexColor('#FFF').equals(new HexColor('#ffffff'))).toBe(true);
    expect(HexColor.parse(new copy.HexColor('#fff')).ok).toBe(true);
  });
});
