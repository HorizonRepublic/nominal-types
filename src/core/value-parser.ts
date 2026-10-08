import { generateFunction } from './compile.ts';
import { frozen } from './frozen.ts';
import { NominalError } from './nominal-error.ts';
import { forget, remember } from './pending.ts';
import { Rejection } from './rejection.ts';

type Parser<Instance> = (input: unknown) => Instance | Rejection;

const parserSource = `function parseValue(input) {
  let value = run(input);
  if (typeof value === 'object' && value !== null) {
    if (value instanceof Rejection) return value;
    value = frozen(value);
  }
  remember(Target, input, value);
  try {
    return new Target(input);
  } catch (error) {
    if (error instanceof NominalError) return new Rejection(error.issues);
    throw error;
  } finally {
    forget();
  }
}`;

const loopParser =
  <Instance>(target: new (input: unknown) => Instance, run: (input: unknown) => unknown) =>
  (input: unknown): Instance | Rejection => {
    let value = run(input);

    if (typeof value === 'object' && value !== null) {
      if (value instanceof Rejection) {
        return value;
      }

      value = frozen(value);
    }

    remember(target, input, value);

    try {
      return new target(input);
    } catch (error) {
      if (error instanceof NominalError) {
        return new Rejection(error.issues);
      }

      throw error;
    } finally {
      forget();
    }
  };

/**
 * A function that runs a type's rules on a plain value and makes the instance, one per
 * type: generated where code generation is allowed, so V8 sees one class at its `new`.
 *
 * @remarks
 * A constructor of the type's own may hand `super()` a changed input, which the rules then check
 * again; its `NominalError` comes back as a `Rejection` like any other.
 *
 * @internal
 */
export const parserFor = <Instance>(
  target: new (input: unknown) => Instance,
  run: (input: unknown) => unknown,
  generate?: boolean,
): Parser<Instance> => {
  const generated = generateFunction(
    ['Target', 'run', 'Rejection', 'NominalError', 'frozen', 'remember', 'forget'],
    parserSource,
    [target, run, Rejection, NominalError, frozen, remember, forget],
    generate,
  );

  // The source above returns a Rejection or an instance of `Target`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return generated === undefined ? loopParser(target, run) : (generated as Parser<Instance>);
};
