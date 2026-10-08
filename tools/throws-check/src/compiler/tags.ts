import { resolveAlias } from './nodes.ts';
import type { Thrown, ThrowsTag } from './semantics.ts';
import { ts } from './ts.ts';
import { isErrorType, toThrown } from './types.ts';

/**
 * The caches the tag reader keeps for one program.
 */
export interface TagReader {
  readonly checker: ts.TypeChecker;
  readonly scopes: WeakMap<ts.SourceFile, ReadonlyMap<string, ts.Symbol>>;
  readonly tags: WeakMap<ts.Node, readonly ThrowsTag[]>;
  readonly files: readonly ts.SourceFile[];
  readonly exported: Map<string, ts.Symbol | undefined>;
}

const leadingName = /^\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/u;

const hostOf = (tag: ts.JSDocTag): ts.Node => {
  let node: ts.Node = tag;

  while (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) {
    node = node.parent;
  }

  return node;
};

const unionMembers = (node: ts.TypeNode): readonly ts.TypeNode[] => {
  if (ts.isParenthesizedTypeNode(node)) {
    return unionMembers(node.type);
  }

  return ts.isUnionTypeNode(node) ? node.types.flatMap((member) => unionMembers(member)) : [node];
};

/**
 * Starts the caches for one program.
 */
export const createTagReader = (
  checker: ts.TypeChecker,
  files: readonly ts.SourceFile[],
): TagReader => ({
  checker,
  scopes: new WeakMap(),
  tags: new WeakMap(),
  files,
  exported: new Map(),
});

const indexExports = (reader: TagReader): void => {
  const found = new Map<string, Set<ts.Symbol>>();

  for (const file of reader.files) {
    const module = reader.checker.getSymbolAtLocation(file);
    const exports = module === undefined ? [] : reader.checker.getExportsOfModule(module);

    for (const symbol of exports.map((exported) => resolveAlias(reader.checker, exported))) {
      if ((symbol.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Interface)) !== 0) {
        found.set(symbol.name, (found.get(symbol.name) ?? new Set()).add(symbol));
      }
    }
  }

  for (const [name, symbols] of found) {
    reader.exported.set(name, symbols.size === 1 ? [...symbols][0] : undefined);
  }
};

const exportedByName = (reader: TagReader, name: string): ts.Symbol | undefined => {
  if (reader.exported.size === 0) {
    indexExports(reader);
  }

  return reader.exported.get(name);
};

const scopeOf = (reader: TagReader, file: ts.SourceFile): ReadonlyMap<string, ts.Symbol> => {
  const cached = reader.scopes.get(file);

  if (cached !== undefined) {
    return cached;
  }

  const meaning = ts.SymbolFlags.Type | ts.SymbolFlags.Namespace | ts.SymbolFlags.Alias;
  const scope = new Map(
    reader.checker.getSymbolsInScope(file, meaning).map((symbol) => [symbol.name, symbol]),
  );

  reader.scopes.set(file, scope);

  return scope;
};

/**
 * Finds the type a dotted name stands for in the scope of a file.
 *
 * @remarks
 * Names the file can see at its top level resolve first, which covers imports and globals. A
 * plain name the file cannot see falls back to the one class or interface of that name the
 * project's files export, so a doc comment can link a type the code does not import.
 */
export const thrownByName = (reader: TagReader, name: string, location: ts.Node): Thrown => {
  const [root = '', ...rest] = name.split('.');
  let symbol =
    scopeOf(reader, location.getSourceFile()).get(root) ??
    (rest.length === 0 ? exportedByName(reader, root) : undefined);

  for (const part of rest) {
    symbol =
      symbol === undefined
        ? undefined
        : resolveAlias(reader.checker, symbol).exports?.get(ts.escapeLeadingUnderscores(part));
  }

  const target = symbol === undefined ? undefined : resolveAlias(reader.checker, symbol);

  return target === undefined || (target.flags & ts.SymbolFlags.Type) === 0
    ? { name, type: undefined }
    : { name, type: reader.checker.getDeclaredTypeOfSymbol(target) };
};

const readWord = (reader: TagReader, tag: ts.JSDocTag, text: string | undefined): ThrowsTag => {
  const word = leadingName.exec(text ?? '')?.[1];

  if (word === undefined) {
    return { node: tag, thrown: [], unresolved: [''] };
  }

  const { type } = thrownByName(reader, word, hostOf(tag));
  const named = word.charAt(0) !== word.charAt(0).toLowerCase();

  return type === undefined
    ? { node: tag, thrown: [], unresolved: [named ? word : ''] }
    : { node: tag, thrown: toThrown(reader.checker, type), unresolved: [] };
};

