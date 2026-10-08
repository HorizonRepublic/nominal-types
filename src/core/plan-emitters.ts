import type { Plan } from './json-leaves.ts';

// Kept apart from the stringifier, so an app that builds no record or tuple bundles none of their
// emitters; a plan of a kind with no emitter is written from its plain copy.

/**
 * A piece of JSON text a generated statement appends: literal text, or an expression.
 *
 * @internal
 */
export type Piece = string | { readonly code: string };

/**
 * What an emitter added by a schema module gets: the source being built and the helpers that write
 * statements, `emit` for the plans it holds.
 *
 * @internal
 */
export interface EmitTools {
  /**
   * A fresh name for a variable of the generated source.
   */
  readonly fresh: (prefix: string) => string;
  /**
   * The name the generated source reads `value` by.
   */
  readonly ref: (value: unknown) => string;
  /**
   * Statements that append `prefix` and the JSON text of a value of `plan`, or run `none` when
   * JSON leaves the value out.
   */
  readonly emit: (plan: Plan, expr: string, prefix: Piece, none: string) => string;
  /**
   * A statement that appends the pieces.
   */
  readonly append: (...pieces: readonly Piece[]) => string;
  /**
   * Statements that append `prefix` and the text a variable holds, or run `none` for none.
   */
  readonly appendText: (t: string, prefix: Piece, none: string) => string;
  /**
   * Whether every value of a type is a string JSON writes between quotes as it is.
   */
  readonly holdsSafeText: (type: object) => boolean;
}

/**
 * Writes the statements for a plan of a kind the schema modules add, such as a record or a tuple.
 *
 * @internal
 */
export type Emitter<Kind extends Plan['kind']> = (
  tools: EmitTools,
  plan: Extract<Plan, { readonly kind: Kind }>,
  expr: string,
  prefix: Piece,
  none: string,
) => string;

/**
 * The emitters added by the schema modules, by the kind of plan they write.
 *
 * @internal
 */
export const addedEmitters: Map<string, Emitter<Plan['kind']>> = new Map();

/**
 * Adds the emitter of a kind of plan, from the schema that makes such plans.
 *
 * @internal
 */
export const addEmitter = <Kind extends Plan['kind']>(kind: Kind, emitter: Emitter<Kind>): void => {
  const isOfKind = (plan: Plan): plan is Extract<Plan, { readonly kind: Kind }> =>
    plan.kind === kind;

  addedEmitters.set(kind, (tools, plan, expr, prefix, none) =>
    isOfKind(plan) ? emitter(tools, plan, expr, prefix, none) : none,
  );
};
