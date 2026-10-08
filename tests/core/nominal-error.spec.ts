import { describe, expect, it, vi } from 'vitest';

import type * as library from '../../src/index.ts';
import { Email, NominalError } from '../../src/index.ts';
import { thrownBy } from '../support/results.ts';

type Library = typeof library;

const anotherCopy = (): Promise<Library> => {
  vi.resetModules();

  return import('../../src/index.ts');
};

describe('NominalError', () => {
  it('passes instanceof for an error thrown by another copy, and the other way round', async () => {
    const copy = await anotherCopy();
    const fromCopy = thrownBy(() => new copy.Email('nope'));
    const fromHere = thrownBy(() => new Email('nope'));

    expect(copy.NominalError).not.toBe(NominalError);
    expect(fromCopy).toBeInstanceOf(NominalError);
    expect(fromHere).toBeInstanceOf(copy.NominalError);
    expect(fromCopy).toBeInstanceOf(TypeError);
  });

  it.each<unknown>([
    new TypeError('x'),
    { name: 'NominalError', issues: [] },
    Object.create(TypeError.prototype),
    null,
    'NominalError',
  ])('refuses %o', (value) => {
    expect(value instanceof NominalError).toBe(false);
  });

  it('keeps instanceof of a class extending it to its own instances', () => {
    class OrderError extends NominalError {}

    expect(new OrderError('Order', []) instanceof OrderError).toBe(true);
    expect(new OrderError('Order', []) instanceof NominalError).toBe(true);
    expect(new NominalError('Order', []) instanceof OrderError).toBe(false);
  });
});
