import { type } from 'arktype';
import { describe, expect, it } from 'vitest';

import { fromArk, toArk } from '../../src/adapters/arktype/index.ts';
import { AnyString, Email, n, NominalError, PositiveInteger, Uuid } from '../../src/index.ts';
import { issuesOf, valueOf } from '../support/results.ts';

const uuid = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';

const rejectionOf = async (promise: Promise<unknown>): Promise<NominalError> => {
  const reason: unknown = await promise.then(
    () => null,
    (error: unknown) => error,
  );

  if (!(reason instanceof NominalError)) {
    throw new TypeError('the promise was not rejected with a NominalError');
  }

  return reason;
};

describe('parseAsync() of a nominal type', () => {
  it('resolves to an instance, keeping a trusted one as it is', async () => {
    const email = new Email('jane@example.com');

    await expect(Email.parseAsync('jane@example.com')).resolves.toBeInstanceOf(Email);
    await expect(Email.parseAsync(email)).resolves.toBe(email);
  });

  it('rejects with a NominalError that carries the issues', async () => {
    const error = await rejectionOf(PositiveInteger.parseAsync(0));

    expect(error.typeName).toBe('nominal.PositiveInteger');
    expect(error.issues).toStrictEqual([{ message: 'must be a positive integer (was 0)' }]);
    expect(error.message).toBe('nominal.PositiveInteger: must be a positive integer (was 0)');
  });

  it('rejects input of the wrong kind, and keeps a sensitive value out', async () => {
    await expect(Uuid.parseAsync(42)).rejects.toThrow('nominal.Uuid: must be a string (was 42)');
    await expect(Email.parseAsync('jane')).rejects.toThrow(
      'nominal.Email: must be an email address (was a string of 4 characters)',
    );
  });

  it('never throws before returning the promise', () => {
    const pending = AnyString.parseAsync(null);

    expect(pending).toBeInstanceOf(Promise);

    return expect(pending).rejects.toBeInstanceOf(NominalError);
  });

  it.each(['', 'x', uuid.slice(1), 1, null, undefined, {}])(
    'rejects %j with the issues parse() gives',
    async (input) => {
      const parsed = Uuid.parse(input);

      await expect(rejectionOf(Uuid.parseAsync(input))).resolves.toMatchObject({
        issues: issuesOf(parsed),
      });
    },
  );

  it.each([uuid, uuid.toUpperCase()])('resolves %j to what parse() gives', async (input) => {
    await expect(Uuid.parseAsync(input)).resolves.toStrictEqual(valueOf(Uuid.parse(input)));
  });
});

describe('parseAsync() of a schema', () => {
  const Order = n.object({ customer: Email, quantity: PositiveInteger });

  it('resolves to what parse() gives', async () => {
    await expect(n.of(Uuid).array().parseAsync([uuid])).resolves.toStrictEqual([new Uuid(uuid)]);
    await expect(n.of(Uuid).optional().parseAsync(undefined)).resolves.toBeUndefined();
    await expect(Order.parseAsync({ customer: 'jane@example.com', quantity: 2 })).resolves.toEqual({
      customer: new Email('jane@example.com'),
      quantity: new PositiveInteger(2),
    });
  });

  it('names the function that built the schema in the message', async () => {
    await expect(n.of(Uuid).parseAsync('x')).rejects.toThrow('n.of(): must be a UUID (was "x")');
    await expect(n.of(Uuid).array().nullable().parseAsync(['x'])).rejects.toThrow(
      'n.of(): 0: must be a UUID (was "x")',
    );
    await expect(n.of(PositiveInteger).fromString().parseAsync('0')).rejects.toThrow(
      'n.of(): must be a positive integer (was 0)',
    );
    await expect(Order.array().parseAsync([{ customer: 'jane', quantity: 1 }])).rejects.toThrow(
      'n.object(): 0.customer: must be an email address (was a string of 4 characters)',
    );
    await expect(Order.pick('quantity').parseAsync({ quantity: 0 })).rejects.toThrow(
      'n.object(): quantity: must be a positive integer (was 0)',
    );
  });

  it('rejects with every issue', async () => {
    const error = await rejectionOf(Order.parseAsync({ customer: 'jane', quantity: 0 }));

    expect(error.typeName).toBe('n.object()');
    expect(error.issues).toStrictEqual([
      { message: 'must be an email address (was a string of 4 characters)', path: ['customer'] },
      { message: 'must be a positive integer (was 0)', path: ['quantity'] },
    ]);
  });

  it('names n.union() for a union', async () => {
    const Payment = n.union('method', {
      card: n.object({ token: AnyString }),
      invoice: n.object({ email: Email }),
    });

    await expect(Payment.parseAsync({ method: 'card', token: 'tok_1' })).resolves.toMatchObject({
      method: 'card',
    });
    await expect(Payment.parseAsync({ method: 'cash' })).rejects.toThrow(
      'n.union(): method: must be one of "card", "invoice" (was "cash")',
    );
  });

  it('names fromArk() for an ArkType schema', async () => {
    const ArkOrder = fromArk(type({ customer: toArk(Email) }));

    await expect(ArkOrder.parseAsync({ customer: 'jane@example.com' })).resolves.toMatchObject({
      customer: { value: 'jane@example.com' },
    });
    await expect(rejectionOf(ArkOrder.parseAsync({ customer: 1 }))).resolves.toMatchObject({
      typeName: 'fromArk()',
    });
  });
});
