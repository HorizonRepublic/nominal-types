import { acceptors, compileAccepts } from './acceptor.ts';
import type { Accepts } from './acceptor.ts';
import { compileRun, trimStep } from './compile.ts';
import type { AnyStep } from './compile.ts';
import type { NominalSchema } from './contracts.ts';
import { withValidExamples } from './examples.ts';
import { foreignRunner } from './foreign-runner.ts';
import { frozen } from './frozen.ts';
import { hideValues } from './hidden-values.ts';
import { normalizeSlot, rulesOf, sensitiveSlot } from './hierarchy.ts';
import { NativeSchema } from './native-schema.ts';
import { stepsOf } from './plan.ts';
import { Rejection } from './rejection.ts';
import { describeRules } from './rules-json.ts';
import type { StandardJSONSchemaV1 } from './standard-spec.ts';
import { stringRule, withoutImpliedString } from './string-rule.ts';

/**
 * What the functions below need of a nominal type class.
 *
 * @internal
 */
export interface TypeClass {
  /**
   * The name of the type, for its messages and its JSON Schema `title`.
   */
  readonly typeName: string;
}

const typeRules = new WeakMap<object, readonly NominalSchema[]>();

const rulesFor = (root: object, target: TypeClass): readonly NominalSchema[] => {
  const cached = typeRules.get(target);

  if (cached !== undefined) {
    return cached;
  }

  const rules = withoutImpliedString(rulesOf(root, target));

  typeRules.set(target, rules);

  return rules;
};

/**
 * Whether every rule of a type only checks values, so the value a type holds is the
 * input itself whenever the input is a primitive, trimmed when the type trims strings.
 *
 * @internal
 */
export const onlyChecks = (root: object, target: TypeClass): boolean =>
  rulesFor(root, target).every((rule) => rule instanceof NativeSchema);

/**
 * Whether a type trims a string before its checks while `n.configure()` asks for it: a
 * type under `AnyString` that doesn't opt out with `normalize: false`.
 *
 * @internal
 */
export const trimsStrings = (root: object, target: TypeClass): boolean =>
  Reflect.get(target, normalizeSlot) !== false && rulesOf(root, target).includes(stringRule);

const withTrim = (
  root: object,
  target: TypeClass,
  steps: readonly AnyStep[],
): readonly AnyStep[] => (trimsStrings(root, target) ? [trimStep, ...steps] : steps);

const typeRunners = new WeakMap<object, (input: unknown) => unknown>();

const hidingValues =
  (convert: (value: unknown) => unknown): ((value: unknown) => unknown) =>
  (value) => {
    const converted = convert(value);

    return converted instanceof Rejection ? new Rejection(hideValues(converted.issues)) : converted;
  };

const runnerOf = (root: object, target: TypeClass): ((input: unknown) => unknown) => {
  const hidden = Reflect.get(target, sensitiveSlot) === true;

  return compileRun(
    withTrim(
      root,
      target,
      stepsOf(
        rulesFor(root, target),
        (rule) => {
          const convert = foreignRunner(rule, target.typeName);

          return { convert: hidden ? hidingValues(convert) : convert };
        },
        { hidden, typeName: target.typeName },
      ),
    ),
  );
};

/**
 * The function generated for a type's rules, returning the value or a `Rejection`, with
 * object values not frozen yet.
 *
 * @internal
 */
export const rulesRunnerOf = (root: object, target: TypeClass): ((input: unknown) => unknown) => {
  let runner = typeRunners.get(target);

  if (runner === undefined) {
    runner = runnerOf(root, target);
    typeRunners.set(target, runner);
  }

  return runner;
};

const typeAcceptors = new WeakMap<object, Accepts>();

/**
 * The function generated to tell whether a value passes every rule of a type, without
 * building the value or its issues.
 *
 * @internal
 */
export const rulesAcceptsOf = (root: object, target: TypeClass): Accepts => {
  let accepts = typeAcceptors.get(target);

  if (accepts === undefined) {
    accepts = compileAccepts(
      withTrim(
        root,
        target,
        stepsOf(rulesFor(root, target), (rule) => ({
          convert: foreignRunner(rule, target.typeName),
          accepts: acceptors.get(rule),
        })),
      ),
    );
    typeAcceptors.set(target, accepts);
  }

  return accepts;
};

/**
 * Runs every rule of a type on a value, returning the value or a `Rejection`.
 *
 * @remarks
 * Each type runs one function generated for its rules, rules from other libraries included. An
 * object value comes back frozen all the way down.
 *
 * @throws {@link TypeError} when a rule fails to run, such as an asynchronous schema; the
 * message names the type.
 *
 * @internal
 */
export const runType = (root: object, target: TypeClass, input: unknown): unknown => {
  // @throws {@link TypeError} the runner runs the rules from other libraries, which can fail
  const value = rulesRunnerOf(root, target)(input);

  return typeof value === 'object' && value !== null ? frozen(value) : value;
};

/**
 * A type's JSON Schema, with its name as `title` and only the examples it accepts.
 *
 * @throws {@link TypeError} when a rule can't describe itself; the message names the type.
 *
 * @internal
 */
export const describeType = (
  root: object,
  target: TypeClass,
  side: 'input' | 'output',
  options: StandardJSONSchemaV1.Options,
): Record<string, unknown> => {
  const { $schema, title, ...body } = describeRules(
    target.typeName,
    rulesFor(root, target),
    side,
    options,
  );
  /**
   * Whether the type accepts an example.
   *
   * @throws {@link TypeError} when a rule fails to run, such as an asynchronous schema.
   *
   * @internal
   */
  const accepts = (example: unknown): boolean =>
    !(runType(root, target, example) instanceof Rejection);

  return {
    ...($schema === undefined ? {} : { $schema }),
    title: title ?? target.typeName,
    ...withValidExamples(body, options, accepts),
  };
};
