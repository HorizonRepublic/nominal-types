import { describe, expect, it } from 'vitest';

import { compileRun } from '../../src/core/compile.ts';
import { stepsOf } from '../../src/core/plan.ts';
import { Rejection } from '../../src/core/rejection.ts';
import { AnyString, n } from '../../src/index.ts';
import { generator } from '../support/random-text.ts';

const stepsFor = (list: readonly RegExp[]): ReturnType<typeof stepsOf> =>
  stepsOf(
    list.map((pattern) => n.matching(pattern)),
    () => {
      throw new TypeError('only patterns here');
    },
  );

const runFor = (list: readonly RegExp[], generate: boolean): ((text: string) => boolean) => {
  const run = compileRun(stepsFor(list), generate);

  return (text) => !(run(text) instanceof Rejection);
};

const oneByOne =
  (list: readonly RegExp[]) =>
  (text: string): boolean =>
    list.every((pattern) => pattern.test(text));

// Every string of a and b up to six characters, and some longer ones.
const texts = ((): string[] => {
  const all = [''];

  for (let length = 1; length <= 6; length += 1) {
    for (let bits = 0; bits < 2 ** length; bits += 1) {
      all.push(bits.toString(2).padStart(length, '0').replaceAll('0', 'a').replaceAll('1', 'b'));
    }
  }

  const next = generator(7);

  for (let count = 0; count < 100; count += 1) {
    const length = 7 + Math.floor(next() * 6);

    all.push(Array.from({ length }, () => (next() < 0.5 ? 'a' : 'b')).join(''));
  }

  return all;
})();

interface Draft {
  groups: number;
  readonly names: string[];
}

// A random pattern over a and b with groups, backreferences, lookarounds and alternation.
const randomPattern = (next: () => number): string => {
  const pick = <Item>(items: readonly Item[]): Item => {
    const item = items[Math.floor(next() * items.length)];

    if (item === undefined) {
      throw new RangeError('empty choice');
    }

    return item;
  };

  const draft: Draft = { groups: 0, names: [] };

  const sequence = (depth: number): string => {
    const terms = Array.from({ length: 1 + Math.floor(next() * 3) }, () => term(depth)).join('');

    return depth < 2 && next() < 0.1 ? `${terms}|${sequence(depth + 1)}` : terms;
  };

  const quantified = (atom: string): string =>
    `${atom}${pick(['', '', '', '?', '{1,2}', '{0,3}'])}`;

  const term = (depth: number): string => {
    const kind = depth >= 2 ? 0 : Math.floor(next() * 5);

    if (kind === 1) {
      draft.groups += 1;

      return quantified(`(${sequence(depth + 1)})`);
    }

    if (kind === 2) {
      const free = ['x', 'y'].filter((name) => !draft.names.includes(name));

      if (free.length === 0) {
        return quantified(`(?:${sequence(depth + 1)})`);
      }

      const name = pick(free);
      const body = sequence(depth + 1);

      draft.groups += 1;
      draft.names.push(name);

      return quantified(`(?<${name}>${body})`);
    }

    if (draft.groups > 0 && next() < 0.3) {
      const named = draft.names.length > 0 && next() < 0.5;

      return named
        ? `\\k<${pick(draft.names)}>`
        : `\\${String(1 + Math.floor(next() * draft.groups))}`;
    }

    if (kind === 3) {
      return `(${pick(['?=', '?!', '?<=', '?<!'])}${sequence(depth + 1)})`;
    }

    return quantified(pick(['a', 'b', '.', '[ab]']));
  };

  const body = sequence(0);

  return `${next() < 0.8 ? '^' : ''}${body}${next() < 0.4 ? '$' : ''}`;
};

// A pattern the engine refuses is drawn again.
const compiledPattern = (next: () => number): RegExp => {
  try {
    return new RegExp(randomPattern(next), 'u');
  } catch {
    return compiledPattern(next);
  }
};

const randomChain = (next: () => number): RegExp[] => {
  const length = 2 + Math.floor(next() * 3);

  return Array.from({ length }, () => compiledPattern(next));
};

describe('patterns of a chain folded into one step', () => {
  const next = generator(2026);
  const chains = Array.from({ length: 1000 }, () => randomChain(next));

  it('fold often enough in this sample for the comparison to mean something', () => {
    const folded = chains.filter((list) => stepsFor(list).length < list.length);

    expect(folded.length).toBeGreaterThan(50);
  });

  it.each([true, false])(
    'accept exactly what the patterns accept one by one (generated: %s)',
    (generate) => {
      const differences = chains.flatMap((list) => {
        const run = runFor(list, generate);
        const expected = oneByOne(list);

        return texts
          .filter((text) => run(text) !== expected(text))
          .map((text) => `${list.map(String).join(' ')} on "${text}"`);
      });

      expect(differences).toStrictEqual([]);
    },
  );

  it('keep a backreference pointing at its own group', () => {
    const run = runFor([/^(a)/u, /^a(b)\1$/u], true);

    expect(run('abb')).toBe(true);
    expect(run('aba')).toBe(false);
  });

  it('allow a group name the parent pattern uses too', () => {
    class Code extends AnyString.subtype('probe.Code', /^(?<head>[a-z])/u) {}
    class ShortCode extends Code.subtype('probe.ShortCode', /^(?<head>[a-z])\d$/u) {}

    expect(ShortCode.parse('a1').ok).toBe(true);
    expect(ShortCode.parse('a12').ok).toBe(false);
  });

  it.each([
    [/^(a)\1/u, 'a numbered backreference'],
    [/^(?<x>a)\k<x>/u, 'a named backreference'],
    [/^(?<x>a)/u, 'a named group'],
  ])('keep %s apart, as it has %s', (pattern) => {
    expect(stepsFor([/^a/u, pattern])).toHaveLength(2);
  });

  it.each([/^(a)b/u, /^(?=a)(?<!b)a/u, /^(?:a)\d/u])('still fold %s', (pattern) => {
    expect(stepsFor([/^a/u, pattern])).toHaveLength(1);
  });
});
