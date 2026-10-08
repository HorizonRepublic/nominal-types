import { describe, expect, expectTypeOf, it } from 'vitest';

import { sameType } from '../../src/core/same-type.ts';
import {
  DecimalString,
  DomainName,
  Email,
  Gtin,
  HexColor,
  Hostname,
  HttpUrl,
  IpAddress,
  IpPrefix,
  Ipv4Address,
  Ipv4Prefix,
  Ipv6Address,
  Ipv6Prefix,
  Isbn,
  LanguageTag,
  MacAddress,
  MediaType,
  Money,
  NominalError,
  ObjectId,
  Ulid,
  Url,
  Uuid,
  UuidV4,
  UuidV7,
} from '../../src/index.ts';
import { thrownBy } from '../support/results.ts';

const canonicalOf = (instance: unknown): unknown => {
  const method: unknown =
    typeof instance === 'object' && instance !== null
      ? Reflect.get(instance, 'canonical')
      : undefined;

  if (typeof method !== 'function') {
    throw new TypeError('expected an instance with canonical()');
  }

  return Reflect.apply(method, instance, []);
};

describe('methods that return a changed copy', () => {
  it.each([
    [Uuid.subtype('changed.Uuid'), '0190F1C2-3B4A-7C5D-8E9F-0A1B2C3D4E5F'],
    [UuidV4.subtype('changed.UuidV4'), '550E8400-E29B-41D4-A716-446655440000'],
    [UuidV7.subtype('changed.UuidV7'), '0190F1C2-3B4A-7C5D-8E9F-0A1B2C3D4E5F'],
    [HexColor.subtype('changed.HexColor'), '#FFF'],
    [Hostname.subtype('changed.Hostname'), 'Example.COM'],
    [DomainName.subtype('changed.DomainName'), 'Example.COM'],
    [Ulid.subtype('changed.Ulid'), '01arz3ndektsv4rrffq69g5fav'],
    [IpPrefix.subtype('changed.IpPrefix'), '2001:DB8::/32'],
    [Ipv4Prefix.subtype('changed.Ipv4Prefix'), '10.0.0.0/8'],
    [Ipv6Prefix.subtype('changed.Ipv6Prefix'), '2001:DB8::/32'],
    [MacAddress.subtype('changed.MacAddress'), 'AA-BB-CC-DD-EE-FF'],
    [Url.subtype('changed.Url'), 'HTTP://Example.com:80/a'],
    [HttpUrl.subtype('changed.HttpUrl'), 'HTTP://Example.com:80/a'],
    [Email.subtype('changed.Email'), 'Jane+news@Example.com'],
    [IpAddress.subtype('changed.IpAddress'), '0:0::1'],
    [Ipv4Address.subtype('changed.Ipv4Address'), '10.0.0.1'],
    [Ipv6Address.subtype('changed.Ipv6Address'), '0:0::1'],
    [Isbn.subtype('changed.Isbn'), '0306406152'],
    [MediaType.subtype('changed.MediaType'), 'Text/HTML; Charset=UTF-8'],
    [ObjectId.subtype('changed.ObjectId'), '507F1F77BCF86CD799439011'],
    [LanguageTag.subtype('changed.LanguageTag'), 'EN-us'],
    [Gtin.subtype('changed.Gtin'), '4006381333931'],
    [DecimalString.subtype('changed.DecimalString'), '1.50'],
    [Money.subtype('changed.Money'), { amount: '1.5', currency: 'EUR' }],
  ])('keep the subtype in canonical() of %o', (Sub, sample) => {
    const instance: unknown = Reflect.construct(Sub, [sample]);

    expect(Object.getPrototypeOf(canonicalOf(instance))).toBe(Sub.prototype);
  });

  it('keep the subtype in the tag methods of Email, by type too', () => {
    class StaffEmail extends Email.subtype('changed.StaffEmail', /@staff\.example$/u) {}

    const staff = new StaffEmail('Jane+news@staff.example');

    expect(Object.getPrototypeOf(staff.withTag('x'))).toBe(StaffEmail.prototype);
    expect(Object.getPrototypeOf(staff.withoutTag())).toBe(StaffEmail.prototype);
    expect(staff.withTag('x').value).toBe('Jane+x@staff.example');
    expect(staff.canonical().value).toBe('jane@staff.example');
    expectTypeOf(staff.canonical()).toEqualTypeOf<StaffEmail>();
    expectTypeOf(staff.withTag('x')).toEqualTypeOf<StaffEmail>();
    expectTypeOf(new HttpUrl('https://a.example').canonical()).toEqualTypeOf<HttpUrl>();
    expectTypeOf(
      new UuidV4('550e8400-e29b-41d4-a716-446655440000').canonical(),
    ).toEqualTypeOf<UuidV4>();
  });

  it('need a class to build the copy with', () => {
    expect(() => sameType({ constructor: undefined }, 'a')).toThrow(TypeError);
  });

  it('throw when the subtype refuses the new value', () => {
    class UpperUuid extends Uuid.subtype('changed.UpperUuid', /^[^a-f]+$/u) {}

    const id = new UpperUuid('0190F1C2-3B4A-7C5D-8E9F-0A1B2C3D4E5F');

    expect(thrownBy(() => id.canonical())).toBeInstanceOf(NominalError);
  });
});
