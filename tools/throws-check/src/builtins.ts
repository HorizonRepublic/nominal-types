import type { Semantics, ValueKind } from './compiler/semantics.ts';
import type { ts } from './compiler/ts.ts';

const temporal = ['RangeError', 'TypeError'];

/**
 * What the standard library throws, keyed by the call that throws it.
 *
 * @remarks
 * A key is a global path (`JSON.parse`), a constructor (`new URL`) or an instance method
 * (`String.prototype.normalize`). A `*` stands for one segment of the path.
 */
export const defaultBuiltins: Readonly<Record<string, readonly string[]>> = {
  'JSON.parse': ['SyntaxError'],
  BigInt: ['SyntaxError', 'RangeError', 'TypeError'],
  'new URL': ['TypeError'],
  RegExp: ['SyntaxError'],
  'new RegExp': ['SyntaxError'],
  Function: ['SyntaxError'],
  'new Function': ['SyntaxError'],
  structuredClone: ['DOMException'],
  atob: ['DOMException'],
  btoa: ['DOMException'],
  decodeURI: ['URIError'],
  decodeURIComponent: ['URIError'],
  encodeURI: ['URIError'],
  encodeURIComponent: ['URIError'],
  'String.fromCodePoint': ['RangeError'],
  'String.prototype.normalize': ['RangeError'],
  'String.prototype.repeat': ['RangeError'],
  'Number.prototype.toFixed': ['RangeError'],
  'Number.prototype.toPrecision': ['RangeError'],
  'Number.prototype.toExponential': ['RangeError'],
  'BigInt.asIntN': ['RangeError'],
  'BigInt.asUintN': ['RangeError'],
  'new Intl.*': ['RangeError'],
  'Temporal.*.from': temporal,
  'Temporal.*.compare': temporal,
  'new Temporal.*': temporal,
};

/**
 * Callers known to run a function argument before they return, so its throws reach the
 * caller's caller.
 */
export const defaultSyncCallbacks: readonly string[] = [
  'Array.from',
  'Array.prototype.every',
  'Array.prototype.filter',
  'Array.prototype.find',
  'Array.prototype.findIndex',
  'Array.prototype.findLast',
  'Array.prototype.findLastIndex',
  'Array.prototype.flatMap',
  'Array.prototype.forEach',
  'Array.prototype.map',
  'Array.prototype.reduce',
  'Array.prototype.reduceRight',
  'Array.prototype.some',
  'Array.prototype.sort',
  'Array.prototype.toSorted',
  'Map.prototype.forEach',
  'Set.prototype.forEach',
  'Map.groupBy',
  'Object.groupBy',
  'String.prototype.replace',
  'String.prototype.replaceAll',
  'JSON.parse',
  'JSON.stringify',
];

/**
 * Tells whether a key from a call matches a key or pattern from a table.
 *
 * @remarks
 * Both sides split on dots; `*` in the pattern matches exactly one segment.
 *
 * @param pattern - A key or pattern from a table, such as `Temporal.*.from`.
 * @param key - The key of a call, such as `Temporal.PlainDate.from`.
 * @returns Whether the key matches.
 */
export const matchesKey = (pattern: string, key: string): boolean => {
  if (!pattern.includes('*')) {
    return pattern === key;
  }

  const wanted = pattern.split('.');
  const actual = key.split('.');

  return (
    wanted.length === actual.length &&
    wanted.every((segment, index) => segment === '*' || segment === actual[index])
  );
};

/**
 * Narrows what a standard call throws from the types of its arguments.
 */
export type ArgumentGuard = (
  semantics: Semantics,
  parameters: readonly ts.Expression[],
) => ReadonlySet<string>;

const bigIntErrors: Readonly<Record<ValueKind, readonly string[]>> = {
  string: ['SyntaxError'],
  number: ['RangeError'],
  integer: [],
  bigint: [],
  boolean: [],
  nullish: ['TypeError'],
  symbol: ['TypeError'],
  object: ['SyntaxError', 'RangeError', 'TypeError'],
  open: ['SyntaxError', 'RangeError', 'TypeError'],
};

const normalForms = new Set<string | number>(['NFC', 'NFD', 'NFKC', 'NFKD']);

const withinRange =
  (low: number, high: number): ArgumentGuard =>
  (semantics, [value]) => {
    const values = value === undefined ? [] : semantics.literalValuesOf(value);
    const safe = values?.every(
      (item) => typeof item === 'number' && Number.isInteger(item) && item >= low && item <= high,
    );

    return new Set(safe === true ? [] : ['RangeError']);
  };

/**
 * Calls whose throws depend on their arguments: `JSON.stringify` throws only for a value that
 * may hold a bigint or is not known, `BigInt()` only for what it cannot convert, and the
 * string and number methods only for arguments other than the literals they take.
 */
export const argumentGuards: Readonly<Record<string, ArgumentGuard>> = {
  'JSON.stringify': (semantics, [value]) =>
    new Set(value === undefined || !semantics.mayFailJson(value) ? [] : ['TypeError']),
  BigInt: (semantics, [value]) =>
    new Set(
      value === undefined
        ? ['TypeError']
        : [...semantics.valueKindsOf(value)].flatMap((kind) => bigIntErrors[kind]),
    ),
  'String.prototype.normalize': (semantics, [form]) => {
    const values = form === undefined ? [] : semantics.literalValuesOf(form);

    return new Set(values?.every((item) => normalForms.has(item)) === true ? [] : ['RangeError']);
  },
  'String.prototype.repeat': withinRange(0, Number.MAX_SAFE_INTEGER),
  'Number.prototype.toFixed': withinRange(0, 100),
  'Number.prototype.toExponential': withinRange(0, 100),
  'Number.prototype.toPrecision': withinRange(1, 100),
};
