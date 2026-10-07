# Generating JSON Schema

A type built on a schema that can describe itself, as ArkType schemas can, also produces JSON Schema through [Standard JSON Schema](https://standardschema.dev):

```ts
Uuid['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
// { $schema: '…', type: 'string', pattern: '…', description: 'a UUID' }
```

A type whose schema cannot describe itself throws when asked.

[← Documentation](../README.md)
