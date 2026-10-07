import type { AnyNominalType } from './contracts.ts';
import { ownTypes } from './nominal.ts';
import { forget, remember } from './pending.ts';
import { Rejection } from './rejection.ts';
import { onlyChecks, rulesRunnerOf } from './type-rules.ts';

/**
 * Internal: a function that makes instances of `target`, chosen once: straight to the constructor
 * for a type of this copy of the package, through `parse` for one from another copy.
 */
export const constructorFor = (target: AnyNominalType): ((input: unknown) => unknown) => {
  if (ownTypes.isOwn(target)) {
    return (input) => ownTypes.construct(target, input);
  }

  return (input) => {
    const parsed = target.parse(input);

    return parsed.ok ? parsed.value : new Rejection(parsed.issues);
  };
};

/**
 * Internal: a function that makes instances of `target` like `parse` does, holding the type's
 * generated parser rather than looking it up for every value; for fields of objects and arrays.
 */
export const instanceParserFor = (target: AnyNominalType): ((input: unknown) => unknown) => {
  if (!ownTypes.isOwn(target)) {
    return constructorFor(target);
  }

  const parse = ownTypes.parserOf(target);

  return (input) =>
    typeof input === 'object' && input !== null ? ownTypes.construct(target, input) : parse(input);
};

/**
 * Internal: a function that checks a value against `target` without making an instance: a
 * `Rejection`, or anything else when the value is accepted.
 */
export const checkerFor = (target: AnyNominalType): ((input: unknown) => unknown) => {
  if (!ownTypes.isOwn(target)) {
    return constructorFor(target);
  }

  const run = rulesRunnerOf(ownTypes.root, target);

  return (input) =>
    typeof input === 'object' && input !== null ? ownTypes.construct(target, input) : run(input);
};

/**
 * Internal: a function that makes instances of `target` from values a checker of it accepted, and
 * skips checking a primitive again where the type's rules only check.
 */
export const trustedConstructorFor = (target: AnyNominalType): ((input: unknown) => unknown) => {
  const build = constructorFor(target);

  if (!ownTypes.isOwn(target) || !onlyChecks(ownTypes.root, target)) {
    return build;
  }

  return function buildInstance(input: unknown): unknown {
    if (typeof input === 'object' && input !== null) {
      return build(input);
    }

    remember(target, input, input);

    try {
      return new target(input);
    } finally {
      forget();
    }
  };
};
