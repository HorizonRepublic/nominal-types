import {
  resolveAccessor,
  resolveCallee,
  resolveFunctionReference,
  returnsPromise,
} from './callees.ts';
import {
  baseConstructorsOf,
  declarationsOf,
  objectContractsOf,
  overloadsOf,
  sameSymbol,
} from './classes.ts';
import type { Semantics } from './semantics.ts';
import {
  createTagReader,
  jsDocRethrowsOf,
  jsDocThrowsOf,
  thrownByName,
  thrownOfComment,
} from './tags.ts';
import { ts } from './ts.ts';
import { instanceTypeOf, isAssignable, typeOfThrown } from './types.ts';
import { literalValuesOf, mayFailJson, valueKindsOf } from './values.ts';

const programOf = (project: string): ts.Program => {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    project,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );

  if (parsed === undefined) {
    throw new Error(`cannot read ${project}`);
  }

  return ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noEmit: true },
    ...(parsed.projectReferences === undefined
      ? {}
      : { projectReferences: parsed.projectReferences }),
  });
};

/**
 * Opens a project and answers the analysis' questions with the TypeScript 6 checker.
 *
 * @throws {@link Error} when the tsconfig cannot be read.
 */
export const openProject = (project: string): Semantics => {
  const program = programOf(project);
  const checker = program.getTypeChecker();
  const files = program
    .getSourceFiles()
    .filter((file) => !file.isDeclarationFile && !program.isSourceFileFromExternalLibrary(file));
  const reader = createTagReader(checker, files);

  return {
    files,
    resolveCallee: (node) => resolveCallee(checker, node),
    resolveAccessor: (node, write) => resolveAccessor(checker, node, write),
    resolveFunctionReference: (node) => resolveFunctionReference(checker, node),
    jsDocThrowsOf: (declaration) => jsDocThrowsOf(reader, declaration),
    jsDocRethrowsOf,
    typeOfThrown: (expression) => typeOfThrown(checker, expression),
    instanceTypeOf: (constructor) => instanceTypeOf(checker, constructor),
    thrownByName: (name, location) => thrownByName(reader, name, location),
    thrownOfComment: (text, location) => thrownOfComment(reader, text, location),
    isAssignable: (thrown, declared) => isAssignable(checker, thrown, declared),
    sameSymbol: (left, right) => sameSymbol(checker, left, right),
    declarationsOf: (member) => declarationsOf(checker, member),
    objectContractsOf: (fn) => objectContractsOf(checker, fn),
    baseConstructorsOf: (node) => baseConstructorsOf(checker, node),
    overloadsOf: (node) => overloadsOf(checker, node),
    returnsPromise: (node) => returnsPromise(checker, node),
    valueKindsOf: (expression) => valueKindsOf(checker, expression),
    mayFailJson: (expression) => mayFailJson(checker, expression),
    literalValuesOf: (expression) => literalValuesOf(checker, expression),
  };
};
