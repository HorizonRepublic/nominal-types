import type { Step } from './plan.ts';

type Failing = (value: unknown) => number;

const isFailing = (value: unknown): value is Failing => typeof value === 'function';

// Code generation is how each type gets checks V8 can inline. Environments that forbid it, such as
// Cloudflare Workers or a strict Content-Security-Policy, throw here and fall back to a loop.
const canGenerate = ((): boolean => {
  try {
    // oxlint-disable-next-line typescript/no-implied-eval
    const probe: unknown = new Function('return true');
    return isFailing(probe);
  } catch {
    return false;
  }
})();

const loopOver =
  (steps: readonly Step[]): Failing =>
  (value) =>
    steps.findIndex((step) => !step.accepts(value));

const generated = (steps: readonly Step[]): Failing => {
  const names = steps.map((_, index) => `step${index}`);
  const body = names.map((name, index) => `!${name}(value) ? ${index} : `).join('');
  // oxlint-disable-next-line typescript/no-implied-eval
  const build: unknown = new Function(...names, `return (value) => ${body}-1;`);
  const compiled: unknown =
    typeof build === 'function'
      ? Reflect.apply(
          build,
          undefined,
          steps.map((step) => step.accepts),
        )
      : undefined;
  return isFailing(compiled) ? compiled : loopOver(steps);
};

/**
 * Internal: one function that runs every step of a plan and returns the index of the first step
 * the value fails, or -1; generated per type, so the engine sees a call site of its own for each
 * check and can inline it.
 *
 * @remarks
 * A shared loop over the steps of every type makes its call site megamorphic, which V8 can't
 * inline; a function generated for one plan keeps each call monomorphic. Where code generation is
 * forbidden, the plan runs through a loop instead.
 */
export const compileSteps = (steps: readonly Step[], generate: boolean = canGenerate): Failing =>
  generate && steps.length > 0 ? generated(steps) : loopOver(steps);
