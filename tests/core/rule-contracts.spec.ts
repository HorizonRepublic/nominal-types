import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type {
  AnyIssueCode,
  Email,
  NominalIssue,
  Report,
  Rule,
  RuleIssue,
} from '../../src/index.ts';
import { n, PositiveInteger, Uuid } from '../../src/index.ts';
import { configured, resetConfigurationAfterEach } from '../support/configuration.ts';
import { issuesOf, thrownBy } from '../support/results.ts';
import { pairs, Row, rowsOf, Sheet, uniqueSku, uuid } from '../support/rule-fixtures.ts';

resetConfigurationAfterEach();

describe('mistakes', () => {
  it.each<[string, () => unknown, string]>([
    [
      'a check that is not a function',
      () => {
        Reflect.apply(n.rule, undefined, [1]);
      },
      'n.rule(): the check must be a function',
    ],
    [
      'options that are not an object',
      () => {
        Reflect.apply(n.rule, undefined, [() => true, null]);
      },
      'n.rule(): the options must be an object',
    ],
    [
      'a path that is not an array',
      () => {
        Reflect.apply(n.rule, undefined, [() => true, { path: 'a' }]);
      },
      'n.rule(): path must be an array of keys',
    ],
    [
      'an empty code',
      () => n.rule(() => true, { code: '' }),
      'n.rule(): code must be a non-empty string',
    ],
    [
      'a message that is not a string',
      () => {
        Reflect.apply(n.rule, undefined, [() => true, { message: 1 }]);
      },
      'n.rule(): message must be a string',
    ],
    [
      'a rule that is neither',
      () => {
        const Ids = n.of(Uuid).array();

        Reflect.apply(Reflect.get(Ids, 'check'), Ids, [1]);
      },
      'check(): pass a rule built by n.rule(), or a function',
    ],
    [
      'a rule that is neither on an object',
      () => {
        const Ids = n.object({ id: Uuid });

        Reflect.apply(Reflect.get(Ids, 'check'), Ids, [{}]);
      },
      'check(): pass a rule built by n.rule(), or a function',
    ],
  ])('throws a TypeError for %s', (_name, build, message) => {
    const error = thrownBy(build);

    expect(error).toBeInstanceOf(TypeError);
    expect(error).toHaveProperty('message', message);
  });
});

describe('n.constraint() over n.rule()', () => {
  const endAfterStart = n.constraint(
    { start: PositiveInteger, end: PositiveInteger },
    ({ start, end }) => end > start,
    { path: 'end' },
  );
  const sameAsRule = n.rule(
    ({ start, end }: { readonly start: PositiveInteger; readonly end: PositiveInteger }) =>
      end > start,
    { path: ['end'], message: 'must agree with start' },
  );

  it('gives the issue a rule with the same options gives', () => {
    const input = { start: 3, end: 2 };
    const byConstraint = n.object({ start: PositiveInteger, end: PositiveInteger }, endAfterStart);
    const byRule = n.object({ start: PositiveInteger, end: PositiveInteger }).check(sameAsRule);

    expect(issuesOf(byConstraint.parse(input))).toStrictEqual(issuesOf(byRule.parse(input)));
    n.configure({ codes: true });
    expect(issuesOf(byConstraint.parse(input))).toStrictEqual([
      { code: 'constraint', message: 'must agree with start', path: ['end'] },
    ]);
    expect(issuesOf(byConstraint.parse(input))).toStrictEqual(issuesOf(byRule.parse(input)));
  });
});

describe('codegen off', () => {
  it('builds checks that report what the generated ones report', () => {
    const input = rowsOf(20, new Map([[7, 1]]));
    const Upload = n.object({ rows: Sheet });
    const generated = issuesOf(Upload.parse({ rows: input }));
    const built = configured({ codegen: 'off', maxIssues: 1 }, () => {
      const Fallback = n.object({ rows: n.of(Row).array().check(uniqueSku) });

      return {
        one: issuesOf(Fallback.parse({ rows: [...input, { sku: '', quantity: 0 }] })),
        all: configured({ maxIssues: 100 }, () => issuesOf(Fallback.parse({ rows: input }))),
      };
    });

    expect(built.all).toStrictEqual(generated);
    expect(built.one).toStrictEqual([
      { message: 'must be a non-empty string (was "")', path: ['rows', 20, 'sku'] },
      { message: 'stopped after 1 issues' },
    ]);
  });
});

describe('types', () => {
  it('types the value of a rule written in place, and the report', () => {
    n.of(Row)
      .array()
      .check((rows, report) => {
        expectTypeOf(rows).toEqualTypeOf<readonly Row[]>();
        expectTypeOf(report).toEqualTypeOf<Report>();
        expectTypeOf(report).parameter(0).toEqualTypeOf<RuleIssue>();
      });
    n.object({ id: Uuid }).check((value) => {
      expectTypeOf(value).toEqualTypeOf<{ readonly id: Uuid }>();
    });
  });

  it('takes a rule of a wider value, and refuses one of another', () => {
    const any = n.rule((_value: unknown) => true);

    expectTypeOf(any).toEqualTypeOf<Rule<unknown>>();
    const Ids = n.of(Uuid).array();

    expectTypeOf(Ids.check(any)).toEqualTypeOf<typeof Ids>();
    const emails = n.rule((_value: readonly Email[]) => true);

    // @ts-expect-error: the rule reads emails, the schema gives UUIDs
    Ids.check(emails);
    expectTypeOf<NominalIssue['code']>().toEqualTypeOf<AnyIssueCode | undefined>();
  });
});

describe('another copy of the package', () => {
  it('runs a rule built by one copy in a schema of the other, nested both ways', async () => {
    vi.resetModules();

    const copy = await import('../../src/index.ts');

    vi.resetModules();

    const fromCopy = copy.n.rule(pairs, { code: 'too_many' });
    const fromHere = n.rule(pairs, { code: 'too_many' });
    const issue = { code: 'too_many', message: 'too many', path: ['ids'] };

    expect(copy.n.rule).not.toBe(n.rule);
    expect(
      issuesOf(
        copy.n.object({ ids: n.of(Uuid).array().check(fromCopy) }).parse({ ids: [uuid, uuid] }),
      ),
    ).toStrictEqual([issue]);
    expect(
      issuesOf(
        n
          .object({ ids: copy.n.of(copy.Uuid).array().check(fromHere) })
          .parse({ ids: [uuid, uuid] }),
      ),
    ).toStrictEqual([issue]);
  });
});
