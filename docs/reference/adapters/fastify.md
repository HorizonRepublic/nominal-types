# fastify

Entry point: `@horizon-republic/nominal-types/adapters/fastify`. Needs `fastify` 5. It works with `@fastify/swagger` 9.

| Export                        | Kind     | Use it for                                                               |
| ----------------------------- | -------- | ------------------------------------------------------------------------ |
| `fastifyNominal`              | plugin   | checking requests and writing responses with the schemas in `schema`     |
| `NominalTypeProvider`         | type     | typing `request.body`, `request.query` and the reply by those schemas    |
| `nominalValidatorCompiler()`  | function | a validator compiler for a route whose every schema is nominal           |
| `nominalSerializerCompiler()` | function | a serializer compiler for a route whose every response schema is nominal |
| `FastifyNominalOptions`       | type     | the options of `fastifyNominal`                                          |
| `NominalValidatorOptions`     | type     | the options of `nominalValidatorCompiler()`                              |
| `FastifyJsonTarget`           | type     | `'draft-07'`, `'draft-2020-12'` or `'openapi-3.0'`                       |
| `NominalValidatorCompiler`    | type     | what `nominalValidatorCompiler()` returns                                |
| `NominalValidator`            | type     | the check it builds for one part of a route                              |
| `NominalSerializerCompiler`   | type     | what `nominalSerializerCompiler()` returns                               |
| `FastifyRouteSchema`          | type     | what Fastify passes to both compilers                                    |

## fastifyNominal

```ts
await app.register(fastifyNominal, options?: FastifyNominalOptions);
```

Register it before the routes that use it. It acts on the plugin it is registered in, and on the plugins inside that one, as a plugin wrapped in `fastify-plugin` does.

A nominal schema is a nominal type, or a schema from `n.of()`, `n.object()` or `n.union()`. The plugin takes one in each of these places of a route's `schema`:

| Place                                | What the handler gets                   |
| ------------------------------------ | --------------------------------------- |
| `body`                               | `request.body` as the schema's value    |
| `querystring` (or `query`)           | `request.query` as the schema's value   |
| `params`                             | `request.params` as the schema's value  |
| `headers`                            | `request.headers` as the schema's value |
| `response`, by status code           | the reply is written with `stringify()` |
| `content` of `body` or of a response | the same, for each content type         |

Every other JSON Schema goes to Fastify's own compilers, with the server's `ajv` options and the schemas added with `addSchema()`. A compiler set with `setValidatorCompiler()` or `setSerializerCompiler()` before the plugin takes the other schemas in their place.

### Text in query strings, route parameters and headers

These parts arrive as text. For an `n.object()` schema, the plugin reads them the way `NominalPipe` does:

| Input                                         | What the plugin does                                             |
| --------------------------------------------- | ---------------------------------------------------------------- |
| `'2'` for a field of a number or boolean type | reads it as `2` (`'true'` as `true`), unless `fromString: false` |
| `'02'` or `'abc'` for a number type           | rejects it: `querystring/page must be a number (was "02")`       |
| `?ids=a` for a field of an array schema       | wraps the lone value: `['a']`                                    |
| a string for a field of an `n.of()` schema    | reads text only through the schema's own `fromString()`          |

A field that may be missing keeps its text form when it is made optional with `partial()`: `n.object({ page: PositiveInteger }).partial()`.

Bodies are never read from text.

### Options

| Option             | Type                | Default      | Description                                                                                     |
| ------------------ | ------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| `fromString`       | `boolean`           | `true`       | read the text of query strings, route parameters and headers, as in the table above             |
| `hideValues`       | `boolean`           | `false`      | leave rejected values out of every message. [Sensitive types](../glossary.md) hide them anyway. |
| `jsonSchemaTarget` | `FastifyJsonTarget` | `'draft-07'` | the JSON Schema dialect the routes show for nominal schemas, which `@fastify/swagger` reads     |

### Errors

A rejected request fails with Fastify's validation error, status 400:

```json
{
  "statusCode": 400,
  "code": "FST_ERR_VALIDATION",
  "error": "Bad Request",
  "message": "body/customer must be an email address (was a string of 4 characters), body/quantity must be a positive integer (was 0)"
}
```

The message lists every issue as `<part><path> <message>`, joined by `, `. The path is a JSON Pointer, so a list item adds its index: `querystring/ids/1`.

`error.validation` holds one entry per issue, in the shape of an Ajv error:

| Field          | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| `keyword`      | `'nominal'`                                                 |
| `instancePath` | the path, such as `'/customer'`                             |
| `schemaPath`   | `'#'`                                                       |
| `params`       | `{}`                                                        |
| `message`      | the message, such as `'must be a positive integer (was 0)'` |

So `attachValidation`, `schemaErrorFormatter` and `setErrorHandler()` work as they do with Ajv.

A missing body arrives as `null`: `body must be an object (was null)`. A body schema that accepts `undefined`, such as `CreateOrder.optional()`, lets it through.

### Swagger

The plugin puts each nominal schema's JSON Schema in its place in the route's `schema`. `@fastify/swagger` reads that, so it needs no option. Request parts show the input JSON Schema, responses the output one. A type that can't describe itself as JSON Schema shows `{}`.

### Limits

- An `n.object()` schema made by another copy of the package is checked, but its query string, route parameters and headers are not read from text.
- A route option `validatorCompiler` or `serializerCompiler` replaces the plugin's on that route.

## NominalTypeProvider

```ts
const app = Fastify().withTypeProvider<NominalTypeProvider>();
```

| Schema                 | Type                                 |
| ---------------------- | ------------------------------------ |
| a nominal type         | its instance, such as `Email`        |
| an `n.of()` schema     | its value, such as `readonly Uuid[]` |
| an `n.object()` schema | `ValueOf<typeof Schema>`             |
| any other schema       | `unknown`                            |

A response with a nominal schema takes the schema's value, so a handler returns instances.

## nominalValidatorCompiler()

```ts
nominalValidatorCompiler(options?: NominalValidatorOptions): NominalValidatorCompiler;
```

The compiler `fastifyNominal` uses, for a route on its own:

```ts
import Fastify from 'fastify';
import { n, Uuid } from '@horizon-republic/nominal-types';
import { nominalValidatorCompiler } from '@horizon-republic/nominal-types/adapters/fastify';

const app = Fastify();

app.get(
  '/users/:id',
  { schema: { params: n.object({ id: Uuid }) }, validatorCompiler: nominalValidatorCompiler() },
  (request) => request.params, // GET /users/nope → 400, "params/id must be a UUID (was \"nope\")"
);
```

`options` are `fromString` and `hideValues`, as for `fastifyNominal`. A schema that is not nominal throws when Fastify compiles the route:

```text
nominalValidatorCompiler(): the schema of GET /count querystring is not a nominal type or schema; register fastifyNominal to check other JSON Schemas with Fastify's compiler
```

## nominalSerializerCompiler()

```ts
nominalSerializerCompiler(): NominalSerializerCompiler;
```

Writes each response of a route with its schema's `stringify()`. A schema that is not nominal throws when Fastify compiles the route, with a message like the one above.

[← Adapters](README.md)
