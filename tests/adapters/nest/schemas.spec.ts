import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { NominalPipe } from '../../../src/adapters/nest/index.ts';
import { AnyBoolean, Email, n, PositiveInteger, Uuid } from '../../../src/index.ts';
import { argument, first } from './support.ts';

describe('NominalPipe as a unit', () => {
  it('takes a n.of() schema in place of a type', () => {
    expect(new NominalPipe(n.of(Uuid).array()).transform([first], argument('query'))).toStrictEqual(
      [new Uuid(first)],
    );
  });

  it('wraps a lone query value for an array schema, also behind nullable()', () => {
    expect(new NominalPipe(n.of(Uuid).array()).transform(first, argument('query'))).toHaveLength(1);
    expect(
      new NominalPipe(n.of(Uuid).array().nullable()).transform(first, argument('query')),
    ).toHaveLength(1);
    expect(new NominalPipe(n.of(Uuid)).transform(first, argument('query'))).toBeInstanceOf(Uuid);
  });

  it("doesn't wrap a lone value outside a query string", () => {
    expect(() => new NominalPipe(n.of(Uuid).array()).transform(first, argument('body'))).toThrow(
      BadRequestException,
    );
  });

  it('reads query and route strings into number and boolean types', () => {
    const pipe = new NominalPipe();

    expect(pipe.transform('2', argument('query', { metatype: PositiveInteger }))).toStrictEqual(
      new PositiveInteger(2),
    );
    expect(pipe.transform('5', argument('param', { metatype: PositiveInteger }))).toStrictEqual(
      new PositiveInteger(5),
    );
    expect(pipe.transform('true', argument('query', { metatype: AnyBoolean }))).toStrictEqual(
      new AnyBoolean(true),
    );
  });

  it('leaves body strings as they are', () => {
    expect(() =>
      new NominalPipe().transform('2', argument('body', { metatype: PositiveInteger })),
    ).toThrow(BadRequestException);
  });

  it('stops reading strings when told so', () => {
    expect(() =>
      new NominalPipe({ fromString: false }).transform(
        '2',
        argument('query', { metatype: PositiveInteger }),
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      new NominalPipe(PositiveInteger, { fromString: false }).transform('2', argument('query')),
    ).toThrow(BadRequestException);
  });

  it('reads strings for a schema only through its fromString()', () => {
    expect(() => new NominalPipe(n.of(PositiveInteger)).transform('2', argument('query'))).toThrow(
      BadRequestException,
    );
    expect(
      new NominalPipe(n.of(PositiveInteger).fromString()).transform('2', argument('query')),
    ).toStrictEqual(new PositiveInteger(2));
  });

  it('takes a nominal type or a schema from the Nest 12 schema option', () => {
    const pipe = new NominalPipe();

    expect(pipe.transform(first, argument('query', { schema: Uuid }))).toBeInstanceOf(Uuid);
    expect(pipe.transform([first], argument('query', { schema: n.of(Uuid).array() }))).toHaveLength(
      1,
    );
  });

  it('leaves a schema from another library to its own pipe', () => {
    const foreign = {
      '~standard': { version: 1 as const, vendor: 'other', validate: () => ({ value: 'x' }) },
    };

    expect(new NominalPipe().transform('raw', argument('query', { schema: foreign }))).toBe('raw');
  });
});

// Bun and SWC record the schema itself as the parameter type when a type alias shares its name.
const recorded = (
  type: ArgumentMetadata['type'],
  schema: unknown,
  data = 'value',
): ArgumentMetadata => Object.assign(argument(type, { data }), { metatype: schema });

describe('NominalPipe with a schema recorded as the parameter type', () => {
  const CreateOrder = n.object({ customer: Email, quantity: PositiveInteger });
  const pipe = new NominalPipe();

  it('checks a body against an n.object() schema', () => {
    const order: unknown = pipe.transform(
      { customer: 'jane@example.com', quantity: 2 },
      recorded('body', CreateOrder),
    );

    expect(order).toStrictEqual({
      customer: new Email('jane@example.com'),
      quantity: new PositiveInteger(2),
    });
  });

  it('rejects a bad body with the field in the message', () => {
    expect(() =>
      pipe.transform({ customer: 'jane', quantity: 2 }, recorded('body', CreateOrder)),
    ).toThrow(BadRequestException);
    expect(() => pipe.transform(undefined, recorded('body', CreateOrder))).toThrow(
      BadRequestException,
    );
  });

  it('accepts a body it already checked, as a pipe on the parameter gives it again', () => {
    const order = pipe.transform(
      { customer: 'jane@example.com', quantity: 2 },
      recorded('body', CreateOrder),
    );

    expect(new NominalPipe(CreateOrder).transform(order, argument('body'))).toStrictEqual(order);
  });

  it('lets the schema decide whether a value may be missing', () => {
    expect(pipe.transform(undefined, recorded('query', n.of(Email).optional()))).toBeUndefined();
    expect(() => pipe.transform(undefined, recorded('query', n.of(Email)))).toThrow(
      BadRequestException,
    );
  });

  it('wraps a lone query value for an array schema', () => {
    expect(pipe.transform(first, recorded('query', n.of(Uuid).array()))).toStrictEqual([
      new Uuid(first),
    ]);
  });

  it('leaves a schema from another library to its own pipe', () => {
    const foreign = {
      '~standard': { version: 1 as const, vendor: 'other', validate: () => ({ value: 'x' }) },
    };

    expect(pipe.transform('raw', recorded('body', foreign))).toBe('raw');
  });

  it('prefers the Nest 12 schema option over the recorded type', () => {
    const metadata = { ...recorded('query', n.of(Email)), schema: n.of(Email).optional() };

    expect(pipe.transform(undefined, metadata)).toBeUndefined();
  });
});
