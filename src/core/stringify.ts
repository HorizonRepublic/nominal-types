import { generateFunction } from './compile.ts';
import { json, leafOf, number, text } from './json-leaves.ts';
import type { Instances, Plan, PlanField, Stringify } from './json-leaves.ts';

// A piece of JSON text a generated statement appends: literal text, or an expression.
type Piece = string | { readonly code: string };

const append = (...pieces: readonly Piece[]): string => {
  const parts: string[] = [];
  let literal = '';

  for (const piece of pieces) {
    if (typeof piece === 'string') {
      literal += piece;
    } else {
      if (literal !== '') {
        parts.push(JSON.stringify(literal));
      }

      literal = '';
      parts.push(piece.code);
    }
  }

  if (literal !== '') {
    parts.push(JSON.stringify(literal));
  }

  return parts.length === 0 ? '' : `s += ${parts.join(' + ')};`;
};

class Source {
  public readonly names: string[] = ['text', 'number', 'json', 'checked', 'other'];
  public readonly values: unknown[];
  public readonly instances: Instances;
  public readonly fallback: 'other' | 'json';
  readonly #refs = new Map<unknown, string>();
  #count = 0;

  public constructor(instances: Instances, other: Stringify, fallback: 'other' | 'json') {
    this.instances = instances;
    this.fallback = fallback;
    this.values = [text, number, json, instances.checked, other];
  }

  public fresh(prefix: string): string {
    this.#count += 1;

    return `${prefix}${String(this.#count)}`;
  }

  public ref(value: unknown): string {
    let name = this.#refs.get(value);

    if (name === undefined) {
      name = this.fresh('r');
      this.#refs.set(value, name);
      this.names.push(name);
      this.values.push(value);
    }

    return name;
  }
}

// Statements that append `prefix` and the JSON text of the value `x` holds, or run `none` when
// JSON leaves the value out.
const appendText = (t: string, prefix: Piece, none: string): string =>
  `if (${t} === undefined) { ${none} } else { ${append(prefix, { code: t })} }`;

const fastText = (leaf: 'value' | 'bigint', x: string, c: string): string =>
  leaf === 'value'
    ? `typeof ${c} === 'string' ? text(${c}) : typeof ${c} === 'number' ? number(${c}) : typeof ${c} === 'boolean' ? (${c} ? 'true' : 'false') : json(${x})`
    : `typeof ${c} === 'bigint' ? '"' + ${c} + '"' : json(${x})`;

// Each emitter returns statements that append `prefix` and the value's JSON text to `s`.
const emitType = (
  source: Source,
  type: object,
  expr: string,
  prefix: Piece,
  none: string,
): string => {
  const leaf = leafOf(type, source.instances);
  const x = source.fresh('x');
  const t = source.fresh('t');
  const head = `const ${x} = ${expr};`;

  if (leaf === 'json') {
    return `${head} const ${t} = json(${x}); ${appendText(t, prefix, none)}`;
  }

  const c = source.fresh('c');
  const T = source.ref(type);
  const trusted = `${x} !== null && typeof ${x} === 'object' && ${x}.constructor === ${T} && (${c} = checked(${x})) === ${x}.value`;
  const slow = `const ${t} = ${source.fallback}(${x}); ${appendText(t, prefix, none)}`;

  if (leaf === 'safe') {
    return `${head} let ${c}; if (${trusted} && typeof ${c} === 'string') { ${append(prefix, '"', { code: c }, '"')} } else { ${slow} }`;
  }

  if (typeof leaf === 'object') {
    return `${head} let ${c}; if (${trusted} && typeof ${c} === 'object' && ${c} !== null) { ${emit(source, leaf, c, prefix, none)} } else { ${slow} }`;
  }

  return `${head} let ${c}; const ${t} = ${trusted} ? ${fastText(leaf, x, c)} : ${source.fallback}(${x}); ${appendText(t, prefix, none)}`;
};

const emitArray = (
  source: Source,
  item: Plan,
  expr: string,
  prefix: Piece,
  none: string,
): string => {
  const a = source.fresh('a');
  const t = source.fresh('t');
  const count = source.fresh('n');
  const index = source.fresh('i');

  return `const ${a} = ${expr}; if (!Array.isArray(${a})) { const ${t} = json(${a}); ${appendText(t, prefix, none)} } else { ${append(prefix, '[')} const ${count} = ${a}.length; for (let ${index} = 0; ${index} < ${count}; ${index}++) { if (${index} !== 0) s += ','; ${emit(source, item, `${a}[${index}]`, '', "s += 'null';")} } s += ']'; }`;
};

const fieldPlan = ({ optional, plan }: PlanField): Plan =>
  optional && plan.kind === 'empty' && plan.empty === undefined ? plan.item : plan;

