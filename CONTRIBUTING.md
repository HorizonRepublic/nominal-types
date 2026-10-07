# Contributing

The repository keeps `package-lock.json`. `.node-version` names the Node.js release the checks run on.

A pull request that adds or changes public behaviour updates the README and the pages under `docs/` it touches, in the same change. Its title follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), such as `feat(core): …`.

## Scripts

| Script                              | What it does                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run build`                     | Builds both formats into `dist`, checks how the package resolves and writes `llms-full.txt` |
| `npm run typecheck`                 | Runs the TypeScript compiler without emitting                                               |
| `npm run lint`                      | Runs oxlint with type-aware rules                                                           |
| `npm run format`                    | Formats the tree with oxfmt; `format:check` only reports                                    |
| `npm test`                          | Runs the vitest suites; `test:coverage` adds a coverage report                              |
| `npm run bench`                     | Compares the speed of nominal-types with nine other libraries                               |
| `npm run bench:document`            | Validates a 3 MB document with each library                                                 |
| `npm run bench:nest`                | Posts the same 3 MB document to a NestJS app, once per library                              |
| `npm run profile:cpu -- <script>`   | Profiles a script and lists where the time goes, by place and function                      |
| `npm run profile:deopt -- <script>` | Lists the functions of this package V8 optimised and deoptimised, with reasons              |
