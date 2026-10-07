# @horizon-republic/nominal-types

Nominal types with runtime validation for TypeScript.

The `main` branch holds the 3.0 rewrite and has published nothing yet. Version 2 stays on npm:

```shell
npm install @horizon-republic/nominal-types@2
```

## Compatibility

The package ships ES modules and CommonJS side by side, each with its own type declarations, and runs on Node.js 22.12 or later.

## Development

Any package manager installs it; the repository itself keeps `package-lock.json`, and `.node-version` names the Node.js release the checks run on.

| Script              | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm run build`     | Builds both formats into `dist` and checks how the package resolves |
| `npm run typecheck` | Runs the TypeScript compiler without emitting                       |
| `npm run lint`      | Runs oxlint with type-aware rules                                   |
| `npm run format`    | Formats the tree with oxfmt; `format:check` only reports            |
| `npm test`          | Runs the vitest suites; `test:coverage` adds a coverage report      |

## License

Licensed under the terms in [LICENSE](LICENSE).
