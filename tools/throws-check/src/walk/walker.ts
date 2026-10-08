import type { CallLike, Callee, Semantics } from '../compiler/semantics.ts';
import { ts } from '../compiler/ts.ts';
import {
  argumentsOf,
  commentEscapes,
  callsSynchronously,
  chainMethod,
  isPromiseConstructor,
  throwsOfCallee,
} from './callees.ts';
import { rejectEscapes, rejectionsOf } from './promises.ts';
import type { PromiseWalk } from './promises.ts';
import { rethrown } from './rethrow.ts';
import {
  accessModes,
  asFunction,
  ignoreOf,
  isAsyncOrGenerator,
  isFunctionLike,
  takesComments,
  skipOuter,
} from './syntax.ts';
import type { InlineFunction } from './syntax.ts';
import type { Escape, Note, Scope, WalkOptions } from './types.ts';

const unique = (names: readonly string[]): string => [...new Set(names)].join(' | ');

/**
 * Walks a body and collects the types that leave it, with the node that let each one out.
 *
 * @remarks
 * Functions and classes inside the body are not entered: they are bodies of their own. The
 * exceptions are callbacks that a caller runs before it returns, whose throws pass through.
 */
export class Walker {
  readonly #semantics: Semantics;
  readonly #options: WalkOptions;
  readonly #note: (finding: Note) => void;
  readonly #promises: PromiseWalk;

