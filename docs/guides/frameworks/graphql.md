# How to use nominal types with GraphQL

`toGraphQL()` turns a nominal type into a GraphQL scalar (a custom leaf type, like `String`). Arguments then arrive in resolvers as instances, such as an `Email`, and bad values are refused with the type's message.

## Before you start

- Install the package and the peer dependency (a package you install yourself):

  ```sh
  npm install @horizon-republic/nominal-types graphql
  ```

- The helper comes from the adapter's entry point, `@horizon-republic/nominal-types/adapters/graphql`. Nothing from `graphql` loads unless you import it.
- It works with `graphql` 16 and 17. Any server built on `graphql` takes the scalar: Apollo Server, GraphQL Yoga, NestJS GraphQL, Pothos, type-graphql.

## Quick example

This schema has one query that takes and returns an `Email`:

```ts
// schema.ts
import { graphql, GraphQLNonNull, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { Email } from '@horizon-republic/nominal-types';
import { toGraphQL } from '@horizon-republic/nominal-types/adapters/graphql';

const EmailScalar = toGraphQL(Email);

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      invite: {
        type: new GraphQLNonNull(EmailScalar),
        args: { to: { type: new GraphQLNonNull(EmailScalar) } },
        resolve: (_parent, args: { to: Email }) => args.to, // args.to is an Email
      },
    },
  }),
});

const result = await graphql({ schema, source: '{ invite(to: "Jane@Example.com") }' });
// { data: { invite: 'Jane@Example.com' } }
```

## Use the scalar in a schema written as text

Apollo Server and GraphQL Yoga take type definitions and resolvers. Declare the scalar in the text, and give `toGraphQL()` under the same name in the resolvers:

```ts
// schema.ts
import { Email } from '@horizon-republic/nominal-types';
import { toGraphQL } from '@horizon-republic/nominal-types/adapters/graphql';

export const typeDefs = `#graphql
  scalar Email
  type Query { invite(to: Email!): Email! }
`;

export const resolvers = {
  Email: toGraphQL(Email),
  Query: {
    invite: (_parent: unknown, args: { to: Email }) => args.to, // args.to is an Email
  },
};
```

In NestJS GraphQL code-first, give the scalar as the field's type: `@Field(() => EmailScalar) email!: Email`.

## Change what is sent

A result is sent as the instance's `toJSON()`. For an `Email`, that is its text as written. To send another form, pass `serialize`:

```ts
// scalars.ts
import { Email } from '@horizon-republic/nominal-types';
import { toGraphQL } from '@horizon-republic/nominal-types/adapters/graphql';

export const EmailScalar = toGraphQL(Email, {
  serialize: (email) => email.canonical().value, // lowercase, without a +tag
});
// a resolver returning new Email('Jane.Doe@Example.com') sends "jane.doe@example.com"
```

A resolver may also return a plain value. The scalar checks it with the type before sending it.

## Name the scalar

The scalar is named after the last part of the type's name: `Email` for `nominal.Email`. Two types whose names end the same way, such as `billing.Email` and `nominal.Email`, would get the same name. Give one of them its own:

```ts
// scalars.ts
import { Email } from '@horizon-republic/nominal-types';
import { toGraphQL } from '@horizon-republic/nominal-types/adapters/graphql';

class WorkEmail extends Email.subtype('billing.Email', /@example\.com$/u) {}

export const EmailScalar = toGraphQL(Email); // named Email
export const WorkEmailScalar = toGraphQL(WorkEmail, { name: 'WorkEmail' }); // named WorkEmail
```

The scalar also takes the type's description, `an email address` for `Email`, and carries its JSON Schema in `extensions.jsonSchema` for tools that read it.

## Errors

A value the type refuses becomes a GraphQL error with the scalar's name and the type's message.

In the query text:

```json
{ "errors": [{ "message": "Email: must be an email address (was a string of 4 characters)" }] }
```

In a variable, GraphQL adds its own start:

```text
Variable "$to" has invalid value: Email: must be an email address (was a string of 4 characters)
```

GraphQL sends these messages to the client. To keep rejected values out of them, pass `hideValues: true`:

```ts
// scalars.ts
import { PositiveInteger } from '@horizon-republic/nominal-types';
import { toGraphQL } from '@horizon-republic/nominal-types/adapters/graphql';

export const CountScalar = toGraphQL(PositiveInteger, { hideValues: true });
// -5 gives "PositiveInteger: must be a positive integer (was a number)"
```

`Email` is a [sensitive type](../../reference/glossary.md), so its messages leave the value out even without it. See [How to keep values out of error messages](../core/hide-values.md).

## Limits

- One schema can't hold two scalars with the same name. `new GraphQLSchema()` throws `Schema must contain uniquely named types but contains multiple types named "Email".` Give each a `name`, as in [Name the scalar](#name-the-scalar).
- GraphQL's `Int` holds only 32 bits. Big integer types such as `Int64` are read from the literal's digits, so `9007199254740993` keeps every digit, and are sent as text: `"9007199254740993"`.

## See also

- [GraphQL adapter reference](../../reference/adapters/graphql.md): every option of `toGraphQL()`, with defaults.
- [How to use nominal types with NestJS](nestjs.md)
- [How to send nominal types through superjson](superjson.md)
- [How to keep values out of error messages](../core/hide-values.md)

[← Guides](../README.md)
