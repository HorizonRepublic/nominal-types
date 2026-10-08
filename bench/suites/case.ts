/**
 * One timed case: its title, the pool of inputs it cycles through, and what it does with one.
 */
export type Case = readonly [
  title: string,
  inputs: readonly unknown[],
  run: (input: unknown, index: number) => unknown,
];
