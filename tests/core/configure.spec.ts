import { inspect } from 'node:util';

import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import { Email, n, Nominal, PositiveInteger, Uuid } from '../../src/index.ts';
import { configured, resetConfigurationAfterEach } from '../support/configuration.ts';
import { issuesOf } from '../support/results.ts';

type Library = typeof library;

const uuid = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

const anotherCopy = (): Promise<Library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

const messages = (): string => 'bad';

resetConfigurationAfterEach();

describe('n.configure()', () => {
  it('starts from settings that keep the package as it is', () => {
    expect(n.configure()).toStrictEqual({
      messages: undefined,
      values: 'show',
      inspect: 'show',
      normalize: { trimStrings: false },
      codes: false,
      codegen: 'auto',
      maxIssues: 100,
      logger: undefined,
    });
    expect(issuesOf(Uuid.parse('nope'))).toStrictEqual([
      { message: 'must be a UUID (was "nope")' },
    ]);
  });

  it('returns every setting as it was, frozen, so a test can put them back', () => {
    const previous = n.configure({ values: 'hide', codes: true });

    expect(Object.isFrozen(previous)).toBe(true);
    expect(Object.isFrozen(previous.normalize)).toBe(true);
    expect(previous.values).toBe('show');
    expect(n.configure(previous)).toMatchObject({
      values: 'hide',
      codes: true,
    });
    expect(n.configure()).toMatchObject({ values: 'show', codes: false });
  });

  it('changes only the options it names', () => {
    n.configure({ values: 'length', messages });
    n.configure({ normalize: { trimStrings: true } });
    n.configure({ codes: true, normalize: {} });

    expect(n.configure()).toStrictEqual({
      messages,
      values: 'length',
      inspect: 'show',
      normalize: { trimStrings: true },
      codes: true,
      codegen: 'auto',
      maxIssues: 100,
      logger: undefined,
    });
  });

  it('ignores an option given as undefined, except messages, which goes back to English', () => {
    n.configure({ values: 'hide', messages: () => 'bad' });
    n.configure({ values: undefined, messages: undefined });

    expect(n.configure()).toMatchObject({
      values: 'hide',
      messages: undefined,
    });
  });

  it.each<[string, unknown, string]>([
    ['an unknown option', { value: 'hide' }, 'n.configure(): there is no option value'],
    [
      'a value not offered',
      { values: 'mask' },
      'n.configure(): values must be "show", "length" or "hide"',
    ],
    ['inspect as a boolean', { inspect: true }, 'n.configure(): inspect must be "show" or "hide"'],
    ['codes as a string', { codes: 'yes' }, 'n.configure(): codes must be true or false'],
    ['codegen as a boolean', { codegen: false }, 'n.configure(): codegen must be "auto" or "off"'],
    [
      'messages as a string',
      { messages: 'uk' },
      'n.configure(): messages must be a function, a map by issue code or undefined',
    ],
    [
      'messages as an array',
      { messages: [] },
      'n.configure(): messages must be a function, a map by issue code or undefined',
    ],
    [
      'a messages map with an object',
      { messages: { duplicate_sku: {} } },
      'n.configure(): messages.duplicate_sku must be a string or a function',
    ],
    [
      'maxIssues of 0',
      { maxIssues: 0 },
      'n.configure(): maxIssues must be a whole number from 1 up, or Infinity',
    ],
    [
      'maxIssues of 1.5',
      { maxIssues: 1.5 },
      'n.configure(): maxIssues must be a whole number from 1 up, or Infinity',
    ],
    [
      'maxIssues as a string',
      { maxIssues: '10' },
      'n.configure(): maxIssues must be a whole number from 1 up, or Infinity',
    ],
    [
      'maxIssues of NaN',
      { maxIssues: Number.NaN },
      'n.configure(): maxIssues must be a whole number from 1 up, or Infinity',
    ],
    [
      'a messages map with a number',
      { messages: { required: 1 } },
      'n.configure(): messages.required must be a string or a function',
    ],
    [
      'normalize as true',
      { normalize: true },
      'n.configure(): normalize must be an object, such as { trimStrings: true }',
    ],
    [
      'normalize as null',
      { normalize: null },
      'n.configure(): normalize must be an object, such as { trimStrings: true }',
    ],
    [
      'an unknown normalization',
      { normalize: { lowerCase: true } },
      'n.configure(): there is no option normalize.lowerCase',
    ],
    [
      'trimStrings as a string',
      { normalize: { trimStrings: 'yes' } },
      'n.configure(): normalize.trimStrings must be true or false',
    ],
  ])('refuses %s and changes nothing', (_, options, message) => {
    // The options are wrong on purpose.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    expect(() => n.configure({ codes: true, ...(options as object) })).toThrow(
      new TypeError(message),
    );
    expect(n.configure().codes).toBe(false);
  });

  it.each(['hide', null, 1])('refuses %j in place of an object of options', (options) => {
    // The options are wrong on purpose.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    expect(() => n.configure(options as never)).toThrow(
      new TypeError('n.configure(): pass an object of options'),
    );
  });

  it('is shared by another copy of the package, such as the CommonJS one', async () => {
    const copy = await anotherCopy();

    copy.n.configure({ codes: true });

    expect(issuesOf(Uuid.parse('nope'))).toStrictEqual([
      { code: 'pattern', message: 'must be a UUID (was "nope")' },
    ]);
    expect(issuesOf(n.object({ id: copy.Uuid }).parse({ id: 'nope' }))).toStrictEqual([
      { code: 'pattern', message: 'must be a UUID (was "nope")', path: ['id'] },
    ]);
    expect(n.configure().codes).toBe(true);
  });

  it('keeps the code of an issue from another copy inside an object of this one', async () => {
    const copy = await anotherCopy();
    const Pair = n.object({ ids: copy.n.of(copy.Uuid).array() });

    n.configure({ codes: true });

    expect(issuesOf(Pair.parse({ ids: ['nope'] }))).toStrictEqual([
      {
        code: 'pattern',
        message: 'must be a UUID (was "nope")',
        path: ['ids', 0],
      },
    ]);
  });
});

describe('inspect', () => {
  it('hides the value of every instance with inspect: hide', () => {
    const Pair = Nominal('configure.Pair', n.object({ count: PositiveInteger }));

    configured({ inspect: 'hide' }, () => {
      expect(inspect(new Uuid(uuid))).toBe('Uuid { value: <hidden, a string of 36 characters> }');
      expect(inspect(new PositiveInteger(3))).toBe('PositiveInteger { value: <hidden, a number> }');
      expect(inspect(new Pair({ count: 3 }))).toBe('configure.Pair { value: <hidden, an object> }');
    });

    expect(inspect(new Uuid(uuid))).toBe(`Uuid { value: '${uuid}' }`);
    expect(inspect(new Email('jane@example.com'))).toBe(
      'Email { value: <hidden, a string of 16 characters> }',
    );
  });

  it('leaves what toString() and JSON give as they are', () => {
    configured({ inspect: 'hide' }, () => {
      expect(String(new Uuid(uuid))).toBe(uuid);
      expect(JSON.stringify(new Uuid(uuid))).toBe(`"${uuid}"`);
    });
  });
});
