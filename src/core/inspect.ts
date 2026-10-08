import { charactersOf } from './hidden-values.ts';
import { sensitiveSlot } from './hierarchy.ts';

// Node.js and Bun both read the form `console.log` and `util.inspect` show from this key.
const inspectKey = Symbol.for('nodejs.util.inspect.custom');

interface InspectOptions {
  readonly depth?: number | null | undefined;
  readonly stylize?: (text: string, style: string) => string;
}

type Inspect = (value: unknown, options: InspectOptions) => string;

const isInspect = (value: unknown): value is Inspect => typeof value === 'function';

const outlineOf = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.length === 0 ? 'an empty string' : charactersOf(value.length);
  }

  if (Array.isArray(value)) {
    return 'an array';
  }

  if (typeof value === 'object') {
    return value === null ? 'null' : 'an object';
  }

  return `a ${typeof value}`;
};

const valueText = (value: unknown, options: InspectOptions, inspect: unknown): string => {
  const depth = typeof options.depth === 'number' ? options.depth - 1 : options.depth;

  return isInspect(inspect) ? inspect(value, { ...options, depth }) : String(value);
};

const inspectInstance = function inspectInstance(
  this: { readonly value: unknown; readonly constructor: unknown },
  depth: number,
  options: InspectOptions,
  inspect: unknown,
): string {
  const type: unknown = this.constructor;
  const name = typeof type === 'function' ? type.name : 'Nominal';
  const stylize = options.stylize ?? ((text: string): string => text);

  if (depth < 0) {
    return stylize(`[${name}]`, 'special');
  }

  const text =
    typeof type === 'function' && Reflect.get(type, sensitiveSlot) === true
      ? stylize(`<hidden, ${outlineOf(this.value)}>`, 'special')
      : valueText(this.value, options, inspect);

  return text.includes('\n')
    ? `${name} {\n  value: ${text.replaceAll('\n', '\n  ')}\n}`
    : `${name} { value: ${text} }`;
};

/**
 * Internal: gives instances the form `console.log` shows in Node.js and Bun,
 * `Uuid { value: '0190f1c2-…' }`, with the value of a sensitive type left out:
 * `Email { value: <hidden, a string of 16 characters> }`.
 */
export const defineInspect = (prototype: object): void => {
  Object.defineProperty(prototype, inspectKey, {
    value: inspectInstance,
    writable: true,
    configurable: true,
  });
};
