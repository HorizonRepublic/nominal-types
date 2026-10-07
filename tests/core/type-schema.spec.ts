import { type } from 'arktype';
import { describe, expect, it, vi } from 'vitest';

import { Email, HttpUrl, Nominal, schemaOf, Url, Uuid } from '../../src/index.ts';
import { issuesOf, outputOf, valueOf } from '../support/results.ts';

const first = '0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f';
const second = '6f1c2a3e-8b9d-4e5f-a1b2-c3d4e5f60718';

describe('schemaOf()', () => {
  it('turns a type into a plain Standard Schema object', () => {
    const uuid = schemaOf(Uuid);

    expect(typeof uuid).toBe('object');
    expect(outputOf(uuid['~standard'].validate(first))).toBeInstanceOf(Uuid);
    expect(uuid['~standard'].validate('nope')).toStrictEqual({
      issues: [{ message: 'must be a UUID (was "nope")' }],
    });
  });

  it('passes an existing instance through and narrows a parent instance', () => {
    const url = new Url('https://example.com');

    expect(valueOf(schemaOf(Url).parse(url))).toBe(url);
    expect(valueOf(schemaOf(HttpUrl).parse(url))).toBeInstanceOf(HttpUrl);
  });

  it('embeds into ArkType', () => {
    const invitation = type({ email: schemaOf(Email), team: schemaOf(Uuid).array({ min: 1 }) });
    const { email, team } = invitation.assert({ email: 'jane@example.com', team: [first] });

    expect(email).toBeInstanceOf(Email);
    expect(team[0]).toBeInstanceOf(Uuid);
  });

  it.each([null, undefined, 'Uuid', {}, class Plain {}])(
    'refuses %o, which is not a type',
    (value) => {
      expect(() => {
        Reflect.apply(schemaOf, undefined, [value]);
      }).toThrow(TypeError);
    },
  );

  it('builds instances of a type from another copy of the package', async () => {
    vi.resetModules();
    const copy = await import('../../src/core/nominal.ts');
    const OtherId = copy.Nominal('OtherId', /^id-\d+$/u);

    expect(valueOf(schemaOf(OtherId).parse('id-1'))).toBeInstanceOf(OtherId);
    expect(issuesOf(schemaOf(OtherId).parse('x'))).toHaveLength(1);
  });

  it('describes itself like the type does', () => {
    expect(schemaOf(Uuid)['~standard'].jsonSchema.input({ target: 'draft-2020-12' })).toStrictEqual(
      Uuid['~standard'].jsonSchema.input({ target: 'draft-2020-12' }),
    );
  });
});

describe('array()', () => {
  it('builds a frozen array of instances', () => {
    const ids = valueOf(schemaOf(Uuid).array().parse([first, second]));

    expect(ids).toHaveLength(2);
    expect(ids.every((id) => id instanceof Uuid)).toBe(true);
    expect(Object.isFrozen(ids)).toBe(true);
  });

  it('accepts an empty array unless told otherwise', () => {
    expect(valueOf(schemaOf(Uuid).array().parse([]))).toStrictEqual([]);
  });

  it.each(['a', 1, null, undefined, {}, { length: 1, 0: first }, new Set([first])])(
    'rejects %o, which is not an array',
    (input) => {
      expect(issuesOf(schemaOf(Uuid).array().parse(input))).toHaveLength(1);
    },
  );

  it('reports every bad item with its index', () => {
    expect(issuesOf(schemaOf(Uuid).array().parse([first, 'a', second, 'b']))).toStrictEqual([
      { message: 'must be a UUID (was "a")', path: [1] },
      { message: 'must be a UUID (was "b")', path: [3] },
    ]);
  });

  it('treats a hole as undefined', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(issuesOf(schemaOf(Uuid).array().parse([first, , second]))).toStrictEqual([
      { message: 'must be a string (was undefined)', path: [1] },
    ]);
  });

  it.each([
    [{ length: 2 }, 2, true],
    [{ length: 2 }, 1, false],
    [{ length: 2 }, 3, false],
    [{ length: 0 }, 0, true],
    [{ min: 1 }, 0, false],
    [{ min: 1 }, 1, true],
    [{ max: 2 }, 2, true],
    [{ max: 2 }, 3, false],
    [{ min: 1, max: 1 }, 1, true],
    [{ min: 1, max: 1 }, 2, false],
  ])('with %o answers %d items with %s', (options, count, expected) => {
    expect(
      schemaOf(Uuid)
        .array(options)
        .parse(Array.from({ length: count }, () => first)).ok,
    ).toBe(expected);
  });

  it.each([
    [{ length: 3 }, 2, 'must have 3 items (was 2)'],
    [{ length: 1 }, 2, 'must have 1 item (was 2)'],
    [{ min: 2 }, 1, 'must have at least 2 items (was 1)'],
    [{ max: 1 }, 2, 'must have at most 1 item (was 2)'],
    [{ min: 1, max: 2 }, 3, 'must have at most 2 items (was 3)'],
  ])('with %o reports %d items as %s', (options, count, message) => {
    expect(
      issuesOf(
        schemaOf(Uuid)
          .array(options)
          .parse(Array.from({ length: count }, () => first)),
      ),
    ).toStrictEqual([{ message }]);
  });

  it('checks the count before any item', () => {
    expect(issuesOf(schemaOf(Uuid).array({ max: 1 }).parse(['a', 'b']))).toStrictEqual([
      { message: 'must have at most 1 item (was 2)' },
    ]);
  });

  it.each([
    [{ length: -1 }, 'array(): length must be a whole number from 0 up (was -1)'],
    [{ min: 1.5 }, 'array(): min must be a whole number from 0 up (was 1.5)'],
    [{ max: Number.NaN }, 'array(): max must be a whole number from 0 up (was NaN)'],
    [{ length: 1, min: 1 }, 'array(): pass either length or min and max, not both'],
    [{ min: 3, max: 2 }, 'array(): min (3) is greater than max (2)'],
  ])('refuses %o', (options, message) => {
    expect(() => schemaOf(Uuid).array(options)).toThrow(new TypeError(message));
  });

  it('nests, with the path of every level', () => {
    expect(
      issuesOf(
        schemaOf(Uuid)
          .array()
          .array()
          .parse([[first], [second, 'x']]),
      ),
    ).toStrictEqual([{ message: 'must be a UUID (was "x")', path: [1, 1] }]);
  });

  it('describes itself as a JSON Schema array', () => {
    const rangeSchema = schemaOf(Uuid).array({ min: 1, max: 3 })['~standard'].jsonSchema;

    expect(rangeSchema.input({ target: 'draft-2020-12' })).toStrictEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'array',
      items: { type: 'string', pattern: Uuid.pattern.source, description: 'a UUID' },
      minItems: 1,
      maxItems: 3,
    });
    expect(
      schemaOf(Uuid).array({ length: 2 })['~standard'].jsonSchema.output({ target: 'openapi-3.0' }),
    ).toMatchObject({
      minItems: 2,
      maxItems: 2,
    });
    expect(
      schemaOf(Uuid).array()['~standard'].jsonSchema.input({ target: 'openapi-3.0' }),
    ).not.toHaveProperty('minItems');
  });
});

