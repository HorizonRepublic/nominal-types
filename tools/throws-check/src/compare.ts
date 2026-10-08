import type { Semantics, Thrown, ThrowsTag } from './compiler/semantics.ts';
import type { ts } from './compiler/ts.ts';
import type { Escape } from './walk/types.ts';

/**
 * The kind of a finding.
 */
export type DiagnosticCode =
  | 'undocumented'
  | 'unused'
  | 'contract'
  | 'malformed'
  | 'ignore-reason'
  | 'unresolved';

/**
 * Records a finding at a node.
 */
export type Report = (node: ts.Node, code: DiagnosticCode, message: string) => void;

/**
 * A documented type, with the tag that names it when the body itself carries it.
 */
export interface Declared {
  readonly thrown: Thrown;
  readonly tag: ThrowsTag | undefined;
}

/**
 * Spreads tags into the types they name.
 */
export const declaredOf = (tags: readonly ThrowsTag[]): readonly Declared[] =>
  tags.flatMap((tag) => tag.thrown.map((thrown) => ({ thrown, tag })));

const reportMalformed = (report: Report, name: string, tags: readonly ThrowsTag[]): void => {
  for (const tag of tags) {
    for (const unresolved of tag.unresolved) {
      const message =
        unresolved === ''
          ? `@throws on ${name} names no type`
          : `@throws on ${name} names ${unresolved}, which is not a type in scope`;

      report(tag.node, 'malformed', message);
    }
  }
};

const reportUndocumented = (report: Report, name: string, escape: Escape): void => {
  const type = escape.thrown.name;
  const source = escape.via === 'throw' ? '' : ` from ${escape.via}`;

  report(
    escape.site,
    'undocumented',
    `${name} can throw ${type}${source} without a @throws for it`,
  );
};

/**
 * The settings of the comparison.
 */
export interface Comparison {
  readonly semantics: Semantics;
  readonly report: Report;
  readonly allowUnusedSupertypes: boolean;
}

/**
 * Compares what leaves a body with what it documents: every escape needs a documented type
 * that covers it, and every documented type needs an escape it is the narrowest cover of.
 */
export const compare = (
  { semantics, report, allowUnusedSupertypes }: Comparison,
  name: string,
  escapes: readonly Escape[],
  own: readonly ThrowsTag[],
  inherited: readonly Thrown[],
): void => {
  reportMalformed(report, name, own);

  const declared = [...declaredOf(own), ...inherited.map((thrown) => ({ thrown, tag: undefined }))];
  const used = new Set<Declared>();

  for (const escape of escapes) {
    const covering = declared.filter((entry) =>
      semantics.isAssignable(escape.thrown, entry.thrown),
    );

    if (covering.length === 0) {
      reportUndocumented(report, name, escape);
    }

    for (const entry of covering) {
      const narrower = covering.some(
        (other) =>
          other !== entry &&
          semantics.isAssignable(other.thrown, entry.thrown) &&
          !semantics.isAssignable(entry.thrown, other.thrown),
      );

      if (allowUnusedSupertypes || !narrower) {
        used.add(entry);
      }
    }
  }

  for (const entry of declared) {
    if (entry.tag !== undefined && !used.has(entry)) {
      report(
        entry.tag.node,
        'unused',
        `${name} documents a @throws for ${entry.thrown.name}, which it never throws`,
      );
    }
  }
};
