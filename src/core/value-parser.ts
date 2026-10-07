import { generateFunction } from './compile.ts';
import { frozen } from './frozen.ts';
import { remember } from './pending.ts';
import { Rejection } from './rejection.ts';

type Parser<Instance> = (input: unknown) => Instance | Rejection;

/**
 * Internal: a function that runs a type's rules on a plain value and makes the instance, one per
 * type: generated where code generation is allowed, so V8 sees one class at its `new`.
 */
export const parserFor = <Instance>(
  target: new (input: unknown) => Instance,
  run: (input: unknown) => unknown,
  generate?: boolean,
): Parser<Instance> => {
  const generated = generateFunction(
    ['Target', 'run', 'Rejection', 'frozen', 'remember'],
    `function parseValue(input) {
      let value = run(input);
      if (typeof value === 'object' && value !== null) {
        if (value instanceof Rejection) return value;
        value = frozen(value);
      }
      remember(Target, input, value);
      return new Target(input);
    }`,
    [target, run, Rejection, frozen, remember],
    generate,
  );

  if (generated !== undefined) {
    // The source above returns a Rejection or an instance of `Target`.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return generated as Parser<Instance>;
  }

  return (input) => {
    let value = run(input);

    if (typeof value === 'object' && value !== null) {
      if (value instanceof Rejection) {
        return value;
      }

      value = frozen(value);
    }

    remember(target, input, value);

    return new target(input);
  };
};
