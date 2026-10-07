# Your first type

In this tutorial we build an `OrderNumber` type for values like `ORD-20261007`. That is the prefix `ORD-`, a year (`2026`) and a four-digit sequence (`1007`).

By the end, our order number:

- can't hold an invalid value;
- can't be mixed up with other strings;
- knows its own year.

It takes about ten minutes. You need Node.js 22.18 or later, because it runs TypeScript files directly.

## Set up a project

Make an empty folder and install the package and TypeScript:

```shell
mkdir orders && cd orders
npm init -y
npm pkg set type=module
npm install @horizon-republic/nominal-types typescript
```

Add a `tsconfig.json` file. It tells your editor how to check the code:

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "nodenext",
    "target": "es2022",
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true
  }
}
```

## Declare the type

Create `order-number.ts`:

```ts
import { AnyString } from '@horizon-republic/nominal-types';

export class OrderNumber extends AnyString.subtype('OrderNumber', /^ORD-\d{8}$/u) {}
```

Let's read it piece by piece:

- `AnyString` is a built-in type that accepts any string.
- `.subtype('OrderNumber', …)` makes a new, narrower type under it.
- `/^ORD-\d{8}$/u` is the rule: `ORD-` followed by exactly eight digits.

## Build a value

Create `main.ts` next to it:

```ts
import { OrderNumber } from './order-number.ts';

const order = new OrderNumber('ORD-20261007');

console.log(order.value);
console.log(`${order}`);
console.log(JSON.stringify({ order }));
```

Run it with `node main.ts`. The output should be:

```text
ORD-20261007
ORD-20261007
{"order":"ORD-20261007"}
```

Notice that the instance turns back into the plain string in a template and in JSON.

## Try an invalid value

Add a line to `main.ts`:

```ts
new OrderNumber('42');
```

Run it again. This time Node.js stops with an error:

```text
NominalError: OrderNumber: must be matched by ^ORD-\d{8}$ (was "42")
```

There is no way to get an `OrderNumber` that holds `'42'`. Remove that line before going on.

## Let the compiler keep it apart

Add a function that takes an order number, and call it twice:

```ts
const ship = (order: OrderNumber): string => `shipping ${order.value}`;

console.log(ship(order));
ship('ORD-20261007');
```

Your editor underlines the last line. A plain string is not an `OrderNumber`, even when it looks right. Remove that line. Now `ship(order)` prints `shipping ORD-20261007`.

## Give it behaviour

Code that reads order numbers can live on the type itself. Replace the class in `order-number.ts`:

```ts
export class OrderNumber extends AnyString.subtype('OrderNumber', /^ORD-\d{8}$/u) {
  get year(): number {
    return Number(this.value.slice(4, 8));
  }

  get sequence(): number {
    return Number(this.value.slice(8));
  }
}
```

Print them in `main.ts`:

```ts
console.log(order.year, order.sequence);
```

The output is `2026 1007`. The getters read `this.value`. It always holds a valid order number, so the getters don't need to check anything.

## Check input that may be wrong

`new` throws on a bad value. That suits values our own code creates. For input from outside, such as a form field, we use `parse()`. It returns a result instead of throwing:

```ts
for (const input of ['ORD-20261007', 'ORD-2026']) {
  const result = OrderNumber.parse(input);

  console.log(result.ok ? `valid, year ${result.value.year}` : result.issues[0]?.message);
}
```

The output is:

```text
valid, year 2026
must be matched by ^ORD-\d{8}$ (was "ORD-2026")
```

## Add a narrower type

Let's say express orders are the ones whose sequence starts with 9. Add a second type to `order-number.ts`:

```ts
export class ExpressOrderNumber extends OrderNumber.subtype('ExpressOrderNumber', /^ORD-\d{4}9/u) {}
```

The pattern `^ORD-\d{4}9` means `ORD-`, four digits of the year, then `9`. Try it in `main.ts`:

```ts
const express = new ExpressOrderNumber('ORD-20269001');

console.log(ship(express), express.year);
console.log(OrderNumber.parse('ORD-20261007').ok, ExpressOrderNumber.parse('ORD-20261007').ok);
```

The output is:

```text
shipping ORD-20269001 2026
true false
```

Notice two things:

- An express order works wherever an order number is expected, and it has the same getters.
- An ordinary order number is not an express one.

## What we built

We built an `OrderNumber` that only holds valid values, can't be mixed up with other strings and knows its `year` and `sequence`. Under it we added a narrower `ExpressOrderNumber`.

Where to go next:

- [How to declare a type](../guides/declaring-types.md) shows other ways to write a rule.
- [How to build on a type](../guides/building-on-types.md) covers all the ways to derive one type from another.
- [Built-in types](../reference/types/README.md) lists the types you can start from.

[← Documentation](../README.md)
