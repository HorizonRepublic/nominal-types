import type { Thrown } from './semantics.ts';
import { ts } from './ts.ts';

const isType = (value: unknown): value is ts.Type =>
  typeof value === 'object' && value !== null && 'flags' in value && 'checker' in value;

const objectFlagsOf = (type: ts.Type): number =>
  'objectFlags' in type && typeof type.objectFlags === 'number' ? type.objectFlags : 0;

const isNominal = (type: ts.Type): type is ts.InterfaceType =>
  (type.flags & ts.TypeFlags.Object) !== 0 &&
  (objectFlagsOf(type) & ts.ObjectFlags.ClassOrInterface) !== 0;

const targetOf = (type: ts.Type): ts.Type =>
  (objectFlagsOf(type) & ts.ObjectFlags.Reference) !== 0 && 'target' in type && isType(type.target)
    ? type.target
    : type;

const isOpen = (type: ts.Type): boolean =>
  (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0;

/**
 * Tells whether a type stands for a name the checker could not resolve.
 */
export const isErrorType = (type: ts.Type): boolean =>
  (type.flags & ts.TypeFlags.Any) !== 0 &&
  'intrinsicName' in type &&
  type.intrinsicName === 'error';

/**
 * Splits a union into the types a body can throw, with their names.
 */
export const toThrown = (checker: ts.TypeChecker, type: ts.Type): readonly Thrown[] => {
  if (type.isUnion()) {
    return type.types.flatMap((member) => toThrown(checker, member));
  }

  return (type.flags & ts.TypeFlags.Never) === 0
    ? [{ name: checker.typeToString(type), type }]
    : [];
};

/**
 * Tells whether a value of the type can be awaited.
 */
export const isThenable = (checker: ts.TypeChecker, type: ts.Type): boolean =>
  (type.isUnion() ? type.types : [type]).some((member) => {
    const then = checker.getPropertyOfType(checker.getApparentType(member), 'then');

    return then !== undefined && checker.getTypeOfSymbol(then).getCallSignatures().length > 0;
  });

/**
 * The types of a thrown expression, or `undefined` for `any` and `unknown`.
 */
export const typeOfThrown = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
): readonly Thrown[] | undefined => {
  const type = checker.getTypeAtLocation(expression);

  return isOpen(type) ? undefined : toThrown(checker, type);
};

/**
 * The instance types of a constructor, as on the right of `instanceof`.
 */
export const instanceTypeOf = (
  checker: ts.TypeChecker,
  constructor: ts.Expression,
): readonly Thrown[] | undefined => {
  const [signature] = checker.getTypeAtLocation(constructor).getConstructSignatures();

  return signature === undefined
    ? undefined
    : toThrown(checker, checker.getReturnTypeOfSignature(signature));
};

const extendsNominally = (
  checker: ts.TypeChecker,
  type: ts.Type,
  base: ts.Type,
  seen: Set<ts.Type>,
): boolean => {
  if (type === base || (type.symbol !== undefined && type.symbol === base.symbol)) {
    return true;
  }

  if (seen.has(type) || !isNominal(type)) {
    return false;
  }

  seen.add(type);

  return checker
    .getBaseTypes(type)
    .some((parent) => extendsNominally(checker, targetOf(parent), base, seen));
};

const isTypeAssignable = (checker: ts.TypeChecker, type: ts.Type, declared: ts.Type): boolean => {
  if (isOpen(declared)) {
    return true;
  }

  if (type.isUnion()) {
    return type.types.every((member) => isTypeAssignable(checker, member, declared));
  }

  if (declared.isUnion()) {
    return declared.types.some((member) => isTypeAssignable(checker, type, member));
  }

  if (type.isIntersection()) {
    return type.types.some((member) => isTypeAssignable(checker, member, declared));
  }

  const source = targetOf(type);
  const target = targetOf(declared);

  if (isNominal(source) && isNominal(target)) {
    return extendsNominally(checker, source, target, new Set());
  }

  return checker.isTypeAssignableTo(type, declared);
};

/**
 * Tells whether a documented type covers a thrown one.
 *
 * @remarks
 * Classes and interfaces compare by their declared parents, not by shape, since `RangeError`
 * and `SyntaxError` have the same members. Types that only have a name compare by name.
 */
export const isAssignable = (checker: ts.TypeChecker, thrown: Thrown, declared: Thrown): boolean =>
  thrown.type === undefined || declared.type === undefined
    ? thrown.name === declared.name
    : isTypeAssignable(checker, thrown.type, declared.type);
