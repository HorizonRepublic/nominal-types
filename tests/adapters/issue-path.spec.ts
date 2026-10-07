import { describe, expect, it } from 'vitest';

import { plainPath } from '../../src/adapters/issue-path.ts';

describe('plainPath', () => {
  it('turns path segments into their keys', () => {
    expect(plainPath(['a', 0, { key: 'b' }, { key: 1 }])).toStrictEqual(['a', 0, 'b', 1]);
  });
});
