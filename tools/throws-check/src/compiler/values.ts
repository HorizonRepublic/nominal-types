import { isLibrary } from './nodes.ts';
import type { ValueKind } from './semantics.ts';
import { ts } from './ts.ts';

const primitiveKinds: ReadonlyArray<readonly [ts.TypeFlags, ValueKind]> = [
  [ts.TypeFlags.StringLike, 'string'],
  [ts.TypeFlags.NumberLike, 'number'],
  [ts.TypeFlags.BigIntLike, 'bigint'],
  [ts.TypeFlags.BooleanLike, 'boolean'],
  [ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void, 'nullish'],
  [ts.TypeFlags.ESSymbolLike, 'symbol'],
];

const isOpen = (type: ts.Type): boolean =>
  (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0;

const constraintOf = (checker: ts.TypeChecker, type: ts.Type): ts.Type | undefined =>
  (type.flags & ts.TypeFlags.Instantiable) === 0 ? type : checker.getBaseConstraintOfType(type);

const kindsOfType = (checker: ts.TypeChecker, type: ts.Type): readonly ValueKind[] => {
  const resolved = constraintOf(checker, type);

  if (resolved === undefined || isOpen(resolved)) {
    return ['open'];
  }

  if (resolved.isUnionOrIntersection()) {
    return resolved.types.flatMap((member) => kindsOfType(checker, member));
  }

  if (resolved.isNumberLiteral() && Number.isSafeInteger(resolved.value)) {
    return ['integer'];
  }

  const primitive = primitiveKinds.find(([flags]) => (resolved.flags & flags) !== 0);

  return primitive === undefined ? ['object'] : [primitive[1]];
};

/**
 * The kinds of value an expression can hold at run time, with `open` for `any`, `unknown` and
 * unconstrained type parameters, and `integer` for a safe integer literal.
 */
export const valueKindsOf = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
): ReadonlySet<ValueKind> => new Set(kindsOfType(checker, checker.getTypeAtLocation(expression)));

const jsonRiskOfObject = (checker: ts.TypeChecker, type: ts.Type, seen: Set<ts.Type>): boolean => {
  if (type.getCallSignatures().length > 0) {
    return false;
  }

  const toJson = checker.getPropertyOfType(type, 'toJSON');

  if (toJson !== undefined) {
    const declaration = toJson.declarations?.[0];
    const [signature] = checker.getTypeOfSymbol(toJson).getCallSignatures();

    return declaration !== undefined && !isLibrary(declaration) && signature !== undefined
      ? jsonRisk(checker, checker.getReturnTypeOfSignature(signature), seen)
      : false;
  }

  const members = [
    ...checker.getPropertiesOfType(type).map((property) => checker.getTypeOfSymbol(property)),
    ...checker.getIndexInfosOfType(type).map((info) => info.type),
  ];

  return members.length === 0 || members.some((member) => jsonRisk(checker, member, seen));
};

const jsonRisk = (checker: ts.TypeChecker, type: ts.Type, seen: Set<ts.Type>): boolean => {
  const resolved = constraintOf(checker, type);

  if (
    resolved === undefined ||
    isOpen(resolved) ||
    (resolved.flags & ts.TypeFlags.BigIntLike) !== 0
  ) {
    return true;
  }

  if (resolved.isUnionOrIntersection()) {
    return resolved.types.some((member) => jsonRisk(checker, member, seen));
  }

  if (
    (resolved.flags & (ts.TypeFlags.Object | ts.TypeFlags.NonPrimitive)) === 0 ||
    seen.has(resolved)
  ) {
    return false;
  }

  seen.add(resolved);

  return jsonRiskOfObject(checker, resolved, seen);
};

/**
 * Tells whether `JSON.stringify` can throw on the value of an expression: when the value can
 * hold a bigint, is not known (`any`, `unknown`, `object`, `{}`), or has a `toJSON` of the
 * project's own whose result can.
 *
 * @remarks
 * Cycles are not tracked: a type that refers to itself counts as safe.
 */
export const mayFailJson = (checker: ts.TypeChecker, expression: ts.Expression): boolean =>
  jsonRisk(checker, checker.getTypeAtLocation(expression), new Set());

/**
 * The literal values an expression can hold, or `undefined` when its type is not a union of
 * string and number literals.
 */
export const literalValuesOf = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
): ReadonlyArray<string | number> | undefined => {
  const type = checker.getTypeAtLocation(expression);
  const members = type.isUnion() ? type.types : [type];
  const values = members.flatMap((member) =>
    member.isStringLiteral() || member.isNumberLiteral() ? [member.value] : [],
  );

  return values.length === members.length ? values : undefined;
};
