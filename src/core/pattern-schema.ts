import type { NominalSchema } from './contracts.ts';
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
 */
export class PatternSchema extends NativeSchema<string> {
  public readonly pattern: RegExp;
  public readonly description: string | undefined;
  public readonly accepts: (value: unknown) => value is string;
  readonly #json: Readonly<Record<string, unknown>>;

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

  public messageFor(value: unknown): string {
    if (typeof value !== 'string') {
      return mustBe('a string', value);
    }

    return mustBe(this.description ?? `matched by ${this.pattern.source}`, value);
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
 * @example
 * ```ts
 * export class Sku extends Nominal('Sku', n.matching(/^SKU-\d{4}$/u, 'a SKU')) {}
 * ```
 */
export const matching = (
  pattern: RegExp,
  description?: string,
  json?: Readonly<Record<string, unknown>>,
): PatternSchema => new PatternSchema(pattern, description, json);

/**
 * Internal: a rule as `Nominal()`, `subtype()` and `variant()` take it, with a bare pattern turned
 * into a `PatternSchema`.
 */
export const asRule = (rule: NominalSchema | RegExp): NominalSchema =>
  rule instanceof RegExp ? new PatternSchema(rule) : rule;
