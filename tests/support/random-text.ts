/**
 * A small seeded generator of numbers from 0 up to 1, so a failing case can be replayed.
 */
export const generator = (seed: number): (() => number) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;

    let mixed = Math.imul(state ^ (state >>> 15), state | 1);

    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
};

/**
 * Strings made of the given pieces, for holding a parser against the pattern its JSON Schema
 * carries: every string is built from `count` random choices among `pieces`, up to `longest`
 * pieces long, the same for every run.
 */
export const randomTexts = (
  pieces: readonly string[],
  count: number,
  longest: number,
  seed = 1,
): string[] => {
  const next = generator(seed);

  return Array.from({ length: count }, () => {
    const length = 1 + Math.floor(next() * longest);

    return Array.from({ length }, () => pieces[Math.floor(next() * pieces.length)] ?? '').join('');
  });
};
