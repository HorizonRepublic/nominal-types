import { describe, expect, it, vi } from 'vitest';

import { ownTypes } from '../../src/core/nominal.ts';
import { AnyNumber, AnyString, Email, n, PositiveInteger, Uuid } from '../../src/index.ts';
import type { ObjectSchema } from '../../src/index.ts';
import { valueOf } from '../support/results.ts';

const id = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';
const injection = 'x", "admin": true, "y": "';

// stringify() given a value its type doesn't allow, as plain JavaScript can.
const stringifyAny = (schema: object, value: unknown): unknown => {
  const stringify: unknown = Reflect.get(schema, 'stringify');

  return typeof stringify === 'function' ? Reflect.apply(stringify, schema, [value]) : undefined;
};

const keysOf = (text: string): string[] => {
  const parsed: unknown = JSON.parse(text);

  return typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : [];
};

describe('stringify() of an n.union() schema', () => {
  const Payment = n.union('method', {
    card: n.object({ token: AnyString }),
    invoice: n.object({ email: Email, method: AnyString }),
  });

  it('writes the tag first, then the fields of its variant', () => {
    const value = valueOf(Payment.parse({ email: 'jane@example.com', method: 'invoice' }));

    expect(Payment.stringify(value)).toBe('{"method":"invoice","email":"jane@example.com"}');
  });

  it("writes a variant's instances without calling toJSON()", () => {
    const toJson = vi.spyOn(ownTypes.root.prototype, 'toJSON');
    const value = valueOf(Payment.parse({ method: 'card', token: 'tok "1"' }));

    expect(Payment.stringify(value)).toBe('{"method":"card","token":"tok \\"1\\""}');
    expect(toJson).not.toHaveBeenCalled();
    toJson.mockRestore();
  });

  it('writes an object with another tag, or no object, as JSON.stringify(n.plain()) does', () => {
    const unknown = { method: injection, token: new AnyString('a') };
    const wrongTag = { method: 1, token: new AnyString('a') };

    expect(stringifyAny(Payment, unknown)).toBe(JSON.stringify(n.plain(unknown)));
    expect(stringifyAny(Payment, wrongTag)).toBe(JSON.stringify(n.plain(wrongTag)));
    expect(stringifyAny(Payment, 'card')).toBe('"card"');
    expect(stringifyAny(Payment, [new AnyString('a')])).toBe('["a"]');
  });
});

describe('stringify() of schemas made by partial(), pick(), omit() and extend()', () => {
  const Base = n.object({ id: Uuid, note: n.of(AnyString).optional(), quantity: PositiveInteger });
  const input = { quantity: 2, total: 1.5, note: 'n', id };
  const cases: Array<readonly [ObjectSchema<unknown, unknown>, string]> = [
    [Base.partial(), `{"id":"${id}","note":"n","quantity":2}`],
    [Base.pick('quantity', 'id'), `{"id":"${id}","quantity":2}`],
    [Base.omit('note'), `{"id":"${id}","quantity":2}`],
    [
      Base.extend({ total: AnyNumber, id: AnyString }),
      `{"id":"${id}","note":"n","quantity":2,"total":1.5}`,
    ],
  ];

  it.each(cases)('writes the fields in the order of the schema, %#', (schema, expected) => {
    const value: unknown = valueOf(schema.parse(input));

    expect(stringifyAny(schema, value)).toBe(expected);
    expect(keysOf(expected)).toStrictEqual(schema.keys);
    expect(stringifyAny(schema, value)).toBe(JSON.stringify(n.plain(value)));
  });
});