const readTypeExpression = (reader: TagReader, tag: ts.JSDocTag, node: ts.TypeNode): ThrowsTag => {
  const thrown: Thrown[] = [];
  const unresolved: string[] = [];

  for (const member of unionMembers(node)) {
    const type = reader.checker.getTypeFromTypeNode(member);

    if (isErrorType(type)) {
      unresolved.push(member.getText());
    } else {
      thrown.push(...toThrown(reader.checker, type));
    }
  }

  return { node: tag, thrown, unresolved };
};

const link = String.raw`\{@link(?:code|plain)?\s+([A-Za-z_$][\w$.]*)[^}]*\}`;
const linkUnion = new RegExp(String.raw`^@throws\s+(${link}(?:\s*\|\s*${link})*)`, 'u');
const linkName = new RegExp(link, 'gu');

const braced = /^\{([^{}]*)\}/u;

/**
 * Reads the type names from the text after `@throws`, in any form a tag takes.
 */
const namesOfText = (text: string): readonly string[] => {
  const union = linkUnion.exec(`@throws ${text}`)?.[1];

  if (union !== undefined) {
    return [...union.matchAll(linkName)].map((match) => match[1] ?? '');
  }

  const inBraces = braced.exec(text)?.[1];

  if (inBraces !== undefined) {
    return inBraces.split('|').map((name) => name.trim());
  }

  const word = leadingName.exec(text)?.[1];

  return word === undefined ? [] : [word];
};

/**
 * The types a `// @throws …` comment in front of a statement names, resolved where it stands.
 */
export const thrownOfComment = (
  reader: TagReader,
  text: string,
  location: ts.Node,
): readonly Thrown[] => namesOfText(text).map((name) => thrownByName(reader, name, location));

const linkedNames = (tag: ts.JSDocTag): readonly string[] | undefined => {
  const file = tag.getSourceFile();
  const union = linkUnion.exec(file.text.slice(tag.getStart(file), tag.parent.end))?.[1];

  return union === undefined
    ? undefined
    : [...union.matchAll(linkName)].map((match) => match[1] ?? '');
};

const readLinks = (reader: TagReader, tag: ts.JSDocTag, names: readonly string[]): ThrowsTag => {
  const thrown: Thrown[] = [];
  const unresolved: string[] = [];

  for (const name of names) {
    const { type } = thrownByName(reader, name, hostOf(tag));

    if (type === undefined) {
      unresolved.push(name);
    } else {
      thrown.push(...toThrown(reader.checker, type));
    }
  }

  return { node: tag, thrown, unresolved };
};

const readTag = (reader: TagReader, tag: ts.JSDocThrowsTag): ThrowsTag => {
  const links = linkedNames(tag);

  if (links !== undefined) {
    return readLinks(reader, tag, links);
  }

  const expression = tag.typeExpression?.type;

  if (expression !== undefined) {
    return readTypeExpression(reader, tag, expression);
  }

  return readWord(reader, tag, ts.getTextOfJSDocComment(tag.comment));
};

/**
 * Reads the `@throws` tags of a declaration.
 *
 * @remarks
 * A tag names its type as `{T}`, `{A | B}`, `{@link T}`, `{@link A} | {@link B}` or as the first
 * word of its text.
 */
export const jsDocThrowsOf = (reader: TagReader, declaration: ts.Node): readonly ThrowsTag[] => {
  const cached = reader.tags.get(declaration);

  if (cached !== undefined) {
    return cached;
  }

  const tags = ts
    .getJSDocTags(declaration)
    .filter((tag) => ts.isJSDocThrowsTag(tag))
    .map((tag) => readTag(reader, tag));

  reader.tags.set(declaration, tags);

  return tags;
};

/**
 * Reads the parameter names of the `@rethrows` tags of a declaration.
 */
export const jsDocRethrowsOf = (declaration: ts.Node): readonly string[] =>
  ts
    .getJSDocTags(declaration)
    .filter((tag) => tag.tagName.text === 'rethrows')
    .flatMap((tag) => leadingName.exec(ts.getTextOfJSDocComment(tag.comment) ?? '')?.[1] ?? []);
