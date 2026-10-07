import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import { IsString, ValidateNested, validateSync } from 'class-validator';
import type { ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { NominalField } from '../../../src/adapters/class-validator/index.ts';
import { Email, PositiveInteger, schemaOf, Uuid } from '../../../src/index.ts';

const first = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

class ContactDto {
  @NominalField(Email)
  public email!: Email;
}

class OrderDto {
  @NominalField(Email)
  public contact!: Email;

  @NominalField(schemaOf(Uuid).array({ min: 1, max: 3 }))
  public items!: readonly Uuid[];

  @NominalField(schemaOf(Email).optional())
  public backup?: Email;

  @NominalField(schemaOf(Email).nullable())
  public replyTo!: Email | null;

  @IsString()
  public note!: string;

  @ValidateNested()
  @Type(() => ContactDto)
  public billing!: ContactDto;
}

const valid = {
  contact: 'jane@example.com',
  items: [first],
  replyTo: null,
  note: 'hi',
  billing: { email: 'bill@example.com' },
};

const build = <Dto extends object>(
  dto: new () => Dto,
  plain: object,
): { value: Dto; errors: ValidationError[] } => {
  const value = plainToInstance(dto, plain);
  return { value, errors: validateSync(value, { whitelist: true, forbidNonWhitelisted: true }) };
};

const messages = (errors: readonly ValidationError[]): string[] =>
  errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...messages(error.children ?? []).map((message) => `${error.property}.${message}`),
  ]);

describe('NominalField', () => {
  it('turns valid values into instances and passes validation', () => {
    const { value, errors } = build(OrderDto, valid);

    expect(errors).toStrictEqual([]);
    expect(value.contact).toBeInstanceOf(Email);
    expect(value.items[0]).toBeInstanceOf(Uuid);
    expect(Object.isFrozen(value.items)).toBe(true);
    expect(value.backup).toBeUndefined();
    expect(value.replyTo).toBeNull();
    expect(value.billing.email).toBeInstanceOf(Email);
  });

  it('reports a rejected value with the property and the type message', () => {
    expect(messages(build(OrderDto, { ...valid, contact: 'nope' }).errors)).toStrictEqual([
      'contact: must be an email address (was "nope")',
    ]);
  });

  it('reports every bad item of a list with its index', () => {
    expect(messages(build(OrderDto, { ...valid, items: [first, 'a', 'b'] }).errors)).toStrictEqual([
      'items.1: must be a UUID (was "a"); items.2: must be a UUID (was "b")',
    ]);
  });

  it('checks the size of a list', () => {
    expect(messages(build(OrderDto, { ...valid, items: [] }).errors)).toStrictEqual([
      'items: must have at least 1 item (was 0)',
    ]);
  });

  it('treats a missing property as invalid unless the schema is optional', () => {
    const { contact: _, ...withoutContact } = valid;

    expect(messages(build(OrderDto, withoutContact).errors)).toStrictEqual([
      'contact: must be a string (was undefined)',
    ]);
    expect(build(OrderDto, { ...valid, backup: 'b@example.com' }).value.backup).toBeInstanceOf(
      Email,
    );
    expect(messages(build(OrderDto, { ...valid, backup: null }).errors)).toStrictEqual([
      'backup: must be a string (was object)',
    ]);
  });

  it('prefixes the messages of a nested DTO', () => {
    expect(messages(build(OrderDto, { ...valid, billing: { email: 'x' } }).errors)).toStrictEqual([
      'billing.email: must be an email address (was "x")',
    ]);
  });

  it('counts as a known property for whitelist', () => {
    expect(messages(build(OrderDto, { ...valid, extra: 1 }).errors)).toStrictEqual([
      'property extra should not exist',
    ]);
  });

  it('validates a plain instance that was never transformed', () => {
    const dto = Object.assign(new ContactDto(), { email: 'jane@example.com' });

    expect(validateSync(dto)).toStrictEqual([]);
    expect(dto.email).toBe('jane@example.com');
  });

  it('reads strings when the schema asks for it', () => {
    class PageDto {
      @NominalField(schemaOf(PositiveInteger).fromString())
      public page!: PositiveInteger;
    }

    expect(build(PageDto, { page: '2' }).value.page).toStrictEqual(new PositiveInteger(2));
    expect(messages(build(PageDto, { page: '0' }).errors)).toStrictEqual([
      'page: must be a positive integer (was 0)',
    ]);
  });

  it('takes class-validator options', () => {
    class CustomDto {
      @NominalField(Email, { message: 'give us a real address' })
      public email!: Email;
    }

    expect(messages(build(CustomDto, { email: 'x' }).errors)).toStrictEqual([
      'give us a real address',
    ]);
  });

  it.each([String, {}, null, 'Email'])('refuses %o, which is not a type or a schema', (target) => {
    expect(() => {
      Reflect.apply(NominalField, undefined, [target]);
    }).toThrow(TypeError);
  });
});