describe('optional() and nullable()', () => {
  it('let undefined or null through, and check anything else', () => {
    expect(schemaOf(Email).optional().parse(undefined)).toStrictEqual({
      ok: true,
      value: undefined,
    });
    expect(schemaOf(Email).optional().parse(null).ok).toBe(false);
    expect(schemaOf(Email).nullable().parse(null)).toStrictEqual({ ok: true, value: null });
    expect(schemaOf(Email).nullable().parse(undefined).ok).toBe(false);
    expect(valueOf(schemaOf(Email).optional().nullable().parse('jane@example.com'))).toBeInstanceOf(
      Email,
    );
  });

  it('combine with arrays in the order they are read', () => {
    expect(schemaOf(Uuid).array().optional().parse(undefined).ok).toBe(true);
    expect(schemaOf(Uuid).array().optional().parse([undefined]).ok).toBe(false);
    expect(schemaOf(Uuid).optional().array().parse([undefined, first]).ok).toBe(true);
    expect(schemaOf(Uuid).optional().array().parse(undefined).ok).toBe(false);
  });

  it('leave the original schema as it was', () => {
    const email = schemaOf(Email);
    email.optional();

    expect(email.parse(undefined).ok).toBe(false);
  });

  it('describe null for JSON Schema and for OpenAPI 3.0', () => {
    const body = { type: 'string', pattern: Email.pattern.source, description: 'an email address' };

    expect(
      schemaOf(Email).nullable()['~standard'].jsonSchema.input({ target: 'draft-07' }),
    ).toStrictEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      anyOf: [body, { type: 'null' }],
    });
    expect(
      schemaOf(Email).nullable()['~standard'].jsonSchema.input({ target: 'openapi-3.0' }),
    ).toStrictEqual({
      ...body,
      nullable: true,
    });
    expect(
      schemaOf(Email).optional()['~standard'].jsonSchema.input({ target: 'openapi-3.0' }),
    ).toStrictEqual(body);
  });
});

describe('a nominal type over an array', () => {
  const UserId = Uuid.subtype('UserId');
  class Podium extends Nominal('Podium', schemaOf(UserId).array({ length: 3 })) {
    public get winner(): InstanceType<typeof UserId> | undefined {
      return this.value[0];
    }
  }

  it('holds exactly the items its rule allows, frozen', () => {
    const podium = new Podium([first, second, first]);

    expect(podium.winner).toBeInstanceOf(UserId);
    expect(Object.isFrozen(podium.value)).toBe(true);
    expect(Podium.parse([first]).ok).toBe(false);
  });

  it('compares item by item', () => {
    expect(new Podium([first, second, first]).equals(new Podium([first, second, first]))).toBe(
      true,
    );
    expect(new Podium([first, second, first]).equals(new Podium([second, second, first]))).toBe(
      false,
    );
  });

  it('writes its items to JSON', () => {
    expect(JSON.stringify(new Podium([first, second, first]))).toBe(
      `["${first}","${second}","${first}"]`,
    );
  });

  it('describes itself as the array', () => {
    expect(Podium['~standard'].jsonSchema.input({ target: 'openapi-3.0' })).toMatchObject({
      type: 'array',
      minItems: 3,
      maxItems: 3,
    });
  });
});
