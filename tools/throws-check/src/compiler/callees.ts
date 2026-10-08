import { baseConstructorsOf, constructorChainOf } from './classes.ts';
import { hasBody, isLibrary, nameNodeOf, nameText, resolveAlias, symbolOf } from './nodes.ts';
import type { CallLike, Callee } from './semantics.ts';
import { ts } from './ts.ts';
import { isThenable } from './types.ts';

const namespaceObjects = new Set(['JSON', 'Math', 'Atomics', 'Reflect', 'Intl', 'Temporal']);

const prototypeOwners: Readonly<Record<string, string>> = {
  ReadonlyArray: 'Array',
  ReadonlyMap: 'Map',
  ReadonlySet: 'Set',
};

const calleeExpressionOf = (node: CallLike): ts.Expression =>
  ts.isTaggedTemplateExpression(node) ? node.tag : node.expression;

const dottedName = (node: ts.Expression): readonly ts.Identifier[] | undefined => {
  if (ts.isIdentifier(node)) {
    return [node];
  }

  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)) {
    const left = dottedName(node.expression);

    return left === undefined ? undefined : [...left, node.name];
  }

  return undefined;
};

const isGlobal = (checker: ts.TypeChecker, identifier: ts.Identifier): boolean => {
  const declarations = symbolOf(checker, identifier)?.declarations ?? [];

  return declarations.length > 0 && declarations.every((declaration) => isLibrary(declaration));
};

const expressionKey = (checker: ts.TypeChecker, node: CallLike): string | undefined => {
  const path = dottedName(calleeExpressionOf(node));
  const [root] = path ?? [];

  if (path === undefined || root === undefined || !isGlobal(checker, root)) {
    return undefined;
  }

  return (ts.isNewExpression(node) ? 'new ' : '') + path.map((part) => part.text).join('.');
};

const constructorKey = (
  base: string,
  declaration: ts.Node,
  member: string,
  isNew: boolean,
): string => {
  if (isNew || ts.isConstructSignatureDeclaration(declaration)) {
    return `new ${base}`;
  }

  return ts.isCallSignatureDeclaration(declaration) ? base : `${base}.${member}`;
};

const declarationKey = (declaration: ts.Node | undefined, isNew: boolean): string | undefined => {
  if (declaration === undefined || !isLibrary(declaration)) {
    return undefined;
  }

  const owner = declaration.parent;
  const member = nameText(nameNodeOf(declaration)) ?? '';

  if (ts.isSourceFile(owner) || ts.isModuleBlock(owner)) {
    return member;
  }

  if (!ts.isInterfaceDeclaration(owner) && !ts.isClassDeclaration(owner)) {
    return undefined;
  }

  const ownerName = owner.name?.text ?? '';

  if (ownerName.endsWith('Constructor')) {
    return constructorKey(ownerName.slice(0, -'Constructor'.length), declaration, member, isNew);
  }

  if (ts.isConstructorDeclaration(declaration)) {
    return `new ${ownerName}`;
  }

  return namespaceObjects.has(ownerName)
    ? `${ownerName}.${member}`
    : `${prototypeOwners[ownerName] ?? ownerName}.prototype.${member}`;
};

const implementationOf = (checker: ts.TypeChecker, declaration: ts.Node): ts.Node | undefined =>
  ts.isFunctionLike(declaration) && !hasBody(declaration)
    ? symbolOf(checker, declaration)?.declarations?.find((other) => hasBody(other))
    : undefined;

const ownerDeclarations = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
): readonly ts.Node[] =>
  symbolOf(checker, ts.isPropertyAccessExpression(expression) ? expression.name : expression)
    ?.declarations ?? [];

const constructedClass = (
  checker: ts.TypeChecker,
  node: ts.NewExpression,
): ts.ClassLikeDeclaration | undefined => {
  const declaration = checker.getTypeAtLocation(node).getSymbol()?.valueDeclaration;

  return declaration !== undefined && ts.isClassLike(declaration) && !isLibrary(declaration)
    ? declaration
    : undefined;
};

const isSuperCall = (node: CallLike): boolean =>
  ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.SuperKeyword;

const enclosingClass = (node: ts.Node): ts.ClassLikeDeclaration | undefined => {
  let current = node.parent;

  while (!ts.isSourceFile(current) && !ts.isClassLike(current)) {
    current = current.parent;
  }

  return ts.isClassLike(current) ? current : undefined;
};

const parametersOf = (
  declaration: ts.Node | undefined,
): Pick<Callee, 'parameters' | 'variadic'> => {
  if (declaration === undefined || !ts.isFunctionLike(declaration)) {
    return { parameters: [], variadic: false };
  }

  return {
    parameters: declaration.parameters.map((parameter) => nameText(parameter.name) ?? ''),
    variadic: declaration.parameters.at(-1)?.dotDotDotToken !== undefined,
  };
};

