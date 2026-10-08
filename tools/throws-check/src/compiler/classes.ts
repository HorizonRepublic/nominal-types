import { hasBody, nameText, symbolOf } from './nodes.ts';
import { ts } from './ts.ts';

/**
 * Lists the members a class member implements or overrides, from every `extends` and
 * `implements` clause of its class.
 */
export const declarationsOf = (
  checker: ts.TypeChecker,
  member: ts.ClassElement,
): readonly ts.Node[] => {
  const name = nameText(member.name);
  const owner = member.parent;

  if (name === undefined || !ts.isClassLike(owner)) {
    return [];
  }

  return (owner.heritageClauses ?? []).flatMap((clause) =>
    clause.types.flatMap(
      (heritage) =>
        checker.getPropertyOfType(checker.getTypeAtLocation(heritage), name)?.declarations ?? [],
    ),
  );
};

const heritageOf = (node: ts.ClassLikeDeclaration): ts.ExpressionWithTypeArguments | undefined =>
  node.heritageClauses
    ?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
    ?.types.at(0);

const baseSignatureDeclarations = (
  checker: ts.TypeChecker,
  heritage: ts.ExpressionWithTypeArguments,
): readonly ts.Node[] =>
  checker
    .getTypeAtLocation(heritage.expression)
    .getConstructSignatures()
    .flatMap((signature) => {
      const declaration =
        signature.declaration ??
        checker.getReturnTypeOfSignature(signature).getSymbol()?.valueDeclaration;

      return declaration === undefined ? [] : [declaration];
    });

const classOf = (declaration: ts.Node): ts.ClassLikeDeclaration | undefined => {
  if (ts.isClassLike(declaration)) {
    return declaration;
  }

  return ts.isConstructorDeclaration(declaration) ? declaration.parent : undefined;
};

/**
 * Lists the constructors that document what `new` of a class throws, nearest first: its own
 * constructor, or the class itself when it has none, then the same for each parent class.
 */
export const constructorChainOf = (
  checker: ts.TypeChecker,
  node: ts.ClassLikeDeclaration,
): readonly ts.Node[] => {
  const chain: ts.Node[] = [];
  const seen = new Set<ts.Node>();
  let current: ts.ClassLikeDeclaration | undefined = node;

  while (current !== undefined && !seen.has(current)) {
    seen.add(current);

    const constructors = current.members.filter((member) => ts.isConstructorDeclaration(member));

    chain.push(...(constructors.length > 0 ? constructors : [current]));

    const heritage = heritageOf(current);
    const bases = heritage === undefined ? [] : baseSignatureDeclarations(checker, heritage);
    const [base] = bases;

    current = base === undefined ? undefined : classOf(base);

    if (current === undefined) {
      chain.push(...bases);
    }
  }

  return chain;
};

/**
 * Lists the constructor chain of the parent of a class, which `super()` runs.
 */
export const baseConstructorsOf = (
  checker: ts.TypeChecker,
  node: ts.ClassLikeDeclaration,
): readonly ts.Node[] =>
  constructorChainOf(checker, node).filter((entry) => {
    const owner = classOf(entry) ?? entry.parent;

    return owner !== node;
  });

/**
 * Lists the overload signatures of a function or method with a body.
 */
export const overloadsOf = (
  checker: ts.TypeChecker,
  node: ts.FunctionLikeDeclaration,
): readonly ts.Node[] =>
  node.name === undefined
    ? []
    : (symbolOf(checker, node)?.declarations ?? []).filter(
        (declaration) =>
          declaration !== node && ts.isFunctionLike(declaration) && !hasBody(declaration),
      );

/**
 * Tells whether two nodes name the same symbol.
 */
export const sameSymbol = (checker: ts.TypeChecker, left: ts.Node, right: ts.Node): boolean => {
  const symbol = checker.getSymbolAtLocation(left);

  return symbol !== undefined && symbol === checker.getSymbolAtLocation(right);
};

/**
 * Lists the members of the contextual type that a function in an object literal implements, as
 * `parse` in `const reader: Reader = { parse: (text) => … }`.
 */
export const objectContractsOf = (checker: ts.TypeChecker, fn: ts.Node): readonly ts.Node[] => {
  const property = ts.isPropertyAssignment(fn.parent) ? fn.parent : fn;

  if (!ts.isObjectLiteralElementLike(property) || !ts.isObjectLiteralExpression(property.parent)) {
    return [];
  }

  const name = nameText(property.name);
  const type = checker.getContextualType(property.parent);

  return name === undefined || type === undefined
    ? []
    : (checker.getPropertyOfType(type, name)?.declarations ?? []).filter(
        (declaration) => declaration !== property,
      );
};