  public constructor(semantics: Semantics, options: WalkOptions, note: (finding: Note) => void) {
    this.#semantics = semantics;
    this.#options = options;
    this.#note = note;
    this.#promises = {
      semantics,
      options,
      callbackEscapes: (fn, scope, rejectors) => this.#callbackEscapes(fn, scope, rejectors),
    };
  }

  /**
   * Collects what leaves a body made of the given roots, in order.
   */
  public escapesOf(
    roots: readonly ts.Node[],
    returnsPromise: boolean,
    returned?: ts.Expression,
  ): readonly Escape[] {
    const out: Escape[] = [];
    const scope: Scope = { frames: [], rejectors: [], returnsPromise };

    for (const root of roots) {
      this.#walk(root, out, scope);
    }

    if (returnsPromise && returned !== undefined) {
      out.push(...rejectionsOf(this.#promises, returned, scope));
    }

    return out;
  }

  /**
   * What a callee documents, charged to a site.
   */
  public throwsOf(callee: Callee, site: ts.Node): readonly Escape[] {
    return throwsOfCallee(this.#semantics, this.#options, callee, site);
  }

  #walk(node: ts.Node, out: Escape[], scope: Scope): void {
    if (isFunctionLike(node) || ts.isClassLike(node) || this.#isIgnored(node)) {
      return;
    }

    out.push(...commentEscapes(this.#semantics, node));

    if (ts.isThrowStatement(node)) {
      this.#walkThrow(node, out, scope);
    } else if (ts.isTryStatement(node)) {
      this.#walkTry(node, out, scope);
    } else if (
      ts.isCallExpression(node) ||
      ts.isNewExpression(node) ||
      ts.isTaggedTemplateExpression(node)
    ) {
      this.#walkCall(node, out, scope);
    } else if (ts.isAwaitExpression(node)) {
      this.#walk(node.expression, out, scope);
      out.push(...rejectionsOf(this.#promises, node.expression, scope));
    } else if (ts.isReturnStatement(node) && node.expression !== undefined) {
      this.#walk(node.expression, out, scope);

      if (scope.returnsPromise) {
        out.push(...rejectionsOf(this.#promises, node.expression, scope));
      }
    } else {
      ts.forEachChild(node, (child) => {
        this.#walk(child, out, scope);
      });

      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        this.#walkAccess(node, out);
      }
    }
  }

  #isIgnored(node: ts.Node): boolean {
    if (!takesComments(node)) {
      return false;
    }

    const ignore = ignoreOf(node);

    if (ignore === 'no-reason') {
      this.#note({ node, code: 'ignore-reason', message: '@throws-ignore needs a reason' });
    }

    return ignore === true;
  }

  #walkAccess(node: ts.PropertyAccessExpression | ts.ElementAccessExpression, out: Escape[]): void {
    const modes = accessModes(node);

    for (const write of [false, true]) {
      const accessor = (write ? modes.write : modes.read)
        ? this.#semantics.resolveAccessor(node, write)
        : undefined;

      if (accessor !== undefined) {
        out.push(
          ...this.throwsOf(accessor, node).map((escape) => ({
            thrown: escape.thrown,
            site: node,
            via: accessor.name,
          })),
        );
      }
    }
  }

  #walkThrow(node: ts.ThrowStatement, out: Escape[], scope: Scope): void {
    this.#walk(node.expression, out, scope);

    const inner = skipOuter(node.expression);
    const frame = ts.isIdentifier(inner)
      ? scope.frames.findLast((candidate) => this.#semantics.sameSymbol(inner, candidate.variable))
      : undefined;

    if (frame !== undefined && ts.isIdentifier(inner)) {
      out.push(...rethrown(this.#semantics, node, frame, inner));

      return;
    }

    const thrown = this.#semantics.typeOfThrown(node.expression);

    if (thrown === undefined) {
      this.#unresolved(node, 'cannot tell the type of this throw');

      return;
    }

    out.push(...thrown.map((type) => ({ thrown: type, site: node, via: 'throw' })));
  }

  #walkTry(node: ts.TryStatement, out: Escape[], scope: Scope): void {
    const attempted: Escape[] = [];

    this.#walk(node.tryBlock, attempted, scope);

    const clause = node.catchClause;
    const name = clause?.variableDeclaration?.name;

    if (clause === undefined) {
      out.push(...attempted);
    } else if (name !== undefined && ts.isIdentifier(name)) {
      const frames = [...scope.frames, { variable: name, escapes: attempted, clause }];

      this.#walk(clause.block, out, { ...scope, frames });
    } else {
      this.#walk(clause.block, out, scope);
    }

    if (node.finallyBlock !== undefined) {
      this.#walk(node.finallyBlock, out, scope);
    }
  }

  #callbackEscapes(
    fn: InlineFunction,
    scope: Scope,
    rejectors = scope.rejectors,
  ): readonly Escape[] {
    const out: Escape[] = [];
    const inner = { ...scope, rejectors, returnsPromise: false };

    for (const parameter of fn.parameters) {
      if (parameter.initializer !== undefined) {
        this.#walk(parameter.initializer, out, inner);
      }
    }

    this.#walk(fn.body, out, inner);

    return out;
  }

  #walkCall(node: CallLike, out: Escape[], scope: Scope): void {
    const callee = this.#semantics.resolveCallee(node);

    if (ts.isTaggedTemplateExpression(node)) {
      this.#walk(node.tag, out, scope);
      this.#walk(node.template, out, scope);
    } else {
      this.#walk(node.expression, out, scope);
    }

    for (const [index, argument] of argumentsOf(node).entries()) {
      this.#walkArgument(node, callee, index, argument, out, scope);
    }

    const rejected = rejectEscapes(this.#semantics, node, scope);

    if (rejected !== undefined) {
      out.push(...rejected);

      return;
    }

    if (callee === undefined) {
      this.#unresolved(node, 'cannot resolve what this call throws');
    } else if (!callee.returnsPromise) {
      out.push(...this.throwsOf(callee, node));
    }
  }

  #walkArgument(
    node: CallLike,
    callee: Callee | undefined,
    index: number,
    argument: ts.Expression,
    out: Escape[],
    scope: Scope,
  ): void {
    const inner = skipOuter(argument);

    if (ts.isConditionalExpression(inner)) {
      this.#walk(inner.condition, out, scope);
      this.#walkArgument(node, callee, index, inner.whenTrue, out, scope);
      this.#walkArgument(node, callee, index, inner.whenFalse, out, scope);

      return;
    }

    const fn = asFunction(argument);
    const synchronous =
      callee !== undefined && callsSynchronously(this.#semantics, this.#options, callee, index);

    if (fn === undefined) {
      this.#walk(argument, out, scope);

      const reference = synchronous
        ? this.#semantics.resolveFunctionReference(skipOuter(argument))
        : undefined;

      out.push(...(reference === undefined ? [] : this.throwsOf(reference, argument)));
    } else if (synchronous && !isAsyncOrGenerator(fn)) {
      out.push(...this.#callbackEscapes(fn, scope));
    } else if (
      this.#options.reportUnresolved &&
      !isAsyncOrGenerator(fn) &&
      !this.#isPromiseHandler(node, callee)
    ) {
      const lost = this.#callbackEscapes(fn, scope);

      if (lost.length > 0) {
        const names = unique(lost.map((escape) => escape.thrown.name));

        this.#unresolved(
          fn,
          `this callback throws ${names}, but ${callee?.name ?? 'its caller'} is not known to call it synchronously`,
        );
      }
    }
  }

  #isPromiseHandler(node: CallLike, callee: Callee | undefined): boolean {
    return (
      callee !== undefined && (isPromiseConstructor(callee) || chainMethod(node) !== undefined)
    );
  }

  #unresolved(node: ts.Node, message: string): void {
    if (this.#options.reportUnresolved) {
      this.#note({ node, code: 'unresolved', message });
    }
  }
}