const declarationsFor = (
  checker: ts.TypeChecker,
  node: CallLike,
  declaration: ts.Declaration | undefined,
): readonly ts.Node[] => {
  const ownClass = ts.isNewExpression(node) ? constructedClass(checker, node) : undefined;

  if (ownClass !== undefined) {
    return constructorChainOf(checker, ownClass);
  }

  const enclosing = isSuperCall(node) ? enclosingClass(node) : undefined;

  if (enclosing !== undefined) {
    return baseConstructorsOf(checker, enclosing);
  }

  if (declaration === undefined) {
    return [];
  }

  const implementation = implementationOf(checker, declaration);
  const owners =
    !isLibrary(declaration) || ts.isFunctionTypeNode(declaration)
      ? ownerDeclarations(checker, calleeExpressionOf(node))
      : [];

  return [declaration, ...(implementation === undefined ? [] : [implementation]), ...owners];
};

const isOpenCallee = (checker: ts.TypeChecker, expression: ts.Expression): boolean =>
  expression.kind !== ts.SyntaxKind.SuperKeyword &&
  (checker.getTypeAtLocation(expression).flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0;

/**
 * Resolves what a call, `new` or tagged template runs, or `undefined` for an `any` callee.
 */
export const resolveCallee = (checker: ts.TypeChecker, node: CallLike): Callee | undefined => {
  const expression = calleeExpressionOf(node);

  if (isOpenCallee(checker, expression)) {
    return undefined;
  }

  const signature = checker.getResolvedSignature(node);
  const declaration = signature?.declaration;
  const isNew = ts.isNewExpression(node);
  const keys = [expressionKey(checker, node), declarationKey(declaration, isNew)].filter(
    (key) => key !== undefined,
  );
  const returnType =
    signature === undefined ? undefined : checker.getReturnTypeOfSignature(signature);

  return {
    name: `${isNew ? 'new ' : ''}${expression.getText().replaceAll(/\s+/gu, ' ').slice(0, 60)}`,
    declarations: declarationsFor(checker, node, declaration),
    keys,
    returnsPromise: !isNew && returnType !== undefined && isThenable(checker, returnType),
    ...parametersOf(declaration),
  };
};

/**
 * Resolves the getter or setter a property access runs, if it runs one.
 */
export const resolveAccessor = (
  checker: ts.TypeChecker,
  node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  write: boolean,
): Callee | undefined => {
  const target = ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression;
  const symbol = checker.getSymbolAtLocation(target);
  const flag = write ? ts.SymbolFlags.SetAccessor : ts.SymbolFlags.GetAccessor;

  if (symbol === undefined || (symbol.flags & flag) === 0) {
    return undefined;
  }

  const kind = write ? ts.SyntaxKind.SetAccessor : ts.SyntaxKind.GetAccessor;

  return {
    name: `${write ? 'set' : 'get'} ${target.getText()}`,
    declarations: (symbol.declarations ?? []).filter((declaration) => declaration.kind === kind),
    keys: [],
    returnsPromise: false,
    parameters: [],
    variadic: false,
  };
};

const isFunctionDeclaration = (declaration: ts.Node): boolean =>
  ts.isFunctionDeclaration(declaration) ||
  ts.isMethodDeclaration(declaration) ||
  ts.isMethodSignature(declaration) ||
  (ts.isVariableDeclaration(declaration) &&
    declaration.initializer !== undefined &&
    (ts.isArrowFunction(declaration.initializer) ||
      ts.isFunctionExpression(declaration.initializer)));

/**
 * Resolves a function passed by name, as in `lines.map(parse)`.
 */
export const resolveFunctionReference = (
  checker: ts.TypeChecker,
  node: ts.Expression,
): Callee | undefined => {
  const symbol = checker.getSymbolAtLocation(
    ts.isPropertyAccessExpression(node) ? node.name : node,
  );
  const declarations = (
    symbol === undefined ? [] : (resolveAlias(checker, symbol).declarations ?? [])
  ).filter((declaration) => isFunctionDeclaration(declaration));

  return declarations.length === 0
    ? undefined
    : {
        name: node.getText(),
        declarations,
        keys: [],
        returnsPromise: false,
        parameters: [],
        variadic: false,
      };
};

/**
 * Tells whether a function hands its result over as a promise.
 */
export const returnsPromise = (checker: ts.TypeChecker, node: ts.SignatureDeclaration): boolean => {
  if ((ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async) !== 0) {
    return true;
  }

  const signature = checker.getSignatureFromDeclaration(node);

  return (
    signature !== undefined && isThenable(checker, checker.getReturnTypeOfSignature(signature))
  );
};
