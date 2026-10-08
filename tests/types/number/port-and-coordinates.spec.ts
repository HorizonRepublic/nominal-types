import { describe, expect, it, vi } from 'vitest';

import { columnKindOf } from '../../../src/adapters/orm/column.ts';
import type * as library from '../../../src/index.ts';
import { Latitude, Longitude, n, Port, Uint16 } from '../../../src/index.ts';
import { issuesOf, valueOf } from '../../support/results.ts';

describe('Port', () => {
  it('refuses port 0, which Uint16 takes', () => {
    expect(issuesOf(Port.parse(0))).toStrictEqual([
      { message: 'must be a port from 1 to 65535 (was 0)' },
    ]);
    expect(Uint16.parse(0).ok).toBe(true);
  });

  it('reports a value past 16 bits by the rule of Uint16', () => {
    expect(issuesOf(Port.parse(65_536))).toStrictEqual([
      { message: 'must be an unsigned 16-bit integer (was 65536)' },
    ]);
  });

  it('takes the number 80, which class-validator @IsPort refuses (typestack/class-validator#826)', () => {
    expect(new Port(80).value).toBe(80);
    expect(Port.parse('80').ok).toBe(false);
  });

  it.each([
    ['8080', 8080],
    ['1', 1],
    ['65535', 65_535],
  ])('reads %s from text', (text, port) => {
    expect(valueOf(n.of(Port).fromString().parse(text)).value).toBe(port);
  });

  it.each(['+80', '-0', '080', ' 80', '80 ', '0', '65536', '80.5', '0x50', '8e1x', ''])(
    'refuses %j as text, which validator.js isPort partly takes (validatorjs/validator.js#2208)',
    (text) => {
      expect(n.of(Port).fromString().parse(text).ok).toBe(false);
    },
  );

  it('is stored in an integer column', () => {
    expect(columnKindOf(Port)).toStrictEqual({ kind: 'integer' });
  });
});

describe.each([
  [Latitude, 90],
  [Longitude, 180],
] as const)('%o', (type, limit) => {
  it('includes both ends', () => {
    expect(new type(limit).value).toBe(limit);
    expect(new type(-limit).value).toBe(-limit);
  });

  it('keeps -0 as given', () => {
    expect(Object.is(new type(-0).value, -0)).toBe(true);
  });

  it.each(['51.5', '(10,20)', '10,20', [10, 20], { lat: 10 }])(
    'refuses %j, which class-validator @IsLatitude reads from text (typestack/class-validator#2568)',
    (input) => {
      expect(type.parse(input).ok).toBe(false);
    },
  );

  it('reads a number from text through fromString()', () => {
    expect(valueOf(n.of(type).fromString().parse('51.5')).value).toBe(51.5);
    expect(valueOf(n.of(type).fromString().parse(`-${limit}`)).value).toBe(-limit);
    expect(n.of(type).fromString().parse(`${limit}.0000001`).ok).toBe(false);
  });

  it('is stored in a double column', () => {
    expect(columnKindOf(type)).toStrictEqual({ kind: 'double' });
  });
});

describe('a latitude and a longitude', () => {
  it('are told apart even with one value', () => {
    expect(new Latitude(10).equals(new Longitude(10))).toBe(false);
    expect(new Latitude(10)).not.toBeInstanceOf(Longitude);
  });

  it('name the message after the range', () => {
    expect(issuesOf(Latitude.parse(91))).toStrictEqual([
      { message: 'must be a latitude from -90 to 90 (was 91)' },
    ]);
    expect(issuesOf(Longitude.parse(-181))).toStrictEqual([
      { message: 'must be a longitude from -180 to 180 (was -181)' },
    ]);
  });
});

describe('number types from another copy of the package', () => {
  it('pass where the types of this copy are expected', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');
    const port = new copy.Port(443);

    expect(valueOf(Port.parse(port))).toBe(port);
    expect(valueOf(Uint16.parse(port))).toBe(port);
    expect(valueOf(Port.parse(new copy.Uint16(443)))).toBeInstanceOf(Port);
    expect(Port.parse(new copy.Uint16(0)).ok).toBe(false);
    expect(new Latitude(1).equals(new copy.Latitude(1))).toBe(true);
  });
});
