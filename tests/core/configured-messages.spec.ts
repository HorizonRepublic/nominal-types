import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { toArk } from '../../src/adapters/arktype/index.ts';
import { NominalPipe } from '../../src/adapters/nest/index.ts';
import type { Configuration, IssueDetails, NominalIssue } from '../../src/index.ts';
import {
  AnyString,
  Email,
  n,
  Nominal,
  PatternSchema,
  PositiveInteger,
  Uuid,
} from '../../src/index.ts';
import { configured, resetConfigurationAfterEach } from '../support/configuration.ts';
import { issuesOf, thrownBy } from '../support/results.ts';

resetConfigurationAfterEach();

const ukrainian = ({ code, description, value }: IssueDetails): string | undefined => {
  const descriptions: Readonly<Record<string, string>> = {
    'a UUID': 'UUID',
    'an email address': 'адреса електронної пошти',
  };

  if (code === 'required') {
    return "обов'язкове поле";
  }

  const expected = description === undefined ? undefined : descriptions[description];

  if (expected === undefined) {
    return undefined;
  }

  return value === undefined ? `має бути ${expected}` : `має бути ${expected} (було ${value})`;
};

const shout = ({ message }: IssueDetails): string => message.toUpperCase();

const messagesOf = (issues: readonly NominalIssue[]): readonly string[] =>
  issues.map(({ message }) => message);

const Sku = AnyString.subtype('messages.Sku', /^[A-Z]{3}-\d{4}$/u, {});
const Name = Nominal('messages.Name', z.string().min(2, 'too short (was "a")'));
const Order = n.object({
  id: Uuid,
  customer: Email,
  quantity: PositiveInteger,
});
const badOrder = { id: 'nope', customer: 'jane', quantity: 0 };

describe('values: what messages show of the rejected value', () => {
  it.each<[Configuration['values'], readonly string[]]>([
    [
      'show',
      [
        'must be a UUID (was "nope")',
        'must be an email address (was a string of 4 characters)',
        'must be a positive integer (was 0)',
      ],
    ],
    [
      'length',
      [
        'must be a UUID (was a string of 4 characters)',
        'must be an email address (was a string of 4 characters)',
        'must be a positive integer (was a number)',
      ],
    ],
    ['hide', ['must be a UUID', 'must be an email address', 'must be a positive integer']],
  ])('%s', (values, messages) => {
    const issues = configured({ values }, () => issuesOf(Order.parse(badOrder)));

    expect(messagesOf(issues)).toStrictEqual(messages);
  });

  it('keeps the count of items, which is not the value', () => {
    configured({ values: 'hide' }, () => {
      expect(messagesOf(issuesOf(n.of(Uuid).array({ max: 0 }).parse(['x'])))).toStrictEqual([
        'must have at most 0 items (was 1)',
      ]);
      expect(
        messagesOf(issuesOf(n.of(Sku).array({ unique: true }).parse(['ABC-0001', 'ABC-0001']))),
      ).toStrictEqual(['must not repeat an item']);
    });
  });

  it('applies to the messages of a rule from another library', () => {
    expect(
      configured({ values: 'length' }, () => messagesOf(issuesOf(Name.parse('a')))),
    ).toStrictEqual(['too short (was a string of 1 character)']);
    expect(
      configured({ values: 'hide' }, () => messagesOf(issuesOf(Name.parse('a')))),
    ).toStrictEqual(['too short']);
    expect(
      configured({ values: 'hide' }, () =>
        messagesOf(issuesOf(n.object({ name: z.string() }).parse({ name: 1 }))),
      ),
    ).toHaveLength(1);
  });

  it('applies to a type built on ArkType', () => {
    const Code = Nominal('messages.Code', toArk(Sku));

    expect(
      configured({ values: 'hide' }, () => messagesOf(issuesOf(Code.parse('x')))),
    ).toStrictEqual(['must be matched by ^[A-Z]{3}-\\d{4}$']);
  });

  it('hides values of a sensitive type with hide too', () => {
    expect(
      configured({ values: 'hide' }, () => messagesOf(issuesOf(Email.parse('jane')))),
    ).toStrictEqual(['must be an email address']);
  });

  it('applies to a rule whose message is its own', () => {
    class Flagged extends PatternSchema {
      public override messageFor(value: unknown): string {
        return `is not flagged (was ${JSON.stringify(String(value))})`;
      }
    }

    const Flag = Nominal('messages.Flag', new Flagged(/^flag$/u));

    expect(
      configured({ values: 'hide' }, () => messagesOf(issuesOf(Flag.parse('x')))),
    ).toStrictEqual(['is not flagged (was "x")']);
  });
});

