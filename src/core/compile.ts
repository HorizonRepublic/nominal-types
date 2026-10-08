import type { ConvertStep, Step } from './plan.ts';
import { Rejection } from './rejection.ts';
import { settings } from './settings.ts';

type Run = (value: unknown) => unknown;

/**
 * Internal: the step in front of the checks of a string type, which trims a string when
 * `n.configure({ normalize: { trimStrings: true } })` is set; the setting is read on each run.
 */
export interface TrimStep {
  readonly trim: true;
}

/**
 * Internal: any step a type's function runs.
 */
export type AnyStep = Step | ConvertStep | TrimStep;

const isRun = (value: unknown): value is Run => typeof value === 'function';

const isTrim = (step: AnyStep): step is TrimStep => 'trim' in step;

const isCheck = (step: Step | ConvertStep): step is Step => 'accepts' in step;

/**
 * Internal: the step that trims strings while the setting asks for it.
 */
export const trimStep: TrimStep = { trim: true };

/**
 * Internal: text trimmed while the setting asks for it.
 */
export const trimmedText = (text: string): string => (settings.trimStrings ? text.trim() : text);

/**
 * Internal: a string trimmed while the setting asks for it, anything else as it is.
 */
export const trimmed = (value: unknown): unknown =>
  typeof value === 'string' ? trimmedText(value) : value;

let probed: boolean | undefined;

// Code generation is how each type gets checks V8 can inline. Environments that forbid it, such as
// Cloudflare Workers or a strict Content-Security-Policy, throw here and fall back to a loop. The
// probe runs once, at the first function generated, so `codegen: 'off'` set at startup avoids it.
const probe = (): boolean => {
  try {
    // oxlint-disable-next-line typescript/no-implied-eval
    const built: unknown = new Function('return true');

    return isRun(built);
  } catch {
    return false;
  }
};

/**
 * Internal: whether functions are generated now: not with `codegen: 'off'`, nor where the runtime
 * forbids it.
 */
export const canGenerate = (): boolean => settings.codegen !== 'off' && (probed ??= probe());

/**
 * Internal: a function built from source with `new Function`, called with `values` for `names`,
 * or `undefined` where code generation is off or forbidden.
 *
 * @remarks
 * A generated function gets a call site of its own for everything it calls, which V8 can inline
 * where a function shared by every type can't. `generate` overrides the setting, for tests.
 */
export const generateFunction = (
  names: readonly string[],
  source: string,
  values: readonly unknown[],
  generate: boolean = canGenerate(),
): ((...values: unknown[]) => unknown) | undefined => {
  if (!generate) {
    return undefined;
  }

  // oxlint-disable-next-line typescript/no-implied-eval
  const build: unknown = new Function(...names, `return ${source};`);
  const built: unknown =
    typeof build === 'function' ? Reflect.apply(build, undefined, values) : undefined;

  return isRun(built) ? built : undefined;
};

const loopOver =
  (steps: readonly AnyStep[]): Run =>
  (input) => {
    let value = input;

    for (const step of steps) {
      if (isTrim(step)) {
        value = trimmed(value);
      } else if (isCheck(step)) {
        if (!step.accepts(value)) {
          return new Rejection(step.issues(value, input));
        }
      } else {
        value = step.convert(value);

        if (value instanceof Rejection) {
          return value;
        }
      }
    }

    return value;
  };

/**
 * Internal: the source of a trim step in a generated function, which reads `settings`.
 */
export const trimSource =
  "if (settings.trimStrings && typeof value === 'string') value = value.trim();";

const generated = (steps: readonly AnyStep[], generate: boolean | undefined): Run => {
  const names: string[] = ['Rejection', 'settings'];
  const values: unknown[] = [Rejection, settings];
  const lines = steps.map((step, index) => {
    if (isTrim(step)) {
      return trimSource;
    }

    if (isCheck(step)) {
      names.push(`accepts${index}`, `issues${index}`);
      values.push(step.accepts, step.issues);

      return `if (!accepts${index}(value)) return new Rejection(issues${index}(value, input));`;
    }

    names.push(`convert${index}`);
    values.push(step.convert);

    return `value = convert${index}(value); if (value instanceof Rejection) return value;`;
  });
  const compiled = generateFunction(
    names,
    `(input) => { let value = input; ${lines.join(' ')} return value; }`,
    values,
    generate,
  );

  return compiled ?? loopOver(steps);
};

/**
 * Internal: one function that runs every step of a type and returns the value, or the
 * `Rejection` of the first step that fails; generated per type, so the engine sees a call site of
 * its own for each check and can inline it.
 *
 * @remarks
 * A shared loop over the steps of every type makes its call site megamorphic, which V8 can't
 * inline; a function generated for one type keeps each call monomorphic. Rules from other
 * libraries are steps too, so a type mixing them with patterns is generated as well. Where code
 * generation is forbidden, the steps run through a loop instead.
 */
export const compileRun = (steps: readonly AnyStep[], generate?: boolean): Run =>
  generate !== false && steps.length > 0 ? generated(steps, generate) : loopOver(steps);

/**
 * Internal: whether a value carries the brand `key`, as one function per type, generated where
 * code generation is allowed.
 *
 * @remarks
 * `instanceof` of every type used to run one shared function, whose property reads saw every
 * brand and couldn't be optimised; a function per type reads one brand only.
 */
export const brandCheck = (key: symbol, generate?: boolean): ((value: unknown) => boolean) => {
  const generatedCheck = generateFunction(
    ['key'],
    "(value) => typeof value === 'object' && value !== null && value[key] === true",
    [key],
    generate,
  );

  if (generatedCheck === undefined) {
    return (value) =>
      typeof value === 'object' && value !== null && Reflect.get(value, key) === true;
  }

  // The generated source is exactly this check; wrapping it again would share one call site
  // between all types and undo the point of generating it.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return generatedCheck as (value: unknown) => boolean;
};
