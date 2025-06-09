import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { NType } from "../n-type";
import { countryListAllIsoData } from "../utils/valid-country-codes";
import { CountryCode3 } from "./country-code3.ntype";
import { CountryName } from "./country-name.ntype";
import { CountryNumber } from "./country-number.ntype";

@ValidatorConstraint({ name: CountryCodeValidator.name, async: false })
class CountryCodeValidator implements ValidatorConstraintInterface {
  private countryCodes: string[] = countryListAllIsoData.map((c) => c.code);

  public validate(value: any): boolean {
    return this.countryCodes.includes(value);
  }

  public defaultMessage(): string {
    return "Country code is invalid.";
  }
}

/**
 * Represents a two-letter country code (ISO 3166-1 alpha-2).
 *
 * @class
 * @extends NType
 */
export class CountryCode2 extends NType({
  name: "country-code",
  validator: CountryCodeValidator,
}) {
  public _nominalType = CountryCode2.name;

  /**
   * Returns the name of the country.
   *
   * @returns {CountryName} The name of the country.
   */
  public toName() {
    return new CountryName(
      countryListAllIsoData.find((c) => c.code === this.value)?.name
    );
  }

  /**
   * Returns the number of the country.
   *
   * @returns {CountryNumber} The number of the country.
   */
  public toNumber() {
    return new CountryNumber(
      countryListAllIsoData.find((c) => c.code === this.value)?.number
    );
  }

  /**
   * Returns the three-letter country code.
   *
   * @returns {CountryCode3} The three-letter country code.
   */
  public toCode3() {
    return new CountryCode3(
      countryListAllIsoData.find((c) => c.code === this.value)?.code3
    );
  }
}
