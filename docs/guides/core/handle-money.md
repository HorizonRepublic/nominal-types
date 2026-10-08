# How to handle money

This guide shows how to take, compute, send and store amounts of money without losing a cent. It uses two built-in types:

- [`Money`](../../reference/types/money.md): an amount and a currency, such as 12.50 EUR.
- [`DecimalString`](../../reference/types/string.md#decimalstring): an exact number as text, such as `'12.50'`, for amounts without a currency.

Amounts travel as text, never as JavaScript numbers. A number can't hold most decimals exactly: `0.1 + 0.2` is `0.30000000000000004`.

## Take an amount from a request

Put `Money` in a request body. The client sends the amount as a string and the currency as an ISO 4217 code:

```ts
import { Money, n, PositiveInteger } from '@horizon-republic/nominal-types';

const OrderLine = n.object({ price: Money, quantity: PositiveInteger });

const body: unknown = { price: { amount: '12.50', currency: 'EUR' }, quantity: 2 };

OrderLine.parse(body); // { ok: true, value: { price: Money, quantity: PositiveInteger } }
```

These bodies are refused:

```ts
import { Money, n, PositiveInteger } from '@horizon-republic/nominal-types';

const OrderLine = n.object({ price: Money, quantity: PositiveInteger });

OrderLine.parse({ price: { amount: 12.5, currency: 'EUR' }, quantity: 2 });
// { ok: false, issues: [{ message: 'must be a string (was 12.5)', path: ['price', 'amount'] }] }

OrderLine.parse({ price: { amount: '12.505', currency: 'EUR' }, quantity: 2 });
// { ok: false, issues: [{ message: 'must have at most 2 digits after the point in EUR', path: ['price', 'amount'] }] }
```

The number of digits after the point comes from the currency: 2 for `EUR`, none for `JPY`, 3 for `KWD`.

## Compute with amounts

Use the methods of `Money`. They are exact, and they keep the currency's digits:

```ts
import { Money } from '@horizon-republic/nominal-types';

const price = new Money({ amount: '12.50', currency: 'EUR' });
const shipping = new Money({ amount: '4.99', currency: 'EUR' });
const total = price.multiply(3).add(shipping);

total.amount.value; // '42.49'
total.subtract(new Money({ amount: '50', currency: 'EUR' })).amount.value; // '-7.51'
total.compare(price); // 1
total.isNegative; // false
```

Amounts in two currencies don't mix. There is no exchange rate inside the type:

```ts
import { Money } from '@horizon-republic/nominal-types';

const euros = new Money({ amount: '42.49', currency: 'EUR' });

euros.add(new Money({ amount: '1', currency: 'USD' })); // throws TypeError: add(): USD cannot be mixed with EUR
```

## Send an amount to a payment provider

Many payment providers count in minor units, such as cents. Read `minor`, and build `Money` back with `fromMinor()`:

```ts
import { Money } from '@horizon-republic/nominal-types';

const total = new Money({ amount: '42.49', currency: 'EUR' });

total.minor; // 4249n
Money.fromMinor(4249n, 'EUR').amount.value; // '42.49'
```

`minor` is a `bigint`. Turn it into a number with `Number(total.minor)` if the provider's library wants one.

## Send an amount in a response

`JSON.stringify()` writes the amount as a string:

```ts
import { Money } from '@horizon-republic/nominal-types';

const total = new Money({ amount: '42.49', currency: 'EUR' });

JSON.stringify({ total }); // '{"total":{"amount":"42.49","currency":"EUR"}}'
```

## Show an amount to people

Call `format()` with a locale. It uses `Intl.NumberFormat` and the currency's digits:

```ts
import { Money } from '@horizon-republic/nominal-types';

const total = new Money({ amount: '42.49', currency: 'EUR' });

total.format('en-US'); // '€42.49'
total.format('de-DE'); // '42,49 €'
```

The text depends on the locale and on the Node version. Show it, but never store it or read it back.

## Store an amount

Store the amount and the currency in two columns, and build `Money` from the row:

```ts
import { Money } from '@horizon-republic/nominal-types';

const row = { price_amount: '12.50', price_currency: 'EUR' };

const price = new Money({ amount: row.price_amount, currency: row.price_currency });

price.minor; // 1250n
```

With a database adapter, declare the two columns as `DecimalString` and `CurrencyCode`. `DecimalString` gets `varchar(100)` by default. To sum or sort amounts in SQL, choose a `numeric` column for it, which PostgreSQL drivers return as text. [Database columns](../../reference/adapters/database-columns.md) shows how to choose a column.

## Keep an amount without a currency

Use `DecimalString` for an exact number that isn't money, such as a tax rate:

```ts
import { DecimalString } from '@horizon-republic/nominal-types';

class TaxRate extends DecimalString.subtype('shop.TaxRate', /^0\.\d+$/u) {}

const rate = new TaxRate('0.20');

rate.toMinorUnits(2); // 20n
rate.equals(new TaxRate('0.2')); // true
```

## See also

- [Money](../../reference/types/money.md): every member and every error.
- [DecimalString](../../reference/types/string.md#decimalstring) and [CurrencyCode](../../reference/types/string.md#currencycode).
- [How to make a value object](make-a-value-object.md), to build a type like `Money` of your own.

[← Guides](../README.md)
