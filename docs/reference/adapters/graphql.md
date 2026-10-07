# graphql

Entry point: `@horizon-republic/nominal-types/adapters/graphql`. Needs `graphql` 16 or 17. The scalar works with any server built on `graphql`: Apollo Server, GraphQL Yoga, NestJS GraphQL, Pothos, type-graphql.

| Export           | Kind     | Use it for                                            |
| ---------------- | -------- | ----------------------------------------------------- |
| `toGraphQL()`    | function | a GraphQL [scalar](../glossary.md) for a nominal type |
| `GraphQLOptions` | type     | the options of `toGraphQL()`                          |

## toGraphQL()

```ts
function toGraphQL<Target extends AnyNominalType>(
  target: Target,
  options?: GraphQLOptions<Target['prototype']>,
): GraphQLScalarType<Target['prototype'], unknown>;
```

| Parameter | Type             | Description                       |
| --------- | ---------------- | --------------------------------- |
| `target`  | nominal type     | the type the scalar holds         |
| `options` | `GraphQLOptions` | optional; see [Options](#options) |

Returns a `GraphQLScalarType`:

| Where                     | What happens                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| an argument or a variable | becomes an instance, checked by the type                                                                              |
| a big integer literal     | is read from its text, so `Int64` keeps every digit                                                                   |
| a result                  | is sent as the instance's `toJSON()`, or what `serialize` gives. A plain value the type accepts is sent the same way. |

The scalar carries the type's JSON Schema in `extensions.jsonSchema`.

### Options

| Option           | Type                 | Default                                                     | Description                                                                                      |
| ---------------- | -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `name`           | `string`             | the last part of the type name: `Email` for `nominal.Email` | the scalar's name in the schema                                                                  |
| `description`    | `string`             | the type's description: `an email address`                  | the scalar's description                                                                         |
| `serialize`      | `(value) => unknown` | the instance's `toJSON()`                                   | what a result is sent as                                                                         |
| `specifiedByURL` | `string`             | none                                                        | a link to the scalar's specification                                                             |
| `hideValues`     | `boolean`            | `false`                                                     | leave rejected values out of error messages. [Sensitive types](../glossary.md) hide them anyway. |

Two types whose names end in the same part, such as `billing.Email` and `nominal.Email`, need different `name`s in one schema.

### Errors

A value the type rejects, as input or as a result, is a `GraphQLError`. Its message is `<scalar name>: <type message>`:

| Case         | Message                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------- |
| a literal    | `Email: must be an email address (was a string of 4 characters)`                                   |
| a variable   | `Variable "$to" has invalid value: Email: must be an email address (was a string of 4 characters)` |
| `hideValues` | `Uuid: must be a UUID (was a string of 4 characters)`                                              |

## Example

```ts
import { graphql, GraphQLNonNull, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { toGraphQL } from '@horizon-republic/nominal-types/adapters/graphql';
import { Email } from '@horizon-republic/nominal-types';

const EmailScalar = toGraphQL(Email);

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      invite: {
        type: new GraphQLNonNull(EmailScalar),
        args: { to: { type: new GraphQLNonNull(EmailScalar) } },
        resolve: (_source, args: { to: Email }) => args.to, // args.to is an Email
      },
    },
  }),
});

await graphql({ schema, source: '{ invite(to: "jane@example.com") }' });
// { data: { invite: 'jane@example.com' } }

await graphql({ schema, source: '{ invite(to: "jane") }' });
// { errors: [{ message: 'Email: must be an email address (was a string of 4 characters)' }] }
```

## See also

- [How to use nominal types in GraphQL](../../guides/frameworks/graphql.md)
- [How to keep values out of error messages](../../guides/core/hide-values.md)

[← Adapters](README.md) · [← Reference](../README.md)
