import { Validate, validateSync } from "class-validator";
import { CountryCode2 } from "../types/country-code2.ntype";
import { CountryName, CountryNumber } from "../types";

describe(CountryCode2.name, () => {
  it("should create a nominal type class with the correct name", () => {
    expect(CountryCode2.name).toBe("CountryCode2");
  });

  it("should pass validation for a valid country code", () => {
    const validCode = "DE";
    const instance = new CountryCode2(validCode);
    const validator = new (CountryCode2.getValidator())();

    expect(validator.validate(validCode)).toBe(true);
    expect(instance.isIdentical(validCode)).toBe(true);
  });

  it("should fail validation for an invalid country code", () => {
    const invalidCode = "XYZ";
    const instance = new CountryCode2(invalidCode);
    const validator = new (CountryCode2.getValidator())();

    expect(validator.validate(invalidCode)).toBe(false);
    expect(instance.isIdentical(invalidCode)).toBe(true);
  });

  it("should convert to CountryCode3 correctly", () => {
    const instance = new CountryCode2("DE");
    const expectedCode3 = "DEU";

    expect(instance.toCode3().isIdentical(expectedCode3)).toBe(true);
  });

  it("should convert to country name correctly", () => {
    const instance = new CountryCode2("DE");
    const expectedName = "Germany";

    const name = instance.toName();
    expect(name).toBeInstanceOf(CountryName);
    expect(name.isIdentical(expectedName)).toBe(true);
  });

  it("should convert to country number correctly", () => {
    const instance = new CountryCode2("DE");
    const expectedNumber = "276";

    const number = instance.toNumber();
    expect(number).toBeInstanceOf(CountryNumber);
    expect(number.isIdentical(expectedNumber)).toBe(true);
  });

  it("should validate dto", () => {
    class TestDTO {
      @Validate(CountryCode2.getValidator())
      public countryCode: CountryCode2;
    }

    const invalidCode = new CountryCode2("XYZ");
    const testDto = new TestDTO();
    testDto.countryCode = invalidCode;

    const errors = validateSync(testDto);

    expect(errors.length).toEqual(1);
  });
});
