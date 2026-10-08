import { describe, expect, it, vi } from 'vitest';

import type { RuleVerdict } from '../../src/index.ts';
import { n, NominalError, NonEmptyString, Uuid } from '../../src/index.ts';
import { resetConfigurationAfterEach } from '../support/configuration.ts';
import { issuesOf, valueOf } from '../support/results.ts';
import { Row, rowsOf, Sheet, uuid } from '../support/rule-fixtures.ts';

resetConfigurationAfterEach();

describe('n.rule() on a spreadsheet import', () => {
  const repeats = new Map([
    [10, 3],
    [500, 3],
    [999, 0],
  ]);

  it('reports every repeated SKU at its row and column', () => {
    expect(issuesOf(Sheet.parse(rowsOf(1000, repeats)))).toStrictEqual([
      { code: 'duplicate_sku', message: 'is invalid', path: [10, 'sku'] },
      { code: 'duplicate_sku', message: 'is invalid', path: [500, 'sku'] },
      { code: 'duplicate_sku', message: 'is invalid', path: [999, 'sku'] },
    ]);
  });

  it('writes the message configured for the code, with the params the rule gave', () => {
    n.configure({
      messages: {
        duplicate_sku: ({ params }) => `repeats the SKU of row ${String(params?.['row'])}`,
      },
    });

    expect(issuesOf(Sheet.parse(rowsOf(1000, repeats)))).toStrictEqual([
      { code: 'duplicate_sku', message: 'repeats the SKU of row 4', path: [10, 'sku'] },
      { code: 'duplicate_sku', message: 'repeats the SKU of row 4', path: [500, 'sku'] },
      { code: 'duplicate_sku', message: 'repeats the SKU of row 1', path: [999, 'sku'] },
    ]);
  });

  it('gives the rows as instances, and passes a sheet without repeats', () => {
    const rows = valueOf(Sheet.parse(rowsOf(1000)));

    expect(rows).toHaveLength(1000);
    expect(rows[0]).toBeInstanceOf(Row);
  });

  it('runs no rule while a row fails its own check', () => {
    const check = vi.fn<() => boolean>(() => true);
    const Checked = n.of(Row).array().check(check);
    const rows = [...rowsOf(3, new Map([[2, 0]])), { sku: '', quantity: 0 }];

    expect(issuesOf(Checked.parse(rows)).map(({ path }) => path)).toStrictEqual([
      [3, 'sku'],
      [3, 'quantity'],
    ]);
    expect(check).not.toHaveBeenCalled();
  });

  it('puts the path of the sheet in front inside an object', () => {
    const Upload = n.object({ name: NonEmptyString, rows: Sheet });
    const input = { name: 'march', rows: rowsOf(5, new Map([[4, 1]])) };

    expect(issuesOf(Upload.parse(input))).toStrictEqual([
      { code: 'duplicate_sku', message: 'is invalid', path: ['rows', 4, 'sku'] },
    ]);
    n.configure({ messages: { duplicate_sku: 'repeated' } });
    expect(issuesOf(Upload.parse(input))).toStrictEqual([
      { code: 'duplicate_sku', message: 'repeated', path: ['rows', 4, 'sku'] },
    ]);
  });

  it('agrees with accepts(), keeps the JSON Schema, and rejects in parseAsync()', async () => {
    const plain = n.of(Row).array({ max: 10_000 });
    const bad = rowsOf(3, new Map([[2, 0]]));

    expect(Sheet.accepts(bad)).toBe(false);
    expect(Sheet.accepts(rowsOf(3))).toBe(true);
    expect(Sheet['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toStrictEqual(
      plain['~standard'].jsonSchema.input({ target: 'draft-2020-12' }),
    );
    await expect(Sheet.parseAsync(bad)).rejects.toThrow(NominalError);
    await expect(Sheet.parseAsync(bad)).rejects.toThrow('is invalid');
  });
});

describe('the verdict of a check', () => {
  it.each<[string, RuleVerdict]>([
    ['true', true],
    ['nothing', undefined],
  ])('passes a value when the check returns %s', (_name, verdict) => {
    const Ids = n
      .of(Uuid)
      .array()
      .check(() => verdict);

    expect(valueOf(Ids.parse([uuid]))).toHaveLength(1);
  });

  it('adds one issue with the defaults of the rule for false', () => {
    const odd = n.rule((ids: readonly Uuid[]) => ids.length % 2 === 0, {
      path: ['ids'],
      code: 'odd_count',
      message: 'must hold pairs',
    });

    expect(issuesOf(n.of(Uuid).array().check(odd).parse([uuid]))).toStrictEqual([
      { code: 'odd_count', message: 'must hold pairs', path: ['ids'] },
    ]);
  });

  it('takes a message returned as the message of the issue', () => {
    const Ids = n
      .of(Uuid)
      .array()
      .check(() => 'must not be empty');

    expect(issuesOf(Ids.parse([uuid]))).toStrictEqual([{ message: 'must not be empty' }]);
  });

  it('keeps the reports and adds the issue for false after them', () => {
    const Ids = n
      .of(Uuid)
      .array()
      .check((_ids, report) => {
        report({ path: [0], message: 'first' });

        return false;
      });

    expect(issuesOf(Ids.parse([uuid]))).toStrictEqual([
      { message: 'first', path: [0] },
      { message: 'is invalid' },
    ]);
  });

  it('fills what an issue leaves out from the options of the rule', () => {
    const rule = n.rule(
      (_ids: readonly Uuid[], report) => {
        report({});
        report({ path: [], code: 'own', message: 'own message' });
      },
      { path: ['ids'], code: 'default_code', message: 'default message' },
    );

    expect(issuesOf(n.of(Uuid).array().check(rule).parse([uuid]))).toStrictEqual([
      { code: 'default_code', message: 'default message', path: ['ids'] },
      { code: 'own', message: 'own message' },
    ]);
  });

  it('copies the path, so changing it later changes nothing', () => {
    const path: PropertyKey[] = [0];
    const Ids = n
      .of(Uuid)
      .array()
      .check((_ids, report) => {
        report({ path });
        path.push('changed');
      });

    expect(issuesOf(Ids.parse([uuid]))).toStrictEqual([{ message: 'is invalid', path: [0] }]);
  });

  it('lets an error thrown by the check through', () => {
    const Ids = n
      .of(Uuid)
      .array()
      .check(() => {
        throw new RangeError('broken');
      });

    expect(() => Ids.parse([uuid])).toThrow(RangeError);
  });
});

describe('several rules', () => {
  it('run in the order given, each one, and their issues follow in that order', () => {
    const order: string[] = [];
    const Ids = n
      .of(Uuid)
      .array()
      .check(
        (_ids, report) => {
          order.push('first');
          report({ message: 'one' });
        },
        () => {
          order.push('second');

          return true;
        },
      )
      .check(() => {
        order.push('third');

        return 'three';
      });

    expect(issuesOf(Ids.parse([uuid])).map(({ message }) => message)).toStrictEqual([
      'one',
      'three',
    ]);
    expect(order).toStrictEqual(['first', 'second', 'third']);
  });
});
