import type { AnyIssueCode, Messages, NominalIssue } from './issue-codes.ts';
import type { Logger } from './log.ts';
import type { Wording } from './messages.ts';
import type { NativeSchema } from './native-schema.ts';

type Path = NominalIssue['path'];

/**
 * What an issue is written from: its code, its English message with and without the value, and
 * the wording a messages function reads.
 *
 * @internal
 */
export interface Draft {
  /**
   * The code of the issue.
   */
  readonly code: AnyIssueCode;
  /**
   * Whether the issue carries its code without `codes`, as one a rule of your own gave does.
   */
  readonly own?: boolean;
  /**
   * The English message.
   */
  readonly english: string;
  /**
   * The English message with the value hidden.
   */
  readonly hiddenEnglish: string;
  /**
   * What a messages function reads besides the code and the English message.
   */
  readonly wording: Wording;
}

/**
 * Writes the issues of this package once `n.configure()` has set codes or a messages function;
 * the English messages need none of it.
 *
 * @internal
 */
export interface IssueWriter {
  /**
   * The issue a draft gives at a path.
   */
  readonly write: (draft: Draft, path: Path) => NominalIssue;
  /**
   * The issue a rule of this package reports for a rejected value.
   */
  readonly rule: (
    rule: NativeSchema<unknown>,
    value: unknown,
    describe: (value: unknown) => string,
    typeName: string | undefined,
  ) => NominalIssue;
  /**
   * The issue written again for a longer path; `undefined` when it keeps its message.
   */
  readonly atPath: (issue: NominalIssue, path: NonNullable<Path>) => NominalIssue | undefined;
  /**
   * The issue written again with its value hidden; `undefined` when it wasn't written here.
   */
  readonly hidden: (issue: NominalIssue) => NominalIssue | undefined;
}

/**
 * What `n.configure()` has set, read where it applies: in a message as it is written,
 * when code is generated, and in the check of a string type.
 *
 * @remarks
 * One object for the whole process, kept on `globalThis` under a `Symbol.for` key, so the ES module
 * and CommonJS copies of the package read the same settings. It is changed in place and never
 * replaced, so generated code can hold it, and its fields keep one shape.
 *
 * @internal
 */
export interface Settings {
  /**
   * The messages in place of the English ones, or `undefined` for the English messages.
   */
  messages: Messages | undefined;
  /**
   * How messages show the rejected value.
   */
  values: 'show' | 'length' | 'hide';
  /**
   * Whether `console.log` and `util.inspect` show the values of instances.
   */
  inspect: 'show' | 'hide';
  /**
   * Whether strings are trimmed before the check.
   */
  trimStrings: boolean;
  /**
   * Whether every issue carries its `code`.
   */
  codes: boolean;
  /**
   * Whether checks may be built with generated code.
   */
  codegen: 'auto' | 'off';
  /**
   * The most issues one check reports before it stops. A copy of the package from before the
   * option leaves it out, which reads as the default.
   */
  maxIssues?: number;
  /**
   * Where warnings go: a logger, `false` for nowhere, or `undefined` for `console.warn`. A copy of
   * the package from before the option leaves it out, which reads as `undefined`.
   */
  logger: Logger | false | undefined;
  /**
   * Set once the fallback from generated code was reported, so each process reports it once. It
   * is left out until then: generated code, which needs the fields to keep one shape, never runs
   * where it gets set.
   */
  codegenWarned?: true;
  /**
   * Writes issues once codes or messages were set, put here by `n.configure()` so the code stays
   * out of a bundle that never calls it; `undefined` until then.
   */
  writer: IssueWriter | undefined;
}

const key = Symbol.for('@horizon-republic/nominal-types/settings/1');

/**
 * How many issues one check reports before it stops, unless `n.configure()` says otherwise.
 *
 * @internal
 */
export const defaultMaxIssues = 100;

const created = (): Settings => {
  const fresh: Settings = {
    messages: undefined,
    values: 'show',
    inspect: 'show',
    trimStrings: false,
    codes: false,
    codegen: 'auto',
    maxIssues: defaultMaxIssues,
    logger: undefined,
    writer: undefined,
  };

  Reflect.set(globalThis, key, fresh);

  return fresh;
};

const isSettings = (value: unknown): value is Settings =>
  typeof value === 'object' && value !== null && 'writer' in value;

const existing: unknown = Reflect.get(globalThis, key);

/**
 * The settings in force, created by the first copy of the package that loads.
 *
 * @internal
 */
export const settings: Settings = isSettings(existing) ? existing : created();
