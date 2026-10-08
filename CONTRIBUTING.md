# Contributing

The repository keeps `package-lock.json`. `.node-version` names the Node.js release the checks run on. `npm run build` needs Node.js 24.11 or later.

Building needs Node.js 24.11 or later: the build checks the package with `@arethetypeswrong/core`, which an older Node.js 24 can't load. With nvm, run `nvm install 24` and `nvm use 24`. The scripts that build first, such as `npm run bench`, need it too.

A pull request that adds or changes public behaviour updates the README and the pages under `docs/` it touches, in the same change. Its title follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), such as `feat(core): …`.

## Scripts

| Script                              | What it does                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run build`                     | Builds both formats into `dist` and checks how the package resolves                         |
| `npm run typecheck`                 | Runs the TypeScript compiler without emitting                                               |
| `npm run lint`                      | Runs oxlint with type-aware rules                                                           |
| `npm run format`                    | Formats the tree with oxfmt; `format:check` only reports                                    |
| `npm test`                          | Runs the vitest suites; `test:coverage` adds a coverage report and its floor                |
| `npm run test:dist`                 | Imports every entry of the built `dist` with `import` and `require`                         |
| `npm run test:size`                 | Bundles small apps from the built `dist` with esbuild and fails when one outgrows its limit |
| `npm run bench`                     | Compares the speed of nominal-types with nine other libraries                               |
| `npm run bench:document`            | Validates a 3 MB document with each library                                                 |
| `npm run bench:nest`                | Posts the same 3 MB document to a NestJS app, once per library                              |
| `npm run profile:cpu -- <script>`   | Profiles a script and lists where the time goes, by place and function                      |
| `npm run profile:deopt -- <script>` | Lists the functions of this package V8 optimised and deoptimised, with reasons              |
