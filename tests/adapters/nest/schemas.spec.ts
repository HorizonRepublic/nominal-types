import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { NominalPipe } from '../../../src/adapters/nest/index.ts';
import { AnyBoolean, PositiveInteger, schemaOf, Uuid } from '../../../src/index.ts';
import { argument, first } from './support.ts';

describe('NominalPipe as a unit', () => {
  it('takes a schemaOf() schema in place of a type', () => {
    expect(
      new NominalPipe(schemaOf(Uuid).array()).transform([first], argument('query')),
    ).toStrictEqual([new Uuid(first)]);
  });

  it('wraps a lone query value for an array schema, also behind nullable()', () => {
    expect(
      new NominalPipe(schemaOf(Uuid).array()).transform(first, argument('query')),
    ).toHaveLength(1);
    expect(
      new NominalPipe(schemaOf(Uuid).array().nullable()).transform(first, argument('query')),
    ).toHaveLength(1);
    expect(new NominalPipe(schemaOf(Uuid)).transform(first, argument('query'))).toBeInstanceOf(
      Uuid,
    );
  });

  it("doesn't wrap a lone value outside a query string", () => {
    expect(() =>
      new NominalPipe(schemaOf(Uuid).array()).transform(first, argument('body')),
    ).toThrow(BadRequestException);
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
    expect(() =>
      new NominalPipe(schemaOf(PositiveInteger)).transform('2', argument('query')),
    ).toThrow(BadRequestException);
    expect(
      new NominalPipe(schemaOf(PositiveInteger).fromString()).transform('2', argument('query')),
    ).toStrictEqual(new PositiveInteger(2));
  });

  it('takes a nominal type or a schema from the Nest 12 schema option', () => {
    const pipe = new NominalPipe();

    expect(pipe.transform(first, argument('query', { schema: Uuid }))).toBeInstanceOf(Uuid);
    expect(
      pipe.transform([first], argument('query', { schema: schemaOf(Uuid).array() })),
    ).toHaveLength(1);
  });

  it('leaves a schema from another library to its own pipe', () => {
    const foreign = {
      '~standard': { version: 1 as const, vendor: 'other', validate: () => ({ value: 'x' }) },
    };

    expect(new NominalPipe().transform('raw', argument('query', { schema: foreign }))).toBe('raw');
  });
});
