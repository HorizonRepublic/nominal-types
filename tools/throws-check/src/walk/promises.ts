import type { CallLike, Semantics } from '../compiler/semantics.ts';
import { ts } from '../compiler/ts.ts';
import { argumentsOf, chainMethod, isPromiseConstructor, throwsOfCallee } from './callees.ts';
import { asFunction, isAsyncOrGenerator, skipOuter } from './syntax.ts';
import type { InlineFunction } from './syntax.ts';
import type { Escape, Scope, WalkOptions } from './types.ts';

/**
 * What the promise rules need from the walk.
 */
export interface PromiseWalk {
  readonly semantics: Semantics;
  readonly options: WalkOptions;
  readonly callbackEscapes: (
    fn: InlineFunction,
    scope: Scope,
    rejectors?: readonly ts.Identifier[],
  ) => readonly Escape[];
}

const executorRejections = (
  walk: PromiseWalk,
  node: ts.CallExpression | ts.NewExpression,
  scope: Scope,
): readonly Escape[] => {
  const [first] = argumentsOf(node);
  const executor = first === undefined ? undefined : asFunction(first);

  if (executor === undefined || isAsyncOrGenerator(executor)) {
    return [];
  }

  const reject = executor.parameters[1]?.name;

  return walk.callbackEscapes(
    executor,
    scope,
    reject !== undefined && ts.isIdentifier(reject) ? [reject] : [],
  );
};

/**
 * Lists the rejections of a promise expression: the `@throws` of a promise-returning callee,
 * what a `new Promise` executor throws or rejects with, and the upstream and handlers of
 * `then`, `catch` and `finally`.
 */
export const rejectionsOf = (
  walk: PromiseWalk,
  expression: ts.Expression,
  scope: Scope,
): readonly Escape[] => {
  const inner = skipOuter(expression);

  if (ts.isConditionalExpression(inner)) {
    return [
      ...rejectionsOf(walk, inner.whenTrue, scope),
      ...rejectionsOf(walk, inner.whenFalse, scope),
    ];
  }

  if (!ts.isCallExpression(inner) && !ts.isNewExpression(inner)) {
    return [];
  }

  const callee = walk.semantics.resolveCallee(inner);

  if (callee === undefined) {
    return [];
  }

  if (isPromiseConstructor(callee)) {
    return executorRejections(walk, inner, scope);
  }

  if (
    ts.isCallExpression(inner) &&
    ts.isPropertyAccessExpression(inner.expression) &&
    chainMethod(inner) !== undefined
  ) {
    const access = inner.expression;
    const upstream =
      access.name.text === 'catch' ? [] : rejectionsOf(walk, access.expression, scope);
    const handlers = argumentsOf(inner).flatMap((argument) => {
      const fn = asFunction(argument);

      return fn === undefined || isAsyncOrGenerator(fn) ? [] : walk.callbackEscapes(fn, scope);
    });

    return [...upstream, ...handlers];
  }

  return callee.returnsPromise ? throwsOfCallee(walk.semantics, walk.options, callee, inner) : [];
};

/**
 * What a call to the `reject` of an enclosing executor rejects with, if the call is one.
 */
export const rejectEscapes = (
  semantics: Semantics,
  node: CallLike,
  scope: Scope,
): readonly Escape[] | undefined => {
  const target = ts.isCallExpression(node) ? skipOuter(node.expression) : undefined;
  const [reason] = argumentsOf(node);

  if (
    target === undefined ||
    !ts.isIdentifier(target) ||
    reason === undefined ||
    !scope.rejectors.some((candidate) => semantics.sameSymbol(target, candidate))
  ) {
    return undefined;
  }

  const thrown = semantics.typeOfThrown(reason) ?? [];

  return thrown.map((type) => ({ thrown: type, site: node, via: `${target.text}()` }));
};
