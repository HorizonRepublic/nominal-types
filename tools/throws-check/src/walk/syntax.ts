import { ts } from '../compiler/ts.ts';

/**
 * The nodes that start a body of their own, which the walk of the outer body skips.
 */
export type FunctionLike =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration
  | ts.ConstructorDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

/**
 * A function written in place, as an argument or a returned value.
 */
export type InlineFunction = ts.ArrowFunction | ts.FunctionExpression;

const ignorePattern = /^\/\/\s*@throws-ignore\b(.*)$/u;
const throwsPattern = /^\/\/\s*@throws\s+(.*)$/u;

/**
 * Tells whether a node starts a body the checker reads on its own.
 */
export const isFunctionLike = (node: ts.Node): node is FunctionLike =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isConstructorDeclaration(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node);

/**
 * Removes parentheses, `as`, `satisfies` and `!` around an expression.
 */
export const skipOuter = (node: ts.Expression): ts.Expression => {
  let current = node;

  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }

  return current;
};

/**
 * The function an expression writes in place, if it is one.
 */
export const asFunction = (node: ts.Expression): InlineFunction | undefined => {
  const inner = skipOuter(node);

  return ts.isArrowFunction(inner) || ts.isFunctionExpression(inner) ? inner : undefined;
};

/**
 * Tells whether a function hands its throws to a promise or an iterator rather than its caller.
 */
export const isAsyncOrGenerator = (node: FunctionLike): boolean =>
  ('asteriskToken' in node && node.asteriskToken !== undefined) ||
  (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async) !== 0;

const outerParent = (node: ts.Node): { readonly child: ts.Node; readonly parent: ts.Node } => {
  let child = node;
  let { parent } = node;

  while (
    ts.isParenthesizedExpression(parent) ||
    ts.isAsExpression(parent) ||
    ts.isSatisfiesExpression(parent) ||
    (ts.isConditionalExpression(parent) && parent.condition !== child)
  ) {
    child = parent;
    ({ parent } = parent);
  }

  return { child, parent };
};

/**
 * Tells whether a function is an argument of a call, which makes it a callback.
 */
export const isCallbackArgument = (node: ts.Node): boolean => {
  const { child, parent } = outerParent(node);

  return (
    (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
    (parent.arguments?.some((argument) => argument === child) ?? false)
  );
};

/**
 * Tells whether a statement never falls through to the next one.
 */
export const alwaysExits = (node: ts.Statement): boolean => {
  if (ts.isBlock(node)) {
    const last = node.statements.at(-1);

    return last !== undefined && alwaysExits(last);
  }

  if (ts.isIfStatement(node)) {
    return (
      node.elseStatement !== undefined &&
      alwaysExits(node.thenStatement) &&
      alwaysExits(node.elseStatement)
    );
  }

  return (
    ts.isReturnStatement(node) ||
    ts.isThrowStatement(node) ||
    ts.isContinueStatement(node) ||
    ts.isBreakStatement(node)
  );
};

/**
 * Tells whether a property access reads, writes or does both, as `+=` does.
 */
export const accessModes = (node: ts.Node): { readonly read: boolean; readonly write: boolean } => {
  const { parent } = node;

  if (
    ts.isBinaryExpression(parent) &&
    parent.left === node &&
    parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) {
    return { read: parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken, write: true };
  }

  const counts =
    (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
    (parent.operator === ts.SyntaxKind.PlusPlusToken ||
      parent.operator === ts.SyntaxKind.MinusMinusToken);

  return { read: true, write: counts };
};

/**
 * Reads `// @throws-ignore <reason>` from the comments in front of a node: `true` for a valid
 * ignore, `'no-reason'` for one without a reason, `false` for none.
 */
export const ignoreOf = (node: ts.Node): boolean | 'no-reason' => {
  const file = node.getSourceFile();
  const ranges = ts.getLeadingCommentRanges(file.text, node.getFullStart()) ?? [];

  for (const range of ranges) {
    const match = ignorePattern.exec(file.text.slice(range.pos, range.end).trim());

    if (match !== null) {
      return (match[1] ?? '').trim() === '' ? 'no-reason' : true;
    }
  }

  return false;
};

/**
 * Reads the text after `// @throws` from each such comment in front of a node.
 */
export const throwsCommentsOf = (node: ts.Node): readonly string[] => {
  const file = node.getSourceFile();
  const ranges = ts.getLeadingCommentRanges(file.text, node.getFullStart()) ?? [];

  return ranges.flatMap((range) => {
    const match = throwsPattern.exec(file.text.slice(range.pos, range.end).trim());

    return match?.[1] === undefined ? [] : [match[1]];
  });
};

/**
 * Tells whether a node is a statement, which an ignore comment can stand in front of.
 */
export const isStatement = (node: ts.Node): boolean =>
  node.kind >= ts.SyntaxKind.FirstStatement && node.kind <= ts.SyntaxKind.LastStatement;

/**
 * Tells whether a node takes `// @throws` and `// @throws-ignore` comments: a statement, or the
 * expression body of an arrow function.
 */
export const takesComments = (node: ts.Node): boolean =>
  isStatement(node) || (ts.isArrowFunction(node.parent) && node.parent.body === node);
