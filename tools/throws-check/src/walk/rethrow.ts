import type { Semantics, Thrown } from '../compiler/semantics.ts';
import { ts } from '../compiler/ts.ts';
import { alwaysExits, skipOuter } from './syntax.ts';
import type { CatchFrame, Escape } from './types.ts';

const constrain = (
  semantics: Semantics,
  frame: CatchFrame,
  condition: ts.Expression,
  truth: boolean,
  excluded: Thrown[],
): void => {
  const inner = skipOuter(condition);

  if (ts.isPrefixUnaryExpression(inner) && inner.operator === ts.SyntaxKind.ExclamationToken) {
    constrain(semantics, frame, inner.operand, !truth, excluded);

    return;
  }

  if (!ts.isBinaryExpression(inner)) {
    return;
  }

  const operator = inner.operatorToken.kind;
  const left = skipOuter(inner.left);

  if (operator === ts.SyntaxKind.InstanceOfKeyword && !truth) {
    if (ts.isIdentifier(left) && semantics.sameSymbol(left, frame.variable)) {
      excluded.push(...(semantics.instanceTypeOf(inner.right) ?? []));
    }
  } else if (
    (operator === ts.SyntaxKind.BarBarToken && !truth) ||
    (operator === ts.SyntaxKind.AmpersandAmpersandToken && truth)
  ) {
    constrain(semantics, frame, inner.left, truth, excluded);
    constrain(semantics, frame, inner.right, truth, excluded);
  }
};

const constrainBranch = (
  semantics: Semantics,
  frame: CatchFrame,
  child: ts.Node,
  parent: ts.Node,
  excluded: Thrown[],
): void => {
  if (
    ts.isIfStatement(parent) &&
    (child === parent.thenStatement || child === parent.elseStatement)
  ) {
    constrain(semantics, frame, parent.expression, child === parent.thenStatement, excluded);
  }

  if (!ts.isBlock(parent) && !ts.isCaseClause(parent) && !ts.isDefaultClause(parent)) {
    return;
  }

  for (const statement of parent.statements) {
    if (statement === child) {
      return;
    }

    if (
      ts.isIfStatement(statement) &&
      statement.elseStatement === undefined &&
      alwaysExits(statement.thenStatement)
    ) {
      constrain(semantics, frame, statement.expression, false, excluded);
    }
  }
};

/**
 * Lists the classes a `throw e` in a catch clause cannot rethrow, from the `instanceof` checks
 * that lead to it: the `else` of `if (e instanceof X)`, and the code after an
 * `if (e instanceof X)` that always exits.
 */
const excludedAt = (semantics: Semantics, node: ts.Node, frame: CatchFrame): readonly Thrown[] => {
  const excluded: Thrown[] = [];
  let child = node;

  while (child.parent !== frame.clause) {
    constrainBranch(semantics, frame, child, child.parent, excluded);
    child = child.parent;
  }

  return excluded;
};

/**
 * Picks what a `throw e` in a catch clause lets out of what the `try` block let out.
 *
 * @remarks
 * The checker's own narrowing of `e` at the throw gives the classes it can be; the `instanceof`
 * checks on the way give the classes it cannot be.
 */
export const rethrown = (
  semantics: Semantics,
  node: ts.ThrowStatement,
  frame: CatchFrame,
  variable: ts.Identifier,
): readonly Escape[] => {
  const excluded = excludedAt(semantics, node, frame);
  const narrowed = semantics.typeOfThrown(variable);

  return frame.escapes.flatMap((escape) => {
    if (excluded.some((type) => semantics.isAssignable(escape.thrown, type))) {
      return [];
    }

    if (narrowed === undefined) {
      return [escape];
    }

    return narrowed.flatMap((member) => {
      if (semantics.isAssignable(escape.thrown, member)) {
        return [escape];
      }

      return semantics.isAssignable(member, escape.thrown)
        ? [{ thrown: member, site: escape.site, via: escape.via }]
        : [];
    });
  });
};
