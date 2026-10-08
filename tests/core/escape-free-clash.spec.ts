import { describe, expect, it, vi } from 'vitest';

import { holdsEscapeFreeText } from '../../src/core/escape-free.ts';
import { ownTypes } from '../../src/core/nominal.ts';
import { AnyString, CountryCode, n } from '../../src/index.ts';

describe('a built-in type name declared again with other rules', () => {
  it('leaves both types escaping their text', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const Spoof = AnyString.subtype(
      'nominal.CountryCode',
      n.satisfying((value): value is string => typeof value === 'string', 'any text'),
    );

    expect(warn).toHaveBeenCalledOnce();
    expect(holdsEscapeFreeText(ownTypes.root, CountryCode)).toBe(false);
    expect(holdsEscapeFreeText(ownTypes.root, Spoof)).toBe(false);
    expect(Spoof.stringify(new Spoof('a"b'))).toBe('"a\\"b"');
    warn.mockRestore();
  });
});
