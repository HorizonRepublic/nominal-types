import { compare, declaredOf } from './compare.ts';
import type { Comparison } from './compare.ts';
import type { Thrown, ThrowsTag } from './compiler/semantics.ts';
import { ts } from './compiler/ts.ts';
import { fieldInitializers, hostOf, memberName, memberOf, nameOf, ownerName } from './names.ts';
import type { Member } from './names.ts';
import { ignoreOf, isCallbackArgument, isFunctionLike } from './walk/syntax.ts';
import type { FunctionLike } from './walk/syntax.ts';
import type { Escape } from './walk/types.ts';
import type { Walker } from './walk/walker.ts';

/**
 * What the checks of one project share.
 */
export interface Context extends Comparison {
  readonly walker: Walker;
}

const tagsOf = (context: Context, nodes: readonly ts.Node[]): readonly ThrowsTag[] =>
  nodes.flatMap((node) => context.semantics.jsDocThrowsOf(node));

const escapesOfFunction = (context: Context, fn: FunctionLike): readonly Escape[] => {
  const { body } = fn;

  if (body === undefined) {
    return [];
  }

  const roots: ts.Node[] = fn.parameters.flatMap((parameter) => parameter.initializer ?? []);

  if (ts.isConstructorDeclaration(fn)) {
    roots.push(...fieldInitializers(fn.parent));
  }

  roots.push(body);

  return context.walker.escapesOf(
    roots,
    context.semantics.returnsPromise(fn),
    ts.isBlock(body) ? undefined : body,
  );
};

const checkContract = (
  context: Context,
  member: Member,
  name: string,
  own: readonly ThrowsTag[],
): void => {
  for (const contract of context.semantics.declarationsOf(member)) {
    const allowed = context.semantics.jsDocThrowsOf(contract);

    if (allowed.length > 0 || !contract.getSourceFile().isDeclarationFile) {
      const permitted = declaredOf(allowed).map((entry) => entry.thrown);
      const contractName = `${ownerName(contract.parent)}.${memberName(member.name)}`;

      for (const entry of declaredOf(own)) {
        if (!permitted.some((thrown) => context.semantics.isAssignable(entry.thrown, thrown))) {
          const message = `${name} documents a @throws for ${entry.thrown.name}, which ${contractName} does not allow`;

          context.report(entry.tag?.node ?? member, 'contract', message);
        }
      }
    }
  }
};

const isSkipped = (context: Context, fn: FunctionLike): boolean => {
  const host = hostOf(fn);
  const ignore = ignoreOf(host);

  if (ignore === 'no-reason') {
    context.report(host, 'ignore-reason', '@throws-ignore needs a reason');
  }

  return ignore === true || fn.body === undefined;
};

const firstTagged = (context: Context, nodes: readonly ts.Node[]): readonly Thrown[] =>
  declaredOf(
    nodes.map((node) => context.semantics.jsDocThrowsOf(node)).find((tags) => tags.length > 0) ??
      [],
  ).map((entry) => entry.thrown);

const inheritedOf = (
  context: Context,
  fn: FunctionLike,
  member: Member | undefined,
): readonly Thrown[] => {
  if (ts.isConstructorDeclaration(fn)) {
    return firstTagged(context, context.semantics.baseConstructorsOf(fn.parent));
  }

  const contracts =
    member === undefined
      ? context.semantics.objectContractsOf(fn)
      : context.semantics.declarationsOf(member);

  return declaredOf(tagsOf(context, contracts)).map((entry) => entry.thrown);
};

const checkFunction = (context: Context, fn: FunctionLike): void => {
  if (isSkipped(context, fn)) {
    return;
  }

  const name = nameOf(fn);
  const escapes = escapesOfFunction(context, fn);
  const member = memberOf(fn);
  const direct = tagsOf(context, [fn, ...context.semantics.overloadsOf(fn)]);
  const own =
    member !== undefined && member !== fn && direct.length === 0
      ? tagsOf(context, [member])
      : direct;
  const inherited = own.length === 0 ? inheritedOf(context, fn, member) : [];

  compare(context, name, escapes, own, inherited);

  if (member !== undefined && own.length > 0) {
    checkContract(context, member, name, own);
  }
};

const checkImplicitConstructor = (context: Context, owner: ts.ClassLikeDeclaration): void => {
  if (ignoreOf(owner) === true) {
    return;
  }

  const escapes = [...context.walker.escapesOf(fieldInitializers(owner), false)];
  const heritage = owner.heritageClauses?.find(
    (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
  )?.types[0];

  if (heritage !== undefined) {
    const declarations = context.semantics.baseConstructorsOf(owner);
    const base = {
      name: 'super',
      declarations,
      keys: [],
      returnsPromise: false,
      parameters: [],
      variadic: false,
    };

    escapes.push(...context.walker.throwsOf(base, heritage));
  }

  const own = context.semantics.jsDocThrowsOf(owner);

  if (escapes.length > 0 || own.length > 0) {
    const inherited =
      own.length === 0 ? firstTagged(context, context.semantics.baseConstructorsOf(owner)) : [];

    compare(context, nameOf(owner), escapes, own, inherited);
  }
};

/**
 * Checks every body in a file.
 */
export const checkFile = (context: Context, file: ts.SourceFile): void => {
  const visit = (node: ts.Node): void => {
    if (isFunctionLike(node) && !isCallbackArgument(node)) {
      checkFunction(context, node);
    }

    if (
      ts.isClassLike(node) &&
      !node.members.some((member) => ts.isConstructorDeclaration(member))
    ) {
      checkImplicitConstructor(context, node);
    }

    ts.forEachChild(node, visit);
  };

  visit(file);
};
