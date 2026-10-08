import type { NominalSchema } from './contracts.ts';
import type { IssueCode } from './issue-codes.ts';
import { mustBe } from './messages.ts';
import { NativeSchema } from './native-schema.ts';

/**
 * A Standard Schema that accepts the strings a regular expression matches.
 *
 * @remarks
 * Nominal types recognise it and test the pattern directly, without going through `validate`, so
 * a type declared from a pattern costs about as much as the pattern itself. Only the `u` flag is
 * allowed: `g` and `y` make a pattern stateful, and JSON Schema patterns carry no flags, so the
 * generated schema could not keep the meaning of `i`, `m`, `s` or `v`.
 *
 * @example
 * ```ts
 * import { n } from '@horizon-republic/nominal-types';
 *
 * const sku = n.matching(/^SKU-\d{4}$/u, 'a SKU');
 *
 * sku.accepts('SKU-0042'); // true
 * sku.pattern.source; // '^SKU-\\d{4}$'
 * ```
 */
export class PatternSchema extends NativeSchema<string> {
  /**
   * The regular expression a string must match.
   */
  public readonly pattern: RegExp;
  /**
   * What a matching string is, completing "must be …" in messages, or `undefined` to quote the
   * pattern.
   */
  public readonly description: string | undefined;
  /**
   * Whether the value is a string the pattern matches; a plain function, so it can be called on
   * its own.
   */
  public readonly accepts: (value: unknown) => value is string;
  readonly #json: Readonly<Record<string, unknown>>;

  /**
   * Builds the schema; `n.matching()` does the same and reads better in a chain.
   *
   * @param pattern - The regular expression, with no flag or the `u` flag only.
   * @param description - What a matching string is, completing "must be …" in messages.
   * @param json - Keywords added to the JSON Schema, such as a `format`.
   * @throws {@link TypeError} when the pattern has a flag other than `u`.
   */
  public constructor(
    pattern: RegExp,
    description?: string,
    json: Readonly<Record<string, unknown>> = {},
  ) {
    super();

    if (pattern.flags !== '' && pattern.flags !== 'u') {
      throw new TypeError(
        `${String(pattern)}: only the u flag is supported, since JSON Schema patterns carry no flags`,
      );
    }

    this.pattern = pattern;
    this.description = description;
    this.accepts = (value): value is string => typeof value === 'string' && pattern.test(value);
    this.#json = json;
  }

  public messageFor(value: unknown, describe?: (value: unknown) => string): string {
    return mustBe(this.descriptionFor(value), value, describe);
  }

  public override codeFor(value: unknown): IssueCode {
    return typeof value === 'string' ? 'pattern' : 'not_a_string';
  }

  public descriptionFor(value: unknown): string {
    if (typeof value !== 'string') {
      return 'a string';
    }

    return this.description ?? `matched by ${this.pattern.source}`;
  }

  protected jsonBody(): Record<string, unknown> {
    return {
      type: 'string',
      pattern: this.pattern.source,
      ...this.#json,
      ...(this.description === undefined ? {} : { description: this.description }),
    };
  }
}

/**
 * Builds a schema from a regular expression, for declaring a type or overriding its rules.
 *
 * @remarks
 * The description completes the sentence "must be …" in error messages; without one, the message
 * quotes the pattern. `json` adds keywords to the JSON Schema, such as a `format`, length limits
 * that the pattern already implies, or `examples`.
 *
 * @param pattern - The regular expression, with no flag or the `u` flag only.
 * @param description - What a matching string is, completing "must be …" in messages.
 * @param json - Keywords added to the JSON Schema, such as a `format` or `examples`.
 * @returns The schema of the strings the pattern matches.
 * @throws {@link TypeError} when the pattern has a flag other than `u`.
 *
 * @example
 * ```ts
 * import { n, Nominal } from '@horizon-republic/nominal-types';
 *
 * export class Sku extends Nominal('Sku', n.matching(/^SKU-\d{4}$/u, 'a SKU')) {}
 * ```
 */
export const matching = (
  pattern: RegExp,
  description?: string,
  json?: Readonly<Record<string, unknown>>,
): PatternSchema => new PatternSchema(pattern, description, json);

/**
 * A rule as `Nominal()`, `subtype()` and `variant()` take it, with a bare pattern turned
 * into a `PatternSchema`.
 *
 * @throws {@link TypeError} when the pattern has a flag other than `u`.
 *
 * @internal
 */
export const asRule = (rule: NominalSchema | RegExp): NominalSchema =>
  rule instanceof RegExp ? new PatternSchema(rule) : rule;
