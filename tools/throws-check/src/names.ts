import { ts } from './compiler/ts.ts';
import type { FunctionLike } from './walk/syntax.ts';

/**
 * A class member a function can stand for, whose contract it inherits.
 */
export type Member =
  | ts.MethodDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration
  | ts.PropertyDeclaration;

/**
 * The text of a member name, with computed names left as a placeholder.
 */
export const memberName = (name: ts.Node | undefined): string =>
  name !== undefined &&
  (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name))
    ? name.text
    : '[computed]';

/**
 * The name of the class or interface around a member.
 */
export const ownerName = (node: ts.Node): string =>
  (ts.isClassLike(node) || ts.isInterfaceDeclaration(node)) && node.name !== undefined
    ? node.name.text
    : 'class';

const accessorPrefix = (fn: FunctionLike): string => {
  if (ts.isGetAccessorDeclaration(fn)) {
    return 'get ';
  }

  return ts.isSetAccessorDeclaration(fn) ? 'set ' : '';
};

const inlineName = (fn: FunctionLike): string => {
  const { parent } = fn;

  if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) {
    return memberName(parent.name);
  }

  if (ts.isPropertyDeclaration(parent)) {
    return `${ownerName(parent.parent)}.${memberName(parent.name)}`;
  }

  return ts.isFunctionDeclaration(fn) ? 'default function' : 'anonymous function';
};

/**
 * The name a message gives a body.
 */
export const nameOf = (fn: FunctionLike | ts.ClassLikeDeclaration): string => {
  if (ts.isClassLike(fn)) {
    return `${ownerName(fn)} constructor`;
  }

  if (ts.isConstructorDeclaration(fn)) {
    return `${ownerName(fn.parent)} constructor`;
  }

  if (
    ts.isMethodDeclaration(fn) ||
    ts.isGetAccessorDeclaration(fn) ||
    ts.isSetAccessorDeclaration(fn)
  ) {
    const owner = ts.isClassLike(fn.parent) ? `${ownerName(fn.parent)}.` : '';

    return `${accessorPrefix(fn)}${owner}${memberName(fn.name)}`;
  }

  return fn.name === undefined ? inlineName(fn) : fn.name.text;
};

/**
 * The node an ignore comment stands in front of for a function.
 */
export const hostOf = (fn: FunctionLike): ts.Node => {
  const { parent } = fn;

  if (ts.isVariableDeclaration(parent)) {
    return parent.parent.parent;
  }

  return ts.isPropertyDeclaration(parent) || ts.isPropertyAssignment(parent) ? parent : fn;
};

/**
 * The class member a function is, or is the value of.
 */
export const memberOf = (fn: FunctionLike): Member | undefined => {
  const isMethod =
    ts.isMethodDeclaration(fn) ||
    ts.isGetAccessorDeclaration(fn) ||
    ts.isSetAccessorDeclaration(fn);

  if (isMethod && ts.isClassLike(fn.parent)) {
    return fn;
  }

  return ts.isPropertyDeclaration(fn.parent) ? fn.parent : undefined;
};

const isStatic = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword);

/**
 * The initializers of the instance fields of a class, which run in its constructor.
 */
export const fieldInitializers = (owner: ts.ClassLikeDeclaration): readonly ts.Expression[] =>
  owner.members.flatMap((member) =>
    ts.isPropertyDeclaration(member) && member.initializer !== undefined && !isStatic(member)
      ? [member.initializer]
      : [],
  );