describe('messages: a function that writes each message', () => {
  it('writes the messages it returns and keeps English where it returns undefined', () => {
    const issues = configured({ messages: ukrainian }, () =>
      issuesOf(Order.parse({ id: 'nope', customer: 'jane', quantity: 0 })),
    );

    expect(issues).toStrictEqual([
      { message: 'має бути UUID (було "nope")', path: ['id'] },
      {
        message: 'має бути адреса електронної пошти (було a string of 4 characters)',
        path: ['customer'],
      },
      { message: 'must be a positive integer (was 0)', path: ['quantity'] },
    ]);
    expect(configured({ messages: ukrainian }, () => issuesOf(Order.parse({})))).toStrictEqual([
      { message: "обов'язкове поле", path: ['id'] },
      { message: "обов'язкове поле", path: ['customer'] },
      { message: "обов'язкове поле", path: ['quantity'] },
    ]);
  });

  it('receives the code, the English message, the description, the value and the type', () => {
    const messages = vi.fn<(issue: IssueDetails) => string | undefined>();
    const Ids = n.of(Uuid).array({ min: 2, max: 3 });
    const Item = n.object({ id: Uuid });

    configured({ messages }, () => {
      Uuid.parse('nope');
      Ids.parse([]);
      Item.parse({});
      Email.parse('jane');
    });

    expect(messages.mock.calls.map(([issue]) => issue)).toStrictEqual([
      {
        code: 'pattern',
        message: 'must be a UUID (was "nope")',
        description: 'a UUID',
        value: '"nope"',
        typeName: 'nominal.Uuid',
      },
      {
        code: 'too_few_items',
        message: 'must have at least 2 items (was 0)',
        value: '0',
        min: 2,
        max: 3,
      },
      { code: 'required', message: 'is required', path: ['id'] },
      {
        code: 'pattern',
        message: 'must be an email address (was a string of 4 characters)',
        description: 'an email address',
        value: 'a string of 4 characters',
        typeName: 'nominal.Email',
      },
    ]);
  });

  it('receives no value with values: hide', () => {
    const messages = vi.fn<(issue: IssueDetails) => string | undefined>();

    configured({ messages, values: 'hide' }, () => Uuid.parse('nope'));

    expect(messages).toHaveBeenCalledWith({
      code: 'pattern',
      message: 'must be a UUID',
      description: 'a UUID',
      typeName: 'nominal.Uuid',
    });
  });

  it('is asked again with the value hidden where values are hidden afterwards', () => {
    const Env = n.object({ ID: Uuid }).fromEnv();

    configured({ messages: ukrainian }, () => {
      const issues = issuesOf(Order.parse({ id: 'nope', customer: 'jane', quantity: 0 }));

      expect(messagesOf(n.hideValues(issues))).toStrictEqual([
        'має бути UUID (було a string of 4 characters)',
        'має бути адреса електронної пошти (було a string of 4 characters)',
        'must be a positive integer (was a number)',
      ]);
      expect(messagesOf(n.hideValues(n.hideValues(issues)))).toStrictEqual(
        messagesOf(n.hideValues(issues)),
      );
      expect(messagesOf(issuesOf(Env.parse({ ID: 'secret' })))).toStrictEqual([
        'має бути UUID (було a string of 6 characters)',
      ]);
      expect(
        thrownBy(() =>
          new NominalPipe({ hideValues: true }).transform('secret', {
            type: 'param',
            data: 'id',
            metatype: Uuid,
          }),
        ),
      ).toHaveProperty('response.message', ['id: має бути UUID (було a string of 6 characters)']);
    });
  });

  it('writes the messages of constraints, counts and repeats too', () => {
    const Range = n.object(
      { low: PositiveInteger, high: PositiveInteger },
      n.constraint(
        { low: PositiveInteger, high: PositiveInteger },
        ({ low, high }) => low.value <= high.value,
      ),
    );

    configured({ messages: shout }, () => {
      expect(messagesOf(issuesOf(Range.parse({ low: 2, high: 1 })))).toStrictEqual([
        'LOW, HIGH MUST AGREE',
      ]);
      expect(
        messagesOf(issuesOf(n.of(Sku).array({ unique: true }).parse(['ABC-0001', 'ABC-0001']))),
      ).toStrictEqual(['MUST NOT REPEAT AN ITEM (WAS "ABC-0001")']);
      expect(messagesOf(issuesOf(n.object({}).strict().parse({ a: 1 })))).toStrictEqual([
        'IS NOT ALLOWED',
      ]);
    });
  });

  it('leaves the messages of another library to that library', () => {
    expect(
      configured({ messages: shout }, () => messagesOf(issuesOf(Name.parse('a')))),
    ).toStrictEqual(['too short (was "a")']);
  });

  it('passes on the issues of another library inside an object as they are', () => {
    const Profile = n.object({ name: z.string().min(2, 'too short') });

    expect(
      configured({ messages: shout }, () => issuesOf(Profile.parse({ name: 'a' }))),
    ).toStrictEqual([{ message: 'too short', path: ['name'] }]);
  });

  it('gives the code with values hidden', () => {
    expect(
      configured({ codes: true, values: 'hide' }, () => issuesOf(n.object({}).parse(1))),
    ).toStrictEqual([{ code: 'not_an_object', message: 'must be an object' }]);
  });
});
