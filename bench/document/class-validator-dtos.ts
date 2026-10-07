import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
  ValidateNested,
  validateSync,
} from 'class-validator';

import { NominalField } from '../../src/adapters/class-validator/index.ts';
import { Email, NonNegativeInteger, PositiveInteger, Uuid } from '../../src/index.ts';
import { CountryCode, Postcode, Sku } from './types.ts';

// Decorators are applied by hand: the bench runs on Node's type stripping, which has no decorator
// syntax.
const decorate = (target: object, property: string, ...decorators: PropertyDecorator[]): void => {
  for (const decorator of decorators) {
    decorator(target, property);
  }
};

const classValidatorOf =
  (root: new () => object): ((input: unknown) => unknown) =>
  (input) =>
    validateSync(plainToInstance(root, typeof input === 'object' && input !== null ? input : {}));

export const nominalWithClassValidator = (() => {
  class AddressDto {}
  decorate(AddressDto.prototype, 'country', NominalField(CountryCode));
  decorate(AddressDto.prototype, 'postcode', NominalField(Postcode));
  decorate(AddressDto.prototype, 'line', IsString(), MinLength(1));

  class CustomerDto {}
  decorate(CustomerDto.prototype, 'id', NominalField(Uuid));
  decorate(CustomerDto.prototype, 'email', NominalField(Email));
  decorate(CustomerDto.prototype, 'name', IsString(), MinLength(1));
  decorate(
    CustomerDto.prototype,
    'addresses',
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => AddressDto),
  );

  class ItemDto {}
  decorate(ItemDto.prototype, 'sku', NominalField(Sku));
  decorate(ItemDto.prototype, 'quantity', NominalField(PositiveInteger));
  decorate(ItemDto.prototype, 'priceMinor', NominalField(NonNegativeInteger));

  class OrderDto {}
  decorate(OrderDto.prototype, 'id', NominalField(Uuid));
  decorate(OrderDto.prototype, 'customerId', NominalField(Uuid));
  decorate(OrderDto.prototype, 'status', IsIn(['new', 'paid', 'shipped']));
  decorate(
    OrderDto.prototype,
    'items',
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => ItemDto),
  );
  decorate(OrderDto.prototype, 'tags', IsArray(), IsString({ each: true }));

  class DocumentDto {}
  decorate(DocumentDto.prototype, 'exportId', NominalField(Uuid));
  decorate(
    DocumentDto.prototype,
    'customers',
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => CustomerDto),
  );
  decorate(
    DocumentDto.prototype,
    'orders',
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => OrderDto),
  );

  return classValidatorOf(DocumentDto);
})();

export const plainClassValidator = (() => {
  class AddressDto {}
  decorate(AddressDto.prototype, 'country', Matches(/^[A-Z]{2}$/u));
  decorate(AddressDto.prototype, 'postcode', Matches(/^\d{5}$/u));
  decorate(AddressDto.prototype, 'line', IsString(), MinLength(1));

  class CustomerDto {}
  decorate(CustomerDto.prototype, 'id', IsUUID('all'));
  decorate(CustomerDto.prototype, 'email', IsEmail());
  decorate(CustomerDto.prototype, 'name', IsString(), MinLength(1));
  decorate(
    CustomerDto.prototype,
    'addresses',
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => AddressDto),
  );

  class ItemDto {}
  decorate(ItemDto.prototype, 'sku', Matches(/^SKU-\d{4}$/u));
  decorate(ItemDto.prototype, 'quantity', IsInt(), Min(1));
  decorate(ItemDto.prototype, 'priceMinor', IsInt(), Min(0));

  class OrderDto {}
  decorate(OrderDto.prototype, 'id', IsUUID('all'));
  decorate(OrderDto.prototype, 'customerId', IsUUID('all'));
  decorate(OrderDto.prototype, 'status', IsIn(['new', 'paid', 'shipped']));
  decorate(
    OrderDto.prototype,
    'items',
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => ItemDto),
  );
  decorate(OrderDto.prototype, 'tags', IsArray(), IsString({ each: true }));

  class DocumentDto {}
  decorate(DocumentDto.prototype, 'exportId', IsUUID('all'));
  decorate(
    DocumentDto.prototype,
    'customers',
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => CustomerDto),
  );
  decorate(
    DocumentDto.prototype,
    'orders',
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => OrderDto),
  );

  return classValidatorOf(DocumentDto);
})();
