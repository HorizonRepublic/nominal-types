import {
  graphql,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  parseValue,
} from 'graphql';
import type { ExecutionResult, GraphQLFieldConfig } from 'graphql';
import { describe, expect, it } from 'vitest';

import { toGraphQL } from '../../src/adapters/graphql/index.ts';
import { AnyBoolean, Email, Int64, n, Nominal, PositiveInteger } from '../../src/index.ts';

const EmailScalar = toGraphQL(Email, { serialize: (email) => email.canonical().value });
const BigScalar = toGraphQL(Int64);
const CountScalar = toGraphQL(PositiveInteger);
const FlagScalar = toGraphQL(AnyBoolean);

const seen: unknown[] = [];

const echo = (scalar: EchoScalar): GraphQLFieldConfig<unknown, unknown> => ({
  type: scalar,
  args: { value: { type: scalar } },
  resolve: (_source, args: Readonly<Record<string, unknown>>) => {
    seen.push(args['value']);

    return args['value'];
  },
});

type EchoScalar = typeof EmailScalar | typeof BigScalar | typeof CountScalar | typeof FlagScalar;

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      email: echo(EmailScalar),
      big: echo(BigScalar),
      count: echo(CountScalar),
      flag: echo(FlagScalar),
      raw: { type: new GraphQLNonNull(EmailScalar), resolve: () => 'Jane@Example.com' },
      bad: { type: EmailScalar, resolve: () => 'nope' },
      text: { type: GraphQLString, resolve: () => 'x' },
    },
  }),
});

const run = (source: string, variableValues?: Record<string, unknown>): Promise<ExecutionResult> =>
  graphql({ schema, source, ...(variableValues === undefined ? {} : { variableValues }) });

describe('toGraphQL', () => {
  it('names the scalar after the last part of the type and describes it', () => {
    expect(EmailScalar.name).toBe('Email');
    expect(EmailScalar.description).toBe('an email address');
    expect(EmailScalar.extensions).toMatchObject({ jsonSchema: { format: 'email' } });
    expect(
      toGraphQL(Email, { name: 'Mail', description: 'mail', specifiedByURL: 'https://x' }),
    ).toMatchObject({
      name: 'Mail',
      description: 'mail',
      specifiedByURL: 'https://x',
    });
  });

  it('turns literal arguments into instances and sends them back', async () => {
    seen.length = 0;

    expect(
      await run('{ email(value: "Jane@Example.com") count(value: 3) flag(value: true) }'),
    ).toEqual({
      data: { email: 'jane@example.com', count: 3, flag: true },
    });
    expect(seen).toStrictEqual([
      new Email('Jane@Example.com'),
      new PositiveInteger(3),
      new AnyBoolean(true),
    ]);
  });

  it('reads big integer literals without losing digits', async () => {
    expect(await run('{ big(value: 9007199254740993) }')).toEqual({
      data: { big: '9007199254740993' },
    });
    expect(await run('{ big(value: "9007199254740993") }')).toEqual({
      data: { big: '9007199254740993' },
    });
  });

  it('turns variables into instances', async () => {
    expect(await run('query ($e: Email) { email(value: $e) }', { e: 'a@b.co' })).toEqual({
      data: { email: 'a@b.co' },
    });
    expect(await run('query ($b: Int64) { big(value: $b) }', { b: 42 })).toEqual({
      data: { big: '42' },
    });
  });

  it('refuses bad literals and variables with the type message', async () => {
    expect((await run('{ email(value: "nope") }')).errors?.[0]?.message).toBe(
      'Email: must be an email address (was a string of 4 characters)',
    );
    expect(
      (await run('query ($e: Email) { email(value: $e) }', { e: 'nope' })).errors?.[0]?.message,
    ).toBe(
      'Variable "$e" has invalid value: Email: must be an email address (was a string of 4 characters)',
    );
  });

  it('sends a plain result the type accepts, and refuses one it does not', async () => {
    expect(await run('{ raw }')).toEqual({ data: { raw: 'jane@example.com' } });
    expect((await run('{ bad }')).errors?.[0]?.message).toBe(
      'Email: must be an email address (was a string of 4 characters)',
    );
  });

  it('leaves values out of error messages with n.hideValues', () => {
    const hidden = toGraphQL(PositiveInteger, { hideValues: true });

    // oxlint-disable-next-line typescript/no-deprecated
    expect(() => hidden.parseValue(-5)).toThrow(
      'PositiveInteger: must be a positive integer (was a number)',
    );
    // oxlint-disable-next-line typescript/no-deprecated
    expect(() => CountScalar.parseValue(-5)).toThrow(
      'PositiveInteger: must be a positive integer (was -5)',
    );
  });

  it('keeps the GraphQL 16 methods working', () => {
    // GraphQL 16 calls these; 17 calls the coerce methods the other tests go through.
    // oxlint-disable-next-line typescript/no-deprecated
    expect(EmailScalar.parseLiteral(parseValue('"a@b.co"'), undefined)).toStrictEqual(
      new Email('a@b.co'),
    );
    // oxlint-disable-next-line typescript/no-deprecated
    expect(EmailScalar.parseValue('a@b.co')).toStrictEqual(new Email('a@b.co'));
    // oxlint-disable-next-line typescript/no-deprecated
    expect(EmailScalar.serialize(new Email('A@B.co'))).toBe('a@b.co');
  });

  it('names a scalar for a type declared without a description', () => {
    const Even = Nominal(
      'gql.even-number',
      n.satisfying((value: unknown): value is number => value === 2, 'two'),
    );
    const Pair = Nominal('gql.Pair', n.object({ a: PositiveInteger }));

    expect(toGraphQL(Even)).toMatchObject({ name: 'even_number', description: 'two' });
    expect(toGraphQL(Pair)).toMatchObject({ name: 'Pair', description: null });
  });
});
