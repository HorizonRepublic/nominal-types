# How to use nominal types in GraphQL

This guide shows how to make a nominal type a GraphQL scalar, so arguments arrive in resolvers as instances, such as an `Email`, and bad values are refused with the type's message.

The helper comes from a separate entry point, `@horizon-republic/nominal-types/adapters/graphql`. You only need `graphql` 16 or 17 if you import it. The scalar works with any server built on `graphql`: Apollo Server, GraphQL Yoga, NestJS GraphQL, Pothos, type-graphql.

## Making a scalar

```ts
import { toGraphQL } from '@horizon-republic/nominal-types/adapters/graphql';
import { Email } from '@horizon-republic/nominal-types';

export const EmailScalar = toGraphQL(Email);
```

Then use it as your server expects a scalar. With type definitions and resolvers, as in Apollo Server:

```ts
const typeDefs = `
  scalar Email
  type Query { invite(to: Email!): Email! }
`;

const resolvers = {
  Email: EmailScalar,
  Query: {
    invite: (_parent: unknown, { to }: { to: Email }) => to, // `to` is an Email
  },
};
```

With NestJS code-first, give it as the field's type: `@Field(() => EmailScalar) email!: Email;`.

## What the scalar does

| Where                     | What happens                                                                      |
| ------------------------- | --------------------------------------------------------------------------------- |
| an argument or a variable | becomes an instance; a value the type refuses is an error with the type's message |
| a result                  | is sent as the instance's `toJSON()`, or what `serialize` gives                   |
| a big integer literal     | is read from its text, so `Int64` keeps every digit                               |

A bad value gives an error such as:

```json
{ "errors": [{ "message": "Email: must be an email address (was \"nope\")" }] }
```

## Options

| Option           | Default                                                       |
| ---------------- | ------------------------------------------------------------- |
| `name`           | the last part of the type's name: `Email` for `nominal.Email` |
| `description`    | the type's description: `an email address`                    |
| `serialize`      | the instance's `toJSON()`                                     |
| `specifiedByURL` | none                                                          |

Two types whose names end in the same part, such as `billing.Email` and `nominal.Email`, need different `name`s in one schema.

The scalar also carries the type's JSON Schema in `extensions.jsonSchema`, for tools that read it.

[← Guides](README.md)
