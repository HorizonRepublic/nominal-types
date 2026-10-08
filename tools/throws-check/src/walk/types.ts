import type { Thrown } from '../compiler/semantics.ts';
import type { ts } from '../compiler/ts.ts';

/**
 * A type that leaves a body, with the node that let it out.
 */
export interface Escape {
  readonly thrown: Thrown;
  readonly site: ts.Node;
  readonly via: string;
}

/**
 * A finding the walk makes on its way, apart from the comparison with the tags.
 */
export interface Note {
  readonly node: ts.Node;
  readonly code: 'ignore-reason' | 'unresolved';
  readonly message: string;
}

/**
 * What the walk reads from the options.
 */
export interface WalkOptions {
  readonly builtins: ReadonlyArray<readonly [string, readonly string[]]>;
  readonly syncCallbacks: readonly string[];
  readonly reportUnresolved: boolean;
}

/**
 * A `catch` clause the walk is inside, with what its `try` block let out.
 */
export interface CatchFrame {
  readonly variable: ts.Identifier;
  readonly escapes: readonly Escape[];
  readonly clause: ts.CatchClause;
}

/**
 * What the walk knows about the place it is at.
 */
export interface Scope {
  readonly frames: readonly CatchFrame[];
  readonly rejectors: readonly ts.Identifier[];
  readonly returnsPromise: boolean;
}
