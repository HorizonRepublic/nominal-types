import type { FastPaths } from './fast-paths.ts';
import type { Shape } from './shapes.ts';

/**
 * Internal: how a schema runs and describes itself, and the paths that know its shape.
 */
export interface BuiltParts<Output> {
  readonly shape: Shape<Output>;
  readonly paths: FastPaths;
}

/**
 * Internal: parts that stand in for those of a schema not built yet: each call builds the real
 * parts through `settle` and hands over to them.
 */
export const standInParts = <Output>(settle: () => BuiltParts<Output>): BuiltParts<Output> => {
  const write = (value: unknown): unknown => settle().paths.write(value);

  return {
    shape: {
      run: (input) => settle().shape.run(input),
      describe: (side, options) => settle().shape.describe(side, options),
    },
    paths: {
      write,
      accepts: (input) => settle().paths.accepts(input),
      plan: { kind: 'json', write },
    },
  };
};
