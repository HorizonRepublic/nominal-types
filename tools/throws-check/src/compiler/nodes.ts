import { ts } from './ts.ts';

/**
 * Tells whether a node comes from a declaration file, such as the standard library.
 */
export const isLibrary = (node: ts.Node): boolean => node.getSourceFile().isDeclarationFile;

/**
 * Follows an import to the symbol it names.
 */
export const resolveAlias = (checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol =>
  (symbol.flags & ts.SymbolFlags.Alias) === 0 ? symbol : checker.getAliasedSymbol(symbol);

const isNode = (value: unknown): value is ts.Node =>
  typeof value === 'object' && value !== null && 'kind' in value && typeof value.kind === 'number';

/**
 * The name node of a declaration, when it has one.
 */
export const nameNodeOf = (node: ts.Node): ts.Node | undefined =>
  'name' in node && isNode(node.name) ? node.name : undefined;

/**
 * The text of a plain name, a string key or a number key.
 */
export const nameText = (name: ts.Node | undefined): string | undefined =>
  name !== undefined &&
  (ts.isIdentifier(name) ||
    ts.isPrivateIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name))
    ? name.text
    : undefined;

/**
 * Tells whether a declaration carries a body, which overload signatures lack.
 */
export const hasBody = (node: ts.Node): boolean =>
  ts.isFunctionLike(node) && 'body' in node && node.body !== undefined;

/**
 * The symbol a declaration or a reference stands for.
 */
export const symbolOf = (checker: ts.TypeChecker, node: ts.Node): ts.Symbol | undefined => {
  const symbol = checker.getSymbolAtLocation(nameNodeOf(node) ?? node);

  return symbol === undefined ? undefined : resolveAlias(checker, symbol);
};
