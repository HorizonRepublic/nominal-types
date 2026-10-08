import { generateFunction, trimmed, trimSource } from './compile.ts';
import type { AnyStep, TrimStep } from './compile.ts';
import type { ConvertStep, Step } from './plan.ts';
import { Rejection } from './rejection.ts';
import { settings } from './settings.ts';

/**
 * Internal: tells whether a value would be accepted, without building the value or its issues.
 */
export type Accepts = (input: unknown) => boolean;

/**
 * Internal: the check-only functions of the schemas this copy of the package built, so a type or
 * an object that holds one can call it directly.
 */
export const acceptors: WeakMap<object, Accepts> = new WeakMap();

/**
 * Internal: a check built from a run function, for schemas that need the value they build to
 * decide, such as one with constraints or `unique` items.
 */
export const acceptsByRunning =
  (run: (input: unknown) => unknown): Accepts =>
  (input) =>
    !(run(input) instanceof Rejection);

const isTrim = (step: AnyStep): step is TrimStep => 'trim' in step;

const isCheck = (step: Step | ConvertStep): step is Step => 'issues' in step;

const isAccepts = (value: unknown): value is Accepts => typeof value === 'function';

const acceptsOf = (step: ConvertStep): Accepts | undefined => {
  const accepts: unknown = Reflect.get(step, 'accepts');

  return isAccepts(accepts) ? accepts : undefined;
};

const loopOver =
  (steps: readonly AnyStep[]): Accepts =>
  (input) => {
    let value = input;

    for (const [index, step] of steps.entries()) {
      if (isTrim(step)) {
        value = trimmed(value);

        continue;
      }

      if (isCheck(step)) {
        if (!step.accepts(value)) {
          return false;
        }

        continue;
      }

      const check = index === steps.length - 1 ? acceptsOf(step) : undefined;

      if (check !== undefined) {
        return check(value);
      }

      value = step.convert(value);

      if (value instanceof Rejection) {
        return false;
      }
    }

    return true;
  };

const generated = (steps: readonly AnyStep[]): Accepts | undefined => {
  const names: string[] = ['Rejection', 'settings'];
  const values: unknown[] = [Rejection, settings];
  const lines = steps.map((step, index) => {
    const at = String(index);

    if (isTrim(step)) {
      return trimSource;
    }

    if (isCheck(step)) {
      names.push(`accepts${at}`);
      values.push(step.accepts);

      return `if (!accepts${at}(value)) return false;`;
    }

    const check = index === steps.length - 1 ? acceptsOf(step) : undefined;

    if (check !== undefined) {
      names.push(`accepts${at}`);
      values.push(check);

      return `return accepts${at}(value);`;
    }

    names.push(`convert${at}`);
    values.push(step.convert);

    return `value = convert${at}(value); if (value instanceof Rejection) return false;`;
  });
  const built = generateFunction(
    names,
    `(input) => { let value = input; ${lines.join(' ')} return true; }`,
    values,
  );

  return isAccepts(built) ? built : undefined;
};

/**
 * Internal: one function that tells whether every step of a type accepts a value, generated per
 * type like the function that runs them; it builds no issues for a failed check.
 *
 * @remarks
 * A rule from another library still runs, since the steps after it see the value it gives; the
 * last one is skipped in favour of its own check when it has one, such as an `n.object()` rule.
 */
export const compileAccepts = (steps: readonly AnyStep[], generate: boolean = true): Accepts =>
  (generate && steps.length > 0 ? generated(steps) : undefined) ?? loopOver(steps);
