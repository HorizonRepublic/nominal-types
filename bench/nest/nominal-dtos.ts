import {
  AnyString,
  Email,
  NonNegativeInteger,
  PositiveInteger,
  Uuid,
} from '@horizon-republic/nominal-types';
import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsString, MinLength, ValidateNested } from 'class-validator';

export class CountryCode extends AnyString.subtype('NestDocumentCountry', /^[A-Z]{2}$/u) {}

export class Postcode extends AnyString.subtype('NestDocumentPostcode', /^\d{5}$/u) {}

export class Sku extends AnyString.subtype('NestDocumentSku', /^SKU-\d{4}$/u) {}

export class NominalAddressDto {
  @NominalField(CountryCode)
  public country!: CountryCode;

  @NominalField(Postcode)
  public postcode!: Postcode;

  @IsString()
  @MinLength(1)
  public line!: string;
}

export class NominalCustomerDto {
  @NominalField(Uuid)
  public id!: Uuid;

  @NominalField(Email)
  public email!: Email;

  @IsString()
  @MinLength(1)
  public name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NominalAddressDto)
  public addresses!: NominalAddressDto[];
}

export class NominalPriceDto {
  @NominalField(NonNegativeInteger)
  public amountMinor!: NonNegativeInteger;

  @IsIn(['UAH', 'EUR', 'USD'])
  public currency!: string;
}

export class NominalItemDto {
  @NominalField(Sku)
  public sku!: Sku;

  @NominalField(PositiveInteger)
  public quantity!: PositiveInteger;

  @ValidateNested()
  @Type(() => NominalPriceDto)
  public price!: NominalPriceDto;
}

export class NominalOrderDto {
  @NominalField(Uuid)
  public id!: Uuid;

  @NominalField(Uuid)
  public customerId!: Uuid;

  @IsIn(['new', 'paid', 'shipped'])
  public status!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NominalItemDto)
  public items!: NominalItemDto[];

  @IsArray()
  @IsString({ each: true })
  public tags!: string[];
}

export class NominalDocumentDto {
  @NominalField(Uuid)
  public exportId!: Uuid;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NominalCustomerDto)
  public customers!: NominalCustomerDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NominalOrderDto)
  public orders!: NominalOrderDto[];
}