const emitObject = (
  source: Source,
  plan: Extract<Plan, { kind: 'object' }>,
  expr: string,
  prefix: Piece,
  none: string,
): string => {
  const o = source.fresh('o');
  const t = source.fresh('t');
  const before = source.fresh('b');
  const label = source.fresh('L');
  const write = source.ref(plan.write);
  const wrote = source.fresh('w');
  const firstRequired = plan.fields.findIndex(({ optional }) => !optional);
  // A field whose value JSON leaves out, or a required one missing, makes the object fall back to
  // its plain copy, written from the start of the object.
  const fallBack = `s = ${before}; ${append(prefix, { code: `JSON.stringify(${write}(${o}))` })} break ${label};`;
  const fields = plan.fields.map((field, index) => {
    const f = source.fresh('f');
    const key = JSON.stringify(field.key);
    const separator: Piece =
      index > firstRequired && firstRequired !== -1
        ? `,${key}:`
        : index === 0
          ? `${key}:`
          : { code: `(${wrote} ? ${JSON.stringify(`,${key}:`)} : ${JSON.stringify(`${key}:`)})` };
    const read = `const ${f} = ${o}[${key}];`;
    const body = emit(source, fieldPlan(field), f, separator, fallBack);

    if (!field.optional) {
      return `${read} if (${f} === undefined) { ${fallBack} } ${body}`;
    }

    const mark = index < firstRequired || firstRequired === -1 ? `${wrote} = true;` : '';

    return `${read} if (${f} !== undefined) { ${body} ${mark} }`;
  });

  return `const ${o} = ${expr}; if (typeof ${o} !== 'object' || ${o} === null || Array.isArray(${o})) { const ${t} = JSON.stringify(${write}(${o})); ${appendText(t, prefix, none)} } else ${label}: { const ${before} = s; let ${wrote} = false; ${append(prefix, '{')} ${fields.join(' ')} s += '}'; }`;
};

// The tag picks the variant, which writes the whole object, tag first; an object with another tag
// is written from its plain copy.
const emitUnion = (
  source: Source,
  plan: Extract<Plan, { kind: 'union' }>,
  expr: string,
  prefix: Piece,
  none: string,
): string => {
  const u = source.fresh('u');
  const t = source.fresh('t');
  const slow = `const ${t} = JSON.stringify(${source.ref(plan.write)}(${u})); ${appendText(t, prefix, none)}`;
  const cases = plan.variants.map(
    ({ tag, plan: variant }) =>
      `case ${JSON.stringify(tag)}: { ${emit(source, variant, u, prefix, none)} break; }`,
  );

  return `const ${u} = ${expr}; if (typeof ${u} !== 'object' || ${u} === null || Array.isArray(${u})) { ${slow} } else switch (${u}[${JSON.stringify(plan.key)}]) { ${cases.join(' ')} default: { ${slow} } }`;
};

const emit = (source: Source, plan: Plan, expr: string, prefix: Piece, none: string): string => {
  if (plan.kind === 'union') {
    return emitUnion(source, plan, expr, prefix, none);
  }

  if (plan.kind === 'tag') {
    const t = source.fresh('t');

    return `const ${t} = ${expr} === ${JSON.stringify(plan.tag)} ? ${JSON.stringify(JSON.stringify(plan.tag))} : json(${expr}); ${appendText(t, prefix, none)}`;
  }

  if (plan.kind === 'type') {
    return emitType(source, plan.type, expr, prefix, none);
  }

  if (plan.kind === 'array') {
    return emitArray(source, plan.item, expr, prefix, none);
  }

  if (plan.kind === 'object') {
    return emitObject(source, plan, expr, prefix, none);
  }

  const e = source.fresh('e');

  if (plan.kind === 'empty') {
    const empty = plan.empty === null ? append(prefix, 'null') : none;

    return `const ${e} = ${expr}; if (${e} === ${String(plan.empty)}) { ${empty} } else { ${emit(source, plan.item, e, prefix, none)} }`;
  }

  return `const ${e} = JSON.stringify(${source.ref(plan.write)}(${expr})); ${appendText(e, prefix, none)}`;
};

const generated = (
  plan: Plan,
  instances: Instances,
  fallback: 'other' | 'json',
  generate?: boolean,
): Stringify | undefined => {
  const source = new Source(instances, (value) => otherInstance(value, instances), fallback);
  const body = emit(source, plan, 'value', '', 'return undefined;');
  const built = generateFunction(
    source.names,
    `function stringify(value) { let s = ''; ${body} return s; }`,
    source.values,
    generate,
  );

  // The generated source returns a string, or undefined where the value has no JSON text.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return built as Stringify | undefined;
};

const instanceWriters = new WeakMap<object, Stringify>();

/**
 * The JSON text of a value a writer doesn't know, such as an instance of a subtype of the type
 * the field declares.
 *
 * @remarks
 * Such an instance is written by its own type's writer, which falls back to `JSON.stringify()`
 * rather than coming back here.
 *
 * @throws {@link TypeError} when the value holds a bigint or refers to itself.
 *
 * @internal
 */
const otherInstance = (value: unknown, instances: Instances): string | undefined => {
  if (typeof value !== 'object' || value === null) {
    return JSON.stringify(value);
  }

  const type: unknown = value.constructor;

  if (typeof type !== 'function' || !instances.isOwn(type)) {
    return JSON.stringify(value);
  }

  let write = instanceWriters.get(type);

  if (write === undefined) {
    write = generated({ kind: 'type', type }, instances, 'json') ?? json;
    instanceWriters.set(type, write);
  }

  return write(value);
};

/**
 * A function that writes what `plan` describes as JSON text, generated for the plan;
 * `slow` writes it where code generation is forbidden.
 *
 * @remarks
 * Instances of the declared class whose value is still the one they were built with are written
 * from that value, strings of escape-free types between quotes as they are. Anything else, such as
 * an instance from another copy of the package, a changed instance or a plain value, goes through
 * `JSON.stringify()`, so the text is the same either way.
 *
 * @internal
 */
export const stringifierOf = (
  plan: Plan,
  instances: Instances,
  slow: Stringify,
  generate?: boolean,
): Stringify => generated(plan, instances, 'other', generate) ?? slow;

/**
 * The text a stringifier gives for a value at the top of a response.
 *
 * @throws {@link TypeError} if JSON has no text for the value, such as `undefined`.
 *
 * @internal
 */
export const textOf = (stringify: Stringify, value: unknown): string => {
  const written = stringify(value);

  if (written === undefined) {
    throw new TypeError(`stringify(): JSON has no text for ${typeof value}`);
  }

  return written;
};
