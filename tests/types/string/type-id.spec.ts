import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as library from '../../../src/index.ts';
import { AnyString, NominalError, TypeId, Uuid, UuidV7 } from '../../../src/index.ts';
import type * as generator from '../../../src/types/string/uuid-v7-bytes.ts';
import { satisfiesSchema } from '../../support/json-schema.ts';
import { issuesOf, thrownBy, valueOf } from '../../support/results.ts';
import { invalidTypeIds, validTypeIds } from './fixtures/typeid-spec.ts';

class UserId extends TypeId.subtype('test.UserId', TypeId.withPrefix('user')) {}
class BareId extends TypeId.subtype('test.BareId', TypeId.withPrefix('')) {}
class AdminId extends UserId.subtype('test.AdminId', /^user_0/u) {}

// The generator keeps the last time it used, so tests that move the clock get their own copy.
const freshGenerator = (): Promise<typeof generator> => {
  vi.resetModules();

  return import('../../../src/types/string/uuid-v7-bytes.ts');
};

const hexOf = (bytes: Uint8Array): string => {
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const suffix = '01h455vb4pex5vsknk084sn02q';
const longestPrefix = `a${'_'.repeat(61)}z`;
const schema = TypeId['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
const userSchema = UserId['~standard'].jsonSchema.input({ target: 'draft-2020-12' });

const accepted = [
  ...validTypeIds.map(({ typeid }) => typeid),
  `${longestPrefix}_${suffix}`,
  `a_${suffix}`,
  `user_${suffix}`,
];
const rejected = [
  ...invalidTypeIds.map(([, typeid]) => typeid),
  `${'a'.repeat(64)}_${suffix}`,
  `a${'_'.repeat(62)}z_${suffix}`,
  `user_${suffix.toUpperCase()}`,
  `user-${suffix}`,
  `user_${suffix}\n`,
  `\nuser_${suffix}`,
  `user1_${suffix}`,
  `us er_${suffix}`,
  `user_${suffix.slice(0, 25)}l`,
  `user_${suffix.slice(0, 25)}u`,
];

describe('TypeId', () => {
  it.each(validTypeIds)('accepts the valid vector $name', ({ typeid, prefix, uuid }) => {
    const id = new TypeId(typeid);

    expect(id.value).toBe(typeid);
    expect(id.prefix).toBe(prefix);
    expect(TypeId.fromUuid(uuid, prefix).value).toBe(typeid);
  });

  it.each(invalidTypeIds)('rejects the invalid vector %s', (_, typeid) => {
    expect(() => new TypeId(typeid)).toThrow(NominalError);
  });

  it.each(accepted)('accepts %s', (text) => {
    expect(TypeId.parse(text).ok).toBe(true);
  });

  it.each(rejected)('rejects %j', (text) => {
    expect(TypeId.parse(text).ok).toBe(false);
  });

  it('takes a 63-character prefix and refuses 64 characters', () => {
    expect(longestPrefix).toHaveLength(63);
    expect(`${longestPrefix}_${suffix}`).toHaveLength(90);
    expect(new TypeId(`${longestPrefix}_${suffix}`).prefix).toBe(longestPrefix);
    expect(issuesOf(TypeId.parse(`${'a'.repeat(64)}_${suffix}`))).toStrictEqual([
      { message: `must be a TypeID (was a string of 91 characters starting "${'a'.repeat(32)}"…)` },
    ]);
  });

  it.each([1, null, undefined, {}, [], new Object(`user_${suffix}`)])('rejects %s', (input) => {
    expect(issuesOf(TypeId.parse(input))).toHaveLength(1);
  });

  it.each([...accepted, ...rejected, 26])('agrees with its JSON Schema on %j', (value) => {
    expect(satisfiesSchema(schema, value)).toBe(TypeId.parse(value).ok);
  });

  it('decodes the UUID of every valid vector that Uuid accepts', () => {
    const decoded = validTypeIds
      .filter(({ uuid }) => Uuid.accepts(uuid))
      .map(({ typeid, uuid }) => [new TypeId(typeid).toUuid().value, uuid]);

    expect(decoded.length).toBeGreaterThan(3);
    expect(decoded.every(([left, right]) => left === right)).toBe(true);
  });

  it('refuses to make a Uuid of bits that are not one', () => {
    expect(thrownBy(() => new TypeId('00000000000000000000000001').toUuid())).toBeInstanceOf(
      NominalError,
    );
  });

  it('reads the prefix and the suffix', () => {
    const id = new TypeId(`pre_fix_${suffix}`);

    expect(id.prefix).toBe('pre_fix');
    expect(id.suffix).toBe(suffix);
    expect(new TypeId(suffix).prefix).toBe('');
  });

  it('reads the time from a version 7 UUID only', () => {
    expect(new TypeId(`prefix_${suffix}`).timestamp?.toISOString()).toBe(
      new UuidV7('01890a5d-ac96-774b-bcce-b302099a8057').timestamp.toISOString(),
    );
    expect(new TypeId('00000000000000000000000000').timestamp).toBeUndefined();
    expect(new TypeId('prefix_0123456789abcdefghjkmnpqrs').timestamp).toBeUndefined();
  });

  it('round-trips a thousand random UUIDs, as the specification recommends', () => {
    const uuids = Array.from({ length: 1000 }, () => crypto.randomUUID());

    expect(uuids.every((uuid) => TypeId.fromUuid(uuid, 'item').toUuid().value === uuid)).toBe(true);
  });

  it('encodes a Uuid instance and either case the same way', () => {
    const uuid = '01890A5D-AC96-774B-BCCE-B302099A8057';

    expect(TypeId.fromUuid(new Uuid(uuid), 'prefix').value).toBe(`prefix_${suffix}`);
    expect(TypeId.fromUuid(uuid, 'prefix').value).toBe(`prefix_${suffix}`);
  });

  it.each(['', 'not-a-uuid', '01890a5dac96774bbcceb302099a8057'])(
    'refuses %j in fromUuid',
    (text) => {
      expect(thrownBy(() => TypeId.fromUuid(text, 'a'))).toBeInstanceOf(TypeError);
    },
  );

  it.each(['User', 'user_', '_user', 'us3r', 'a'.repeat(64), 'юзер'])(
    'refuses the prefix %j wherever one is given',
    (prefix) => {
      expect(() => TypeId.withPrefix(prefix)).toThrow(TypeError);
      expect(() => TypeId.generate(prefix)).toThrow(TypeError);
      expect(() => TypeId.fromUuid(crypto.randomUUID(), prefix)).toThrow(TypeError);
    },
  );

  it('stays apart from a sibling type with the same text', () => {
    const Other = AnyString.subtype('test.Other');

    expect(new TypeId(suffix).equals(new Other(suffix))).toBe(false);
    expect(new TypeId(suffix).equals(new TypeId(suffix))).toBe(true);
  });

  it('stays fast on a long crafted input', () => {
    const started = performance.now();

    expect(TypeId.parse(`${'a_'.repeat(50_000)}${suffix}`).ok).toBe(false);
    expect(TypeId.parse(`${'a'.repeat(100_000)}_${suffix}`).ok).toBe(false);
    expect(TypeId.parse('0'.repeat(100_000)).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('narrows a value built by another copy of the package', async () => {
    vi.resetModules();
    const copy: typeof library = await import('../../../src/index.ts');

    expect(valueOf(TypeId.parse(new copy.TypeId(suffix)))).toStrictEqual(new TypeId(suffix));
    expect(valueOf(TypeId.parse(new copy.AnyString(suffix)))).toBeInstanceOf(TypeId);
  });
});

describe('TypeId.withPrefix', () => {
  it('makes a subtype that takes only its own prefix', () => {
    expect(new UserId(`user_${suffix}`)).toBeInstanceOf(TypeId);
    expect(issuesOf(UserId.parse(`order_${suffix}`))).toStrictEqual([
      { message: `must be a TypeID with the prefix user (was "order_${suffix}")` },
    ]);
    expect(UserId.parse(`super_user_${suffix}`).ok).toBe(false);
    expect(UserId.parse(`users_${suffix}`).ok).toBe(false);
    expect(UserId.parse(suffix).ok).toBe(false);
    expect(UserId.parse(new TypeId(`user_${suffix}`)).ok).toBe(true);
  });

  it('makes a type of ids without a prefix from an empty one', () => {
    expect(BareId.parse(suffix).ok).toBe(true);
    expect(issuesOf(BareId.parse(`user_${suffix}`))).toStrictEqual([
      { message: `must be a TypeID without a prefix (was "user_${suffix}")` },
    ]);
  });

  it.each([
    `user_${suffix}`,
    `order_${suffix}`,
    `super_user_${suffix}`,
    `users_${suffix}`,
    suffix,
    `user_${suffix}x`,
  ])('agrees with its JSON Schema on %s', (value) => {
    expect(satisfiesSchema(userSchema, value)).toBe(UserId.parse(value).ok);
  });

  it('gives an example its own type accepts', () => {
    expect(userSchema).toMatchObject({ examples: [`user_${suffix}`] });
  });
});

describe('TypeId.generate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('makes an id of the class it is called on, with its fixed prefix', () => {
    const id = UserId.generate();

    expect(id).toBeInstanceOf(UserId);
    expect(id.prefix).toBe('user');
    expect(AdminId.generate()).toBeInstanceOf(AdminId);
    expect(AdminId.generate().prefix).toBe('user');
  });

  it('takes a prefix on TypeId, and none by default', () => {
    expect(TypeId.generate('order').prefix).toBe('order');
    expect(TypeId.generate().value).toHaveLength(26);
    expect(TypeId.fromUuid('01890a5d-ac96-774b-bcce-b302099a8057').value).toBe(suffix);
  });

  it('finds the fixed prefix through a class that adds no rule', () => {
    class StaffId extends UserId {}

    expect(StaffId.generate().prefix).toBe('user');
    expect(StaffId.fromUuid('01890a5d-ac96-774b-bcce-b302099a8057')).toBeInstanceOf(StaffId);
  });

  it('refuses a prefix other than the fixed one', () => {
    expect(thrownBy(() => UserId.generate('order'))).toBeInstanceOf(NominalError);
  });

  it('holds a version 7 UUID with the RFC 9562 variant and the current time', () => {
    vi.useFakeTimers({ now: new Date('2026-10-08T12:00:00.000Z'), toFake: ['Date'] });

    const id = TypeId.generate('order');

    expect(valueOf(UuidV7.parse(id.toUuid().value)).timestamp.toISOString()).toBe(
      '2026-10-08T12:00:00.000Z',
    );
    expect(id.timestamp?.toISOString()).toBe('2026-10-08T12:00:00.000Z');
  });

  it('sorts ids made in one millisecond in the order they were made', () => {
    vi.useFakeTimers({ now: new Date('2026-10-08T12:00:00.000Z'), toFake: ['Date'] });

    const ids = Array.from({ length: 10_000 }, () => TypeId.generate('order').value);

    expect(ids.toSorted()).toStrictEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the order when the clock goes back', async () => {
    const { uuidV7Bytes } = await freshGenerator();
    const first = hexOf(uuidV7Bytes(2_000_000_000_000));
    const second = hexOf(uuidV7Bytes(1_000_000_000_000));

    expect(second > first).toBe(true);
    expect(new UuidV7(second).timestamp.getTime()).toBe(2_000_000_000_000);
  });

  it('moves to the next millisecond when the counter runs out', async () => {
    const { uuidV7Bytes } = await freshGenerator();
    const ids = Array.from({ length: 5000 }, () => hexOf(uuidV7Bytes(1_500_000_000_000)));
    const last = new UuidV7(String(ids.at(-1))).timestamp.getTime();

    expect(last).toBeGreaterThan(1_500_000_000_000);
    expect(ids.toSorted()).toStrictEqual(ids);
  });
});
