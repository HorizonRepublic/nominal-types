import { describe, expect, it, vi } from 'vitest';

import type { IssueDetails } from '../../src/index.ts';
import { n, Uuid } from '../../src/index.ts';
import { configured, resetConfigurationAfterEach } from '../support/configuration.ts';
import { issuesOf } from '../support/results.ts';
import { uuid } from '../support/rule-fixtures.ts';

resetConfigurationAfterEach();

const Ids = n.of(Uuid).array();

const reporting = (count: number): typeof Ids =>
  Ids.check((_ids, report) => {
    for (let index = 0; index < count; index += 1) {
      report({ path: [index], code: 'bad' });
    }
  });

describe('codes and messages', () => {
  const Rows = n
    .of(Uuid)
    .array()
    .check((_ids, report) => {
      report({ path: [0], code: 'duplicate_sku', params: { row: 1 } });
      report({ path: [1], message: 'no code' });
    });

  it('keeps a code of the rule without codes: true, and the built-in code only with it', () => {
    expect(issuesOf(Rows.parse([uuid]))).toStrictEqual([
      { code: 'duplicate_sku', message: 'is invalid', path: [0] },
      { message: 'no code', path: [1] },
    ]);
    n.configure({ codes: true });
    expect(issuesOf(Rows.parse([uuid]))).toStrictEqual([
      { code: 'duplicate_sku', message: 'is invalid', path: [0] },
      { code: 'constraint', message: 'no code', path: [1] },
    ]);
  });

  it('hands a messages function the code, the message, the path and the params', () => {
    const messages = vi.fn<(issue: IssueDetails) => string | undefined>();

    configured({ messages }, () => Rows.parse([uuid]));

    expect(messages.mock.calls.map(([issue]) => issue)).toStrictEqual([
      { code: 'duplicate_sku', message: 'is invalid', path: [0], params: { row: 1 } },
      { code: 'constraint', message: 'no code', path: [1] },
    ]);
  });

  it('writes a code-less issue with the message map entry for constraint', () => {
    n.configure({ messages: { constraint: 'stimmt nicht' } });

    expect(issuesOf(Rows.parse([uuid])).map(({ message }) => message)).toStrictEqual([
      'is invalid',
      'stimmt nicht',
    ]);
  });

  it('reads only the own keys of a messages map', () => {
    const Inherited = n
      .of(Uuid)
      .array()
      .check((_ids, report) => {
        report({ code: 'toString', message: 'kept' });
      });

    n.configure({ messages: { required: 'fehlt' } });

    expect(issuesOf(Inherited.parse([uuid]))).toStrictEqual([
      { code: 'toString', message: 'kept' },
    ]);
  });

  it('passes params as given under values: hide, and keeps the message of the rule', () => {
    const messages = vi.fn<(issue: IssueDetails) => string | undefined>();

    configured({ messages, values: 'hide' }, () => Rows.parse([uuid]));

    expect(messages.mock.calls[0]?.[0].params).toStrictEqual({ row: 1 });
  });
});

describe('maxIssues', () => {
  it('keeps every issue up to the limit', () => {
    n.configure({ maxIssues: 5 });

    expect(issuesOf(reporting(5).parse([uuid]))).toHaveLength(5);
  });

  it('stops one issue past the limit and says so', () => {
    n.configure({ maxIssues: 5 });

    const issues = issuesOf(reporting(6).parse([uuid]));

    expect(issues).toHaveLength(6);
    expect(issues[4]).toStrictEqual({ code: 'bad', message: 'is invalid', path: [4] });
    expect(issues[5]).toStrictEqual({ message: 'stopped after 5 issues' });
    n.configure({ codes: true });
    expect(issuesOf(reporting(6).parse([uuid]))[5]).toStrictEqual({
      code: 'too_many_issues',
      message: 'stopped after 5 issues',
    });
  });

  it('stops checking the items of an array at the limit', () => {
    n.configure({ maxIssues: 5 });

    const Items = n.of(Uuid).array();

    expect(issuesOf(Items.parse(Array.from({ length: 5 }, () => 'x')))).toHaveLength(5);
    expect(issuesOf(Items.parse(Array.from({ length: 1000 }, () => 'x'))).at(-1)).toStrictEqual({
      message: 'stopped after 5 issues',
    });
  });

  it('holds at 100 by default, and Infinity keeps every issue', () => {
    const bad = Array.from({ length: 150 }, () => 'x');

    expect(issuesOf(n.of(Uuid).array().parse(bad))).toHaveLength(101);
    n.configure({ maxIssues: Number.POSITIVE_INFINITY });
    expect(issuesOf(n.of(Uuid).array().parse(bad))).toHaveLength(150);
  });

  it('counts the issues of nested schemas once, with one issue saying it stopped', () => {
    n.configure({ maxIssues: 3 });

    const Upload = n.object({ first: n.of(Uuid).array(), second: n.of(Uuid).array() });
    const issues = issuesOf(Upload.parse({ first: ['x', 'x', 'x', 'x'], second: ['x', 'x'] }));

    expect(issues).toStrictEqual([
      { message: 'must be a UUID (was "x")', path: ['first', 0] },
      { message: 'must be a UUID (was "x")', path: ['first', 1] },
      { message: 'must be a UUID (was "x")', path: ['first', 2] },
      { message: 'stopped after 3 issues' },
    ]);
  });

  it('runs no further rule once the limit is reached', () => {
    n.configure({ maxIssues: 2 });

    const later = vi.fn<() => boolean>(() => true);
    const Checked = reporting(3).check(later);

    expect(issuesOf(Checked.parse([uuid]))).toHaveLength(3);
    expect(later).not.toHaveBeenCalled();
  });
});
