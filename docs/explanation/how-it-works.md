# How it works

## Classes rather than brands

A branded string exists only in the compiler: a cast gets around it, and it has no methods. Instances are only ever built from values their constructor accepted. They have methods such as `email.mailbox` and keep their identity through generic code. The price is one small object per value.

## Validated once

The constructor is the only place a value is checked. Holding an instance means holding a valid value, so passing it on, storing it or handing it to `parse()` again costs no validation.

## Nominal at compile time

Each type has a phantom brand keyed by its name, so two types that wrap a string do not mix. A subtype has its parent's key and its own, which makes it assignable to the parent and not the other way round.

## One identity across copies

An application can load this package twice, once as ES modules and once as CommonJS. Each type marks its instances with a key from `Symbol.for`, and `instanceof` checks that key, so one copy recognises an instance the other built.

[← Documentation](../README.md)
