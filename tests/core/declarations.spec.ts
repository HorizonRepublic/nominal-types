import { describe, expect, it } from 'vitest';

import { AnyString, Email, n } from '../../src/index.ts';

// These exports type-check under `npm run typecheck` with declarations on: each type below must
// be spelled out in a declaration file, which needs every part of a brand to have a name.
const nonEmpty = AnyString.subtype('declarations.NonEmpty', /^./u);
const legacy = Email.variant('declarations.LegacyEmail', /^legacy:/u);

export const NonEmpty = nonEmpty;
export const LegacyEmail = legacy;
export const Profile = n.object({
  name: nonEmpty,
  old: legacy,
  tags: n.of(nonEmpty).array(),
});
export const parsed = Profile.parse({ name: 'a', old: 'legacy:x', tags: [] });

describe('types declared without a class of their own', () => {
  it('can be exported and named in declaration files', () => {
    expect(parsed.ok).toBe(true);
  });
});
