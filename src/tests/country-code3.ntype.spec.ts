import { Validate, validateSync } from "class-validator";
import { CountryCode2 } from "../types/country-code2.ntype";
import { CountryCode3 } from "../types/country-code3.ntype";
import { CountryName, CountryNumber } from "../types";

describe(CountryCode3.name, () => {
  it("should create a nominal type class with the correct name", () => {
    expect(CountryCode3.name).toBe("CountryCode3");
  });

  it("should pass validation for a valid country code", () => {
    const validCode = "DEU";
    const instance = new CountryCode3(validCode);
    const validator = new (CountryCode3.getValidator())();

    expect(validator.validate(validCode)).toBe(true);
    expect(instance.isIdentical(validCode)).toBe(true);
  });

  it("should fail validation for an invalid country code", () => {
    const invalidCode = "XYZ";
    const instance = new CountryCode3(invalidCode);
    const validator = new (CountryCode3.getValidator())();

    expect(validator.validate(invalidCode)).toBe(false);
    expect(instance.isIdentical(invalidCode)).toBe(true);
  });

  it("should convert to and from CountryCode2 correctly", () => {
    const instance = new CountryCode3("DEU");
    const expectedCode2 = new CountryCode2("DE");

    expect(instance.toCode2().isIdentical(expectedCode2.value)).toBe(true);
  });

  it("should convert to country name correctly", () => {
    const instance = new CountryCode3("USA");
    const expectedName = "United States";

    const name = instance.toName();
    expect(name).toBeInstanceOf(CountryName);
    expect(name.isIdentical(expectedName)).toBe(true);
  });

  it("should convert to country number correctly", () => {
    const instance = new CountryCode3("CAN");
    const expected = "124";

    const number = instance.toNumber();
    expect(number).toBeInstanceOf(CountryNumber);
    expect(number.isIdentical(expected)).toBe(true);
  });

  it("should validate dto", () => {
    class TestDTO {
      @Validate(CountryCode3.getValidator())
      public countryCode: CountryCode3;
    }

    const invalidCode = new CountryCode3("XYZ");
    const testDto = new TestDTO();
    testDto.countryCode = invalidCode;

    const errors = validateSync(testDto);

    expect(errors.length).toEqual(1);
  });
});
