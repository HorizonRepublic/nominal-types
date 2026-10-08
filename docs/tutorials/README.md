# Tutorials

Build a sign-up check: one small project, in seven lessons. We start with one type and end with a web server that answers `201` or `400`. Each lesson ends with the full code so far.

You need Node.js 22.18 or later. It runs the TypeScript files of the lessons directly.

1. [Your first type](01-first-type.md): set up a project and make a `Username` type.
2. [Use a built-in type](02-built-in-types.md): add an `Email` and use its methods.
3. [Add behaviour to a type](03-add-behaviour.md): give `Username` a getter and make a `StaffEmail` subtype.
4. [Check input without exceptions](04-check-input.md): check outside input with `parse()`.
5. [Check a whole form](05-check-a-form.md): check every field of a form with `n.object()`.
6. [Check fields against each other](06-fields-together.md): make sure both passwords match with `n.constraint()`.
7. [Answer an HTTP request](07-serve-it.md): serve the check with `node:http`.

[← Documentation](../README.md)
