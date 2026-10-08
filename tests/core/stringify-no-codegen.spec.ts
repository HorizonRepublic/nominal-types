import 'temporal-polyfill/global';
import { describe, expect, it, vi } from 'vitest';

import { stringifyCases } from '../support/stringify-cases.ts';

// Every function the package generates is built the way a runtime that forbids code generation,
// such as Cloudflare Workers, builds it.
vi.mock(import('../../src/core/compile.ts'), async (importOriginal) => {
  const compile = await importOriginal();

  return {
    ...compile,
    generateFunction: (names, source, values) =>
      compile.generateFunction(names, source, values, false),
    compileRun: (steps) => compile.compileRun(steps, false),
    brandCheck: (key) => compile.brandCheck(key, false),
  };
});

// Test files share modules, so the package is loaded again for the mock to take effect.
vi.resetModules();

const ownCopy = await import('../../src/index.ts');
const { ownTypes } = await import('../../src/core/nominal.ts');
const { stringifierOf } = await import('../../src/core/stringify.ts');

const slow = (): string => 'slow';

const stringifyAny = (schema: object, value: unknown): unknown => {
  const stringify: unknown = Reflect.get(schema, 'stringify');

  return typeof stringify === 'function' ? Reflect.apply(stringify, schema, [value]) : undefined;
};

describe('stringify() without code generation', () => {
  describe.each(stringifyCases(ownCopy))('$name', ({ schema, values }) => {
    it.each(values.map((value) => [value]))(
      'writes what JSON.stringify() writes for %o',
      (value) => {
        expect(stringifyAny(schema, value)).toBe(JSON.stringify(ownCopy.n.plain(value)));
      },
    );
  });

  it('falls back to the plain copy', () => {
    expect(stringifierOf({ kind: 'type', type: ownCopy.Uuid }, ownTypes, slow)).toBe(slow);
  });

  it('writes a changed instance of a nominal type from its changed value', () => {
    const changed = new ownCopy.Uuid('0190f1c2-3b4a-7c5d-8e9f-0a1b2c3d4e5f');

    Reflect.set(changed, 'value', 'x"');

    expect(ownCopy.Uuid.stringify(changed)).toBe('"x\\""');
  });
});
