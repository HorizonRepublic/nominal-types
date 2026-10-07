# How it works

## Classes rather than brands

A common way to get nominal types in TypeScript is a brand: `string & { __brand: 'Email' }`. A brand exists only for the compiler. At runtime it is a plain string, so nothing can tell a checked email from any other string, and it can't carry methods.

This package uses classes instead. An instance:

- exists at runtime, so `instanceof Email` works;
- is only ever created from a value that passed the rule;
- has methods, such as `email.mailbox`.

The cost is one small object per value.

## Behaviour on the type

Without a type, code that works on a kind of value ends up in helpers like `orderYear(orderNumber: string)`. Two problems follow:

- every caller has to know the helper exists;
- nothing stops a caller from passing a customer name.

On the type, the same code shows up in autocompletion. It only runs on values that passed the rule, so it needs no checks.

## Validated once

A value is checked when the instance is created, and never again. Holding an instance means holding a valid value. Passing it on, storing it or giving it to `parse()` again costs no extra check.

## Nominal at compile time

Each type carries a hidden brand with its name. That is why the compiler keeps `Email` and `Uuid` apart, even though both wrap a string.

A subtype carries its parent's brand and its own. So a subtype fits where the parent is expected, and not the other way round.

## One identity across copies

An application can load this package twice: once through `import` and once through `require`. Each copy has its own classes.

To keep `instanceof` working anyway, each type marks its instances with a key from `Symbol.for`, which is shared across copies. `instanceof` checks that key, so an `Email` made by one copy is an `Email` for the other.

[← Documentation](../README.md)
