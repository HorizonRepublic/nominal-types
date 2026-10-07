import { Type } from 'class-transformer';
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
} from 'class-validator';

export class AddressDto {
  @Matches(/^[A-Z]{2}$/u)
  public country!: string;

  @Matches(/^\d{5}$/u)
  public postcode!: string;

  @IsString()
  @MinLength(1)
  public line!: string;
}

export class CustomerDto {
  @IsUUID('all')
  public id!: string;

  @IsEmail()
  public email!: string;

  @IsString()
  @MinLength(1)
  public name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  public addresses!: AddressDto[];
}

export class PriceDto {
  @IsInt()
  @Min(0)
  public amountMinor!: number;

  @IsIn(['UAH', 'EUR', 'USD'])
  public currency!: string;
}

export class ItemDto {
  @Matches(/^SKU-\d{4}$/u)
  public sku!: string;

  @IsInt()
  @Min(1)
  public quantity!: number;

  @ValidateNested()
  @Type(() => PriceDto)
  public price!: PriceDto;
}

export class OrderDto {
  @IsUUID('all')
  public id!: string;

  @IsUUID('all')
  public customerId!: string;

  @IsIn(['new', 'paid', 'shipped'])
  public status!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  public items!: ItemDto[];

  @IsArray()
  @IsString({ each: true })
  public tags!: string[];
}

export class DocumentDto {
  @IsUUID('all')
  public exportId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerDto)
  public customers!: CustomerDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderDto)
  public orders!: OrderDto[];
}
