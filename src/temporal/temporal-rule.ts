import type { NominalSchema } from '../core/contracts.ts';
import { forTarget } from '../core/json-target.ts';
import { mustBe } from '../core/messages.ts';
import { Rejection } from '../core/rejection.ts';
import { runnableSchema } from '../core/runner.ts';

/**
 * Internal: the `Temporal` namespace the runtime provides, natively or through a polyfill.
 */
export type TemporalApi = typeof Temporal;

/**
 * Internal: the `Temporal` namespace of the runtime, read when a value is built rather than when
 * the module loads, so a polyfill installed after the import still counts.
 *
 * @throws TypeError naming the type and the polyfill to load when the runtime has no Temporal.
 */
export const temporalFor = (typeName: string): TemporalApi => {
  if (!('Temporal' in globalThis)) {
    throw new TypeError(
      `${typeName} needs Temporal, which this runtime lacks: import 'temporal-polyfill/global' before the first value is built`,
    );
  }

  return globalThis.Temporal;
};

/**
 * Internal: what tells one Temporal type from another for `temporalRule()`.
 */
export interface TemporalKind<Value extends object> {
  /** The name of the nominal type, for the error thrown when Temporal is missing. */
  readonly typeName: string;
  /** The `Symbol.toStringTag` of the Temporal class, such as `Temporal.Instant`. */
  readonly tag: string;
  /** The whole text the type accepts. */
  readonly pattern: RegExp;
  /** What the value must be, completing "must be …". */
  readonly description: string;
  /** JSON Schema keywords beside `type`, `pattern` and `description`. */
  readonly json: Readonly<Record<string, unknown>>;
  /** Whether a value of the runtime's own Temporal class is one the type accepts. */
  readonly accepts: (temporal: TemporalApi, value: object) => value is Value;
  /** The value of text the pattern matched, or `undefined` for text it matches but the type refuses. */
  readonly build: (temporal: TemporalApi, text: string) => Value | undefined;
}

const textOf = (value: object): string => {
  const toText: unknown = Reflect.get(value, 'toString');
  const text: unknown = typeof toText === 'function' ? Reflect.apply(toText, value, []) : undefined;

  return typeof text === 'string' ? text : '';
};

/**
 * Internal: the rule of a Temporal type: strict text, checked before Temporal is asked to build
 * it, or a Temporal object of the same kind.
 *
 * @remarks
 * Temporal's own parser takes far more than RFC 3339 and turns a leap second into `:59`, so text
 * is held to the pattern, which is also the JSON Schema `pattern`. An object from another Temporal
 * implementation is recognised by its tag and read through its text.
 */
export const temporalRule = <Value extends object>(
  kind: TemporalKind<Value>,
): NominalSchema<string | Value, Value> => {
  const { pattern, description, tag } = kind;
  const objectTag = `[object ${tag}]`;
  const rejected = (value: unknown): Rejection =>
    new Rejection([{ message: mustBe(description, value) }]);
  const fromText = (text: string, input: unknown, temporal?: TemporalApi): Value | Rejection =>
    (pattern.test(text) ? kind.build(temporal ?? temporalFor(kind.typeName), text) : undefined) ??
    rejected(input);

  const run = (input: unknown): Value | Rejection => {
    if (typeof input === 'string') {
      return fromText(input, input);
    }

    if (
      typeof input !== 'object' ||
      input === null ||
      Object.prototype.toString.call(input) !== objectTag
    ) {
      return rejected(input);
    }

    const temporal = temporalFor(kind.typeName);

    if (kind.accepts(temporal, input)) {
      return input;
    }

    return fromText(textOf(input), input, temporal);
  };

  const json = { type: 'string', ...kind.json, pattern: pattern.source, description };

  return runnableSchema<string | Value, Value>(run, (_side, options) => forTarget(options, json));
};

/**
 * Internal: the error a Temporal type throws where JavaScript asks it for a number, as `<` does.
 */
export const noPrimitive = (instance: object, temporalName: string): TypeError =>
  new TypeError(
    `${String(Reflect.get(instance.constructor, 'typeName'))} holds a ${temporalName} and has no primitive value; compare with ${temporalName}.compare(a.value, b.value)`,
  );
