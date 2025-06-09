import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { NType } from "../n-type";
import { countryListAllIsoData } from "../utils/valid-country-codes";
import { CountryCode2 } from "./country-code2.ntype";
import { CountryName } from "./country-name.ntype";
import { CountryNumber } from "./country-number.ntype";

@ValidatorConstraint({ name: CountryCodeValidator.name, async: false })
class CountryCodeValidator implements ValidatorConstraintInterface {
  private countryCodes: string[] = countryListAllIsoData.map((c) => c.code3);

  public validate(value: any): boolean {
    return this.countryCodes.includes(value);
  }

  public defaultMessage(): string {
    return "Country code is invalid.";
  }
}

export class CountryCode3 extends NType({
  name: "country-code",
  validator: CountryCodeValidator,
}) {
  public _nominalType = CountryCode3.name;

  public toCode2() {
    return new CountryCode2(
      countryListAllIsoData.find((c) => c.code3 === this.value)?.code
    );
  }

  public toName() {
    return new CountryName(
      countryListAllIsoData.find((c) => c.code3 === this.value)?.name
    );
  }

  public toNumber() {
    return new CountryNumber(
      countryListAllIsoData.find((c) => c.code3 === this.value)?.number
    );
  }
}
