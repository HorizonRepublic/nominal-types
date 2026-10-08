import { argumentGuards, matchesKey } from '../builtins.ts';
import type { CallLike, Callee, Semantics } from '../compiler/semantics.ts';
import { ts } from '../compiler/ts.ts';
import { skipOuter, takesComments, throwsCommentsOf } from './syntax.ts';
import type { Escape, WalkOptions } from './types.ts';

const promiseChain = new Set(['then', 'catch', 'finally']);

/**
 * What a callee documents or is known to throw, charged to a site.
 */
export const throwsOfCallee = (
  semantics: Semantics,
  options: WalkOptions,
  callee: Callee,
  site: ts.Node,
): readonly Escape[] => {
  const via = `${callee.name}()`;
  const builtin = options.builtins
    .filter(([pattern]) => callee.keys.some((key) => matchesKey(pattern, key)))
    .flatMap(([, names]) => names.map((name) => semantics.thrownByName(name, site)));
  const documented = callee.declarations
    .map((declaration) => semantics.jsDocThrowsOf(declaration))
    .find((tags) => tags.length > 0);
  const tagged = (documented ?? []).flatMap((tag) => tag.thrown);
  const guard = callee.keys.map((key) => argumentGuards[key]).find((found) => found !== undefined);
  const allowed =
    guard !== undefined && (ts.isCallExpression(site) || ts.isNewExpression(site))
      ? guard(
          semantics,
          (site.arguments ?? []).map((argument) => skipOuter(argument)),
        )
      : undefined;

  return [...builtin, ...tagged]
    .filter((thrown) => allowed === undefined || allowed.has(thrown.name))
    .map((thrown) => ({ thrown, site, via }));
};

/**
 * Tells whether a callee runs the function passed at an index before it returns.
 */
export const callsSynchronously = (
  semantics: Semantics,
  options: WalkOptions,
  callee: Callee,
  index: number,
): boolean => {
  if (
    callee.keys.some((key) => options.syncCallbacks.some((pattern) => matchesKey(pattern, key)))
  ) {
    return true;
  }

  const parameter =
    callee.parameters[index] ?? (callee.variadic ? callee.parameters.at(-1) : undefined);

  return (
    parameter !== undefined &&
    callee.declarations.some((declaration) =>
      semantics.jsDocRethrowsOf(declaration).includes(parameter),
    )
  );
};

/**
 * Tells whether a callee is the global `Promise` constructor.
 */
export const isPromiseConstructor = (callee: Callee): boolean =>
  callee.keys.includes('new Promise');

/**
 * The name of `then`, `catch` or `finally` when a call is one of them.
 */
export const chainMethod = (node: CallLike): string | undefined =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  promiseChain.has(node.expression.name.text)
    ? node.expression.name.text
    : undefined;

/**
 * The arguments of a call; a tagged template has none the checker follows.
 */
export const argumentsOf = (node: CallLike): readonly ts.Expression[] =>
  ts.isTaggedTemplateExpression(node) ? [] : (node.arguments ?? []);

/**
 * What the `// @throws` comments in front of a node say it throws.
 */
export const commentEscapes = (semantics: Semantics, node: ts.Node): readonly Escape[] =>
  takesComments(node)
    ? throwsCommentsOf(node).flatMap((text) =>
        semantics
          .thrownOfComment(text, node)
          .map((thrown) => ({ thrown, site: node, via: 'a // @throws comment' })),
      )
    : [];
