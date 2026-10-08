# Money

[Built-in types](README.md) › Money

## Money

An amount of money in one currency, like 12.34 EUR. It is a root of its own, built on [`n.object()`](../schemas.md#nobject) with two fields:

| Field      | Type                                       | Example   |
| ---------- | ------------------------------------------ | --------- |
| `amount`   | [`DecimalString`](string.md#decimalstring) | `'12.34'` |
| `currency` | [`CurrencyCode`](string.md#currencycode)   | `'EUR'`   |

- The amount is text, so no digit is lost on the way. A number such as `12.34` is refused.
- The amount has at most as many digits after the point as the currency's [minor units](../glossary.md): 2 for `EUR`, none for `JPY`, 3 for `KWD`.
- A currency without minor units, such as `XAU` (gold), takes any number of digits.

| Property    | Value                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| JSON        | `{ "amount": "12.34", "currency": "EUR" }`                                                                        |
| JSON Schema | an object with the schemas of the two fields, both required                                                       |
| Message     | `amount: must have at most 2 digits after the point in EUR`, `amount: must have no digits after the point in JPY` |
| Limits      | the JSON Schema can't count digits per currency, so it accepts `{ "amount": "1.5", "currency": "JPY" }`           |

```ts
import { Money } from '@horizon-republic/nominal-types';

const price = new Money({ amount: '12.50', currency: 'EUR' });

price.amount.value; // '12.50'
price.minor; // 1250n
JSON.stringify(price); // '{"amount":"12.50","currency":"EUR"}'
new Money({ amount: '100.5', currency: 'JPY' }); // throws NominalError: nominal.Money: amount: must have no digits after the point in JPY
```

Members, with results for this `price`:

| Member              | Returns                                                                      | Example               |
| ------------------- | ---------------------------------------------------------------------------- | --------------------- |
| `amount`            | the amount, a `DecimalString`                                                | `'12.50'`             |
| `currency`          | the currency, a `CurrencyCode`                                               | `'EUR'`               |
| `minor`             | the amount in minor units, such as cents, as a `bigint`                      | `1250n`               |
| `isZero`            | whether the amount is zero                                                   | `false`               |
| `isNegative`        | whether the amount is below zero                                             | `false`               |
| `add(other)`        | the sum                                                                      |                       |
| `subtract(other)`   | the difference                                                               |                       |
| `multiply(factor)`  | the amount times a whole number, a `number` or a `bigint`                    |                       |
| `compare(other)`    | `-1` if this amount is smaller, `1` if larger, `0` if equal                  |                       |
| `canonical()`       | the same money with exactly the currency's digits after the point            | `'12.50'`             |
| `format(locales?)`  | the amount for people to read, from `Intl.NumberFormat`                      | `'€12.50'` in `en-US` |
| `equals(other)`     | whether the amount and the currency are the same; trailing zeros don't count |                       |
| `copyWith(changes)` | a new instance with some fields changed, checked like `new`                  |                       |

- `add()`, `subtract()` and `multiply()` are exact. They write the result with the currency's digits: `12.5` plus `1` is `13.50`. For a currency without minor units, they keep every digit.
- `add()`, `subtract()` and `compare()` throw a `TypeError` for two currencies: `add(): USD cannot be mixed with EUR`.
- `minor` throws a `TypeError` for a currency without minor units: `minor: XAU has no minor units`.
- `multiply()` throws a `RangeError` for a factor that isn't a whole number.
- `format()` depends on the locale and on the locale data of the runtime. Use it for display only and never read its text back.

| Static member                      | Does                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Money.fromMinor(minor, currency)` | the money for an amount in minor units, such as `1250n` cents: `fromMinor(1250n, 'EUR')` is 12.50 EUR |

`fromMinor()` throws a `TypeError` for a currency without minor units, and `NominalError` for a code that isn't a currency. Like `copyWith()`, the arithmetic methods return the class they were called on, and its rules apply.

See also: [How to handle money](../../guides/core/handle-money.md).

[← Built-in types](README.md)
