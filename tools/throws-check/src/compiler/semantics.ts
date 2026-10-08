import type { ts } from './ts.ts';

/**
 * A type a body can throw or a tag can document, with the name used in messages.
 */
export interface Thrown {
  readonly name: string;
  readonly type: ts.Type | undefined;
}

/**
 * One `@throws` tag, read into the types it names.
 */
export interface ThrowsTag {
  readonly node: ts.JSDocTag;
  readonly thrown: readonly Thrown[];
  readonly unresolved: readonly string[];
}

/**
 * What the checker needs to know about the target of a call, `new`, tag or accessor.
 */
export interface Callee {
  readonly name: string;
  readonly declarations: readonly ts.Node[];
  readonly keys: readonly string[];
  readonly returnsPromise: boolean;
  readonly parameters: readonly string[];
  readonly variadic: boolean;
}

/**
 * A kind of value an expression can hold at run time.
 */
export type ValueKind =
  | 'string'
  | 'number'
  | 'integer'
  | 'bigint'
  | 'boolean'
  | 'nullish'
  | 'symbol'
  | 'object'
  | 'open';

/**
 * The nodes that call something.
 */
export type CallLike = ts.CallExpression | ts.NewExpression | ts.TaggedTemplateExpression;

/**
 * The narrow surface over the compiler that the analysis runs on.
 *
 * @remarks
 * Every question that needs the type checker goes through here, so a port to another
 * compiler API replaces the `compiler` folder and nothing else.
 */
export interface Semantics {
  readonly files: readonly ts.SourceFile[];
  readonly resolveCallee: (node: CallLike) => Callee | undefined;
  readonly resolveAccessor: (
    node: ts.PropertyAccessExpression | ts.ElementAccessExpression,
    write: boolean,
  ) => Callee | undefined;
  readonly resolveFunctionReference: (node: ts.Expression) => Callee | undefined;
  readonly jsDocThrowsOf: (declaration: ts.Node) => readonly ThrowsTag[];
  readonly jsDocRethrowsOf: (declaration: ts.Node) => readonly string[];
  readonly typeOfThrown: (expression: ts.Expression) => readonly Thrown[] | undefined;
  readonly instanceTypeOf: (constructor: ts.Expression) => readonly Thrown[] | undefined;
  readonly thrownByName: (name: string, location: ts.Node) => Thrown;
  readonly thrownOfComment: (text: string, location: ts.Node) => readonly Thrown[];
  readonly isAssignable: (thrown: Thrown, declared: Thrown) => boolean;
  readonly sameSymbol: (left: ts.Node, right: ts.Node) => boolean;
  readonly declarationsOf: (member: ts.ClassElement) => readonly ts.Node[];
  readonly objectContractsOf: (fn: ts.Node) => readonly ts.Node[];
  readonly baseConstructorsOf: (node: ts.ClassLikeDeclaration) => readonly ts.Node[];
  readonly overloadsOf: (node: ts.FunctionLikeDeclaration) => readonly ts.Node[];
  readonly returnsPromise: (node: ts.SignatureDeclaration) => boolean;
  readonly valueKindsOf: (expression: ts.Expression) => ReadonlySet<ValueKind>;
  readonly mayFailJson: (expression: ts.Expression) => boolean;
  readonly literalValuesOf: (
    expression: ts.Expression,
  ) => ReadonlyArray<string | number> | undefined;
}
