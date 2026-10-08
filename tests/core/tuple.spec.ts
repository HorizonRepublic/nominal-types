import { describe, expect, it } from 'vitest';

import {
  AnyString,
  Email,
  Latitude,
  Longitude,
  n,
  PositiveInteger,
  Uuid,
} from '../../src/index.ts';
import { configured, resetConfigurationAfterEach } from '../support/configuration.ts';
import { issuesOf, valueOf } from '../support/results.ts';

const point = n.tuple([Latitude, Longitude]);
const command = n.tuple([AnyString], AnyString);
const range = n.tuple([PositiveInteger, n.of(PositiveInteger).optional()]);

resetConfigurationAfterEach();

describe('n.tuple()', () => {
  it('checks each item by the schema of its position, and gives a new array', () => {
    const input = [50.45, 30.52];
    const value = valueOf(point.parse(input));

    expect(n.plain(value)).toStrictEqual([50.45, 30.52]);
    expect(value).not.toBe(input);
    expect(value[0]).toBeInstanceOf(Latitude);
    expect(value[1]).toBeInstanceOf(Longitude);
  });

  it('reports every bad item with its index', () => {
    expect(issuesOf(point.parse([95, 'x']))).toStrictEqual([
      { message: 'must be a latitude from -90 to 90 (was 95)', path: [0] },
      { message: 'must be a number (was "x")', path: [1] },
    ]);
  });

  it('checks the count first, at the boundaries', () => {
    expect(issuesOf(point.parse([1]))).toStrictEqual([{ message: 'must have 2 items (was 1)' }]);
    expect(issuesOf(point.parse([1, 2, 3]))).toStrictEqual([
      { message: 'must have 2 items (was 3)' },
    ]);
    expect(issuesOf(point.parse([]))).toStrictEqual([{ message: 'must have 2 items (was 0)' }]);
    expect(point.accepts([1])).toBe(false);
    expect(point.accepts([1, 2, 3])).toBe(false);
  });

  it('refuses anything but an array', () => {
    for (const input of [null, undefined, '12', 1, { 0: 1, 1: 2, length: 2 }, new Set([1, 2])]) {
      expect(point.parse(input).ok).toBe(false);
      expect(point.accepts(input)).toBe(false);
    }

    expect(issuesOf(point.parse({}))).toStrictEqual([{ message: 'must be an array (was object)' }]);
  });

  it('checks every further item by the rest', () => {
    expect(n.plain(valueOf(command.parse(['git', 'commit', '-m'])))).toStrictEqual([
      'git',
      'commit',
      '-m',
    ]);
    expect(valueOf(command.parse(['ls']))).toHaveLength(1);
    expect(issuesOf(command.parse([]))).toStrictEqual([
      { message: 'must have at least 1 item (was 0)' },
    ]);
    expect(issuesOf(command.parse(['git', 1, 'x', 2]))).toStrictEqual([
      { message: 'must be a string (was 1)', path: [1] },
      { message: 'must be a string (was 2)', path: [3] },
    ]);
    expect(n.tuple([], PositiveInteger).parse([1, 2]).ok).toBe(true);
  });

  it('lets trailing items whose schema accepts undefined be left out', () => {
    expect(valueOf(range.parse([1]))).toHaveLength(1);
    expect(valueOf(range.parse([1, 2]))).toHaveLength(2);
    expect(n.plain(valueOf(range.parse([1, undefined])))).toStrictEqual([1, undefined]);
    expect(issuesOf(range.parse([]))).toStrictEqual([
      { message: 'must have at least 1 item (was 0)' },
    ]);
    expect(issuesOf(range.parse([1, 2, 3]))).toStrictEqual([
      { message: 'must have at most 2 items (was 3)' },
    ]);
    expect(range.accepts([1])).toBe(true);
    expect(range.accepts([1, 0])).toBe(false);
  });

  it('keeps an optional item before a required one in place', () => {
    const middle = n.tuple([n.of(AnyString).optional(), PositiveInteger]);

    expect(n.plain(valueOf(middle.parse([undefined, 1])))).toStrictEqual([undefined, 1]);
    expect(middle.parse([1]).ok).toBe(false);
  });

  it('reads a hole in a sparse array as undefined', () => {
    // oxlint-disable-next-line no-sparse-arrays
    expect(issuesOf(point.parse([, 1]))).toStrictEqual([
      { message: 'must be a number (was undefined)', path: [0] },
    ]);
  });

  it('accepts the empty tuple, and only the empty array', () => {
    expect(valueOf(n.tuple([]).parse([]))).toStrictEqual([]);
    expect(issuesOf(n.tuple([]).parse([1]))).toStrictEqual([
      { message: 'must have 0 items (was 1)' },
    ]);
  });

  it('refuses items that are not types or schemas', () => {
    expect(() => {
      Reflect.apply(n.tuple, undefined, ['x']);
    }).toThrow(new TypeError('n.tuple(): list the items in an array (was "x")'));
    expect(() => {
      Reflect.apply(n.tuple, undefined, [[AnyString, 1]]);
    }).toThrow(new TypeError('n.tuple(): the item 1 must be a nominal type or a schema (was 1)'));
    expect(() => {
      Reflect.apply(n.tuple, undefined, [[AnyString], null]);
    }).toThrow(new TypeError('n.tuple(): the rest must be a nominal type or a schema (was null)'));
  });

  it('nests tuples, records and objects, with the full path in each issue', () => {
    const line = n.tuple([n.object({ id: Uuid }), n.record(AnyString, point)]);

    expect(issuesOf(line.parse([{ id: 'x' }, { home: [0, 200] }]))).toStrictEqual([
      { message: 'must be a UUID (was "x")', path: [0, 'id'] },
      { message: 'must be a longitude from -180 to 180 (was 200)', path: [1, 'home', 1] },
    ]);
  });
});

describe('n.tuple() with configured messages and codes', () => {
  it('gives the count issues their codes, and the message map words them', () => {
    configured(
      { codes: true, messages: { too_few_items: ({ min }) => `at least ${String(min)}` } },
      () => {
        expect(issuesOf(range.parse([]))).toStrictEqual([
          { code: 'too_few_items', message: 'at least 1' },
        ]);
        expect(issuesOf(point.parse([1, 2, 3]))).toStrictEqual([
          { code: 'too_many_items', message: 'must have 2 items (was 3)' },
        ]);
        expect(issuesOf(point.parse([1, 'x']))).toStrictEqual([
          { code: 'invalid', message: 'must be a number (was "x")', path: [1] },
        ]);
      },
    );
  });

  it('hides the values of a sensitive item', () => {
    expect(issuesOf(n.tuple([Email]).parse(['jane']))).toStrictEqual([
      { message: 'must be an email address (was a string of 4 characters)', path: [0] },
    ]);
  });

  it('trims string items when asked', () => {
    const uuid = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

    configured({ normalize: { trimStrings: true } }, () => {
      expect(n.plain(valueOf(n.tuple([Uuid]).parse([` ${uuid} `])))).toStrictEqual([uuid]);
    });
  });
});
