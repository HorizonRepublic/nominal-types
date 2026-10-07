# Your first type

In this tutorial we build an `OrderNumber` type for numbers such as `ORD-20261007`: a year and a four-digit sequence after a fixed prefix. By the end, an order number can't be confused with any other string, it can't hold an invalid value, and it knows its own year.

You need Node.js 22.18 or later, which runs TypeScript files directly.

## Set up a project

Make an empty folder and install the package with TypeScript:

```shell
mkdir orders && cd orders
npm init -y
npm pkg set type=module
npm install @horizon-republic/nominal-types typescript
```

Add a `tsconfig.json`, so your editor checks the code the way we need:

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

`AnyString` is the built-in type for any string. `subtype()` gives a new type under it, named `OrderNumber`, that also has to match the pattern.

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

Notice that the instance turns back into the bare string wherever a string is written.

## Try an invalid value

Add a line to `main.ts`:

```ts
new OrderNumber('42');
```

Run it again. This time Node.js stops with an error:

```text
NominalError: OrderNumber: must be matched by ^ORD-\d{8}$ (was "42")
```

There is no way to get an `OrderNumber` that holds `'42'`. Remove the line before going on.

## Let the compiler keep it apart

Add a function that takes an order number, and call it twice:

```ts
const ship = (order: OrderNumber): string => `shipping ${order.value}`;

console.log(ship(order));
ship('ORD-20261007');
```

Your editor underlines the last line: a plain string is not an `OrderNumber`, even one that would pass. Remove that line, and `ship(order)` prints `shipping ORD-20261007`.

## Give it behaviour

The code that works on order numbers belongs on the type. Replace the class in `order-number.ts`:

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

The output is `2026 1007`. The getters read `this.value`, which is always a valid order number, so they need no checks of their own.

## Check input that may be wrong

`new` throws, which is right for values our own code makes. Input from outside, such as a form field, goes through `parse()`, which never throws:

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

Express orders are the ones whose sequence starts with 9. Add a second type to `order-number.ts`:

```ts
export class ExpressOrderNumber extends OrderNumber.subtype('ExpressOrderNumber', /^ORD-\d{4}9/u) {}
```

And try it in `main.ts`:

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

An express order passes wherever an order number is expected and has its getters, while an ordinary order number is not an express one.

## What we built

We have an `OrderNumber` that only ever holds a valid number, can't be mixed up with other strings, carries its own `year` and `sequence`, and a narrower `ExpressOrderNumber` under it. From here:

- [Declaring types](../guides/declaring-types.md) shows the other ways to write a rule.
- [Building on a type](../guides/building-on-types.md) covers subtypes, `extends` and variants in full.
- [Built-in types](../reference/types/README.md) lists the types to start from.

[← Documentation](../README.md)
