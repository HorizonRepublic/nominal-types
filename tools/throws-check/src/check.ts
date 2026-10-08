import path from 'node:path';

import { checkFile } from './bodies.ts';
import { defaultBuiltins, defaultSyncCallbacks } from './builtins.ts';
import type { DiagnosticCode, Report } from './compare.ts';
import { openProject } from './compiler/project.ts';
import { Walker } from './walk/walker.ts';

/**
 * The options of {@link check}.
 */
export interface CheckOptions {
  /**
   * Path to the `tsconfig.json` of the project.
   */
  readonly project: string;
  /**
   * Globs, relative to the folder of the tsconfig, of the files to report on.
   *
   * @defaultValue every file of the project
   */
  readonly include?: string | readonly string[];
  /**
   * Extra or replaced entries of the builtin table; an empty list removes an entry.
   *
   * @defaultValue no change to the table
   */
  readonly builtins?: Readonly<Record<string, readonly string[]>>;
  /**
   * Extra callers known to call their function arguments synchronously.
   *
   * @defaultValue no extra callers
   */
  readonly syncCallbacks?: readonly string[];
  /**
   * Counts a documented type as thrown when a narrower documented type covers the throw.
   *
   * @defaultValue `false`
   */
  readonly allowUnusedSupertypes?: boolean;
  /**
   * Reports calls, throws and callbacks the checker cannot follow.
   *
   * @defaultValue `false`
   */
  readonly reportUnresolved?: boolean;
}

/**
 * One finding, at a 1-based line and column.
 */
export interface Diagnostic {
  /**
   * The absolute path of the file.
   */
  readonly file: string;
  /**
   * The line of the finding, from 1.
   */
  readonly line: number;
  /**
   * The column of the finding, from 1.
   */
  readonly column: number;
  /**
   * The kind of the finding.
   */
  readonly code: DiagnosticCode;
  /**
   * The finding in words, naming the function and the type.
   */
  readonly message: string;
}

const asList = (value: string | readonly string[] | undefined): readonly string[] =>
  typeof value === 'string' ? [value] : (value ?? []);

const byPosition = (left: Diagnostic, right: Diagnostic): number =>
  left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column;

const collector = (): { readonly diagnostics: Diagnostic[]; readonly report: Report } => {
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();

  const report: Report = (node, code, message) => {
    const file = node.getSourceFile();
    const start = node.getStart(file);
    const key = `${file.fileName}:${start}:${code}:${message}`;

    if (!seen.has(key)) {
      seen.add(key);

      const { line, character } = file.getLineAndCharacterOfPosition(start);

      diagnostics.push({
        file: file.fileName,
        line: line + 1,
        column: character + 1,
        code,
        message,
      });
    }
  };

  return { diagnostics, report };
};

/**
 * Checks that every function documents with `@throws` what can leave it, and nothing more.
 *
 * @example
 * ```ts
 * import { check } from 'throws-check';
 *
 * for (const { file, line, column, message } of check({ project: 'tsconfig.json' })) {
 *   console.log(`${file}:${line}:${column} ${message}`);
 * }
 * ```
 *
 * @param options - The project to check and how.
 * @returns The findings, sorted by file and position.
 * @throws {@link Error} when the tsconfig cannot be read.
 */
export const check = (options: CheckOptions): readonly Diagnostic[] => {
  const project = path.resolve(options.project);
  const root = path.dirname(project);
  const semantics = openProject(project);
  const include = asList(options.include);
  const { diagnostics, report } = collector();
  const walker = new Walker(
    semantics,
    {
      builtins: Object.entries({ ...defaultBuiltins, ...options.builtins }).filter(
        ([, names]) => names.length > 0,
      ),
      syncCallbacks: [...defaultSyncCallbacks, ...(options.syncCallbacks ?? [])],
      reportUnresolved: options.reportUnresolved ?? false,
    },
    (note) => {
      report(note.node, note.code, note.message);
    },
  );
  const context = {
    semantics,
    report,
    walker,
    allowUnusedSupertypes: options.allowUnusedSupertypes ?? false,
  };

  for (const file of semantics.files) {
    const relative = path.relative(root, file.fileName);

    if (include.length === 0 || include.some((pattern) => path.matchesGlob(relative, pattern))) {
      checkFile(context, file);
    }
  }

  return diagnostics.toSorted(byPosition);
};
