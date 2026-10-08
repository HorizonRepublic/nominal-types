# Answer an HTTP request

Lesson 7 of 7 in "Build a sign-up check".

In this lesson we put `SignUp` behind a small web server. It answers `201 Created` for a good form and `400 Bad Request` with the issues for a bad one. We use `node:http`, which comes with Node.js.

At the end, `node main.ts` prints:

```text
Listening on http://localhost:3000
```

## Before we start

We continue with the `main.ts` from [Check fields against each other](06-fields-together.md).

In `main.ts`, delete the `checkSignUp` function and everything below it. We keep the types, `passwordsMatch` and `SignUp`.

## Step 1: Turn a form into an answer

Add a function that turns a form into a status code and a body, and a call to try it. Put these lines at the end of `main.ts`:

```ts
const signUp = (body: unknown): { status: number; json: unknown } => {
  const result = SignUp.parse(body);

  if (!result.ok) {
    return { status: 400, json: { issues: result.issues } };
  }

  const { username, email } = result.value;

  return { status: 201, json: { username, email, profile: username.profilePath } };
};

const reply = signUp({
  username: 'jane_doe',
  email: 'jane@example.com',
  password: 'correct horse battery',
  repeatPassword: 'correct horse battery',
});

console.log(JSON.stringify(reply));
```

Run `node main.ts`. The output is:

```text
{"status":201,"json":{"username":"jane_doe","email":"jane@example.com","profile":"/users/jane_doe"}}
```

Notice that `username` and `email` become plain strings: an instance writes its `value` to JSON. The answer leaves the password out.

## Step 2: Start the server

Delete the `reply` lines from step 1: the `const reply = signUp(…)` call and the `console.log` after it.

Add two imports at the top of `main.ts`, above the import of the package:

```ts
import { createServer } from 'node:http';
import { text } from 'node:stream/consumers';
```

Add these lines at the end of `main.ts`:

```ts
const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

const server = createServer(async (request, response) => {
  const reply = signUp(parseJson(await text(request)));

  response.writeHead(reply.status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(reply.json));
});

server.listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});
```

Here is what each part does:

- `text(request)` reads the whole request body as a string.
- `parseJson()` turns the string into data. For text that is not JSON, it returns `undefined`, and `SignUp` rejects that.
- The server answers every request with the status and body from `signUp()`.

Run `npx tsc --noEmit`. It prints nothing. Then run `node main.ts`. The output is:

```text
Listening on http://localhost:3000
```

The server keeps running. Leave this terminal open.

## Step 3: Send a good form

Open a second terminal. Send a form with `curl`:

```shell
curl -i http://localhost:3000/sign-up \
  -H 'content-type: application/json' \
  -d '{"username":"jane_doe","email":"jane@example.com","password":"correct horse battery","repeatPassword":"correct horse battery"}'
```

`-d` sends the text as the request body, and `-i` shows the status line and headers of the answer. The output is:

```text
HTTP/1.1 201 Created
content-type: application/json
Date: Wed, 07 Oct 2026 20:56:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"username":"jane_doe","email":"jane@example.com","profile":"/users/jane_doe"}
```

Your `Date` line shows the current time.

## Step 4: Send a bad form

In the second terminal, send a form with a bad username, a bad email and passwords that don't match:

```shell
curl -i http://localhost:3000/sign-up \
  -H 'content-type: application/json' \
  -d '{"username":"Jane Doe","email":"jane","password":"correct horse battery","repeatPassword":"correct horse batery"}'
```

The output is:

```text
HTTP/1.1 400 Bad Request
content-type: application/json
Date: Wed, 07 Oct 2026 20:56:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"issues":[{"message":"must be matched by ^[a-z0-9_]{3,20}$ (was \"Jane Doe\")","path":["username"]},{"message":"must be an email address (was a string of 4 characters)","path":["email"]}]}
```

The password issue comes once the fields are fixed, as in lesson 6.

## Step 5: Send text that is not JSON

In the second terminal, send a plain word:

```shell
curl -i http://localhost:3000/sign-up -d 'hello'
```

The output is:

```text
HTTP/1.1 400 Bad Request
content-type: application/json
Date: Wed, 07 Oct 2026 20:56:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"issues":[{"message":"must be an object (was undefined)"}]}
```

`SignUp` rejected the `undefined` from `parseJson()`, and the server kept running.

Stop the server: go back to the first terminal and press `Ctrl+C`.

This server reads a body of any size. A real server limits the size before it checks the fields. [Where checks belong](../explanation/where-checks-belong.md) explains which layer does what.

## What we built

A web server checks sign-up forms with our own types. It answers `201` for a good form and `400` with the issues for a bad one.

Here is the full `main.ts`:

```ts
// main.ts
import { createServer } from 'node:http';
import { text } from 'node:stream/consumers';

import { AnyBoolean, AnyString, Email, n } from '@horizon-republic/nominal-types';

class Username extends AnyString.subtype('shop.Username', /^[a-z0-9_]{3,20}$/u) {
  get profilePath(): string {
    return `/users/${this.value}`;
  }
}

class StaffEmail extends Email.subtype('shop.StaffEmail', /@shop\.example\.com$/u) {}

class Password extends AnyString.subtype('shop.Password', /^.{12,}$/u, { sensitive: true }) {}

const passwordsMatch = n.constraint(
  { password: Password, repeatPassword: Password },
  ({ password, repeatPassword }) => password.equals(repeatPassword),
  { path: 'repeatPassword', message: 'must match the password' },
);

const SignUp = n.object(
  {
    username: Username,
    email: Email,
    password: Password,
    repeatPassword: Password,
    newsletter: n.of(AnyBoolean).optional(),
  },
  passwordsMatch,
);

const signUp = (body: unknown): { status: number; json: unknown } => {
  const result = SignUp.parse(body);

  if (!result.ok) {
    return { status: 400, json: { issues: result.issues } };
  }

  const { username, email } = result.value;

  return { status: 201, json: { username, email, profile: username.profilePath } };
};

const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

const server = createServer(async (request, response) => {
  const reply = signUp(parseJson(await text(request)));

  response.writeHead(reply.status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(reply.json));
});

server.listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});
```

## Next steps

You finished the tutorial. Next, put the same types into a real application:

- [How to use nominal types with NestJS](../guides/frameworks/nestjs.md) checks bodies like `SignUp` in a NestJS app.
- [How to check a request body with n.object()](../guides/core/check-an-object.md) covers nested objects, lists and strict mode.

[← Tutorials](README.md)
