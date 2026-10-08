import type { Emitter, Piece } from './plan-emitters.ts';

/**
 * The statements that write a record: each key whose value JSON leaves out is skipped, as
 * `JSON.stringify()` skips it.
 *
 * @internal
 */
export const emitRecord: Emitter<'record'> = (tools, plan, expr, prefix, none) => {
  const { fresh, ref, emit, append, appendText } = tools;
  const o = fresh('o');
  const t = fresh('t');
  const keys = fresh('k');
  const index = fresh('i');
  const key = fresh('y');
  const wrote = fresh('w');
  const separator: Piece = { code: `(${wrote} ? ',' : '') + text(${key}) + ':'` };
  const body = emit(plan.value, `${o}[${key}]`, separator, 'continue;');

  return `const ${o} = ${expr}; if (typeof ${o} !== 'object' || ${o} === null || Array.isArray(${o})) { const ${t} = JSON.stringify(${ref(plan.write)}(${o})); ${appendText(t, prefix, none)} } else { ${append(prefix, '{')} const ${keys} = Object.keys(${o}); let ${wrote} = false; for (let ${index} = 0; ${index} < ${keys}.length; ${index}++) { const ${key} = ${keys}[${index}]; ${body} ${wrote} = true; } s += '}'; }`;
};

/**
 * The statements that write a tuple: items past the declared ones by the rest plan, and a missing
 * item as `null`, as JSON writes it.
 *
 * @internal
 */
export const emitTuple: Emitter<'tuple'> = (tools, plan, expr, prefix, none) => {
  const { fresh, ref, emit, append, appendText } = tools;
  const { items, rest } = plan;
  const a = fresh('a');
  const t = fresh('t');
  const count = fresh('n');
  const index = fresh('i');
  const positions = items.map(
    (item, at) =>
      `if (${count} > ${at}) { ${at === 0 ? '' : "s += ',';"} ${emit(item, `${a}[${at}]`, '', "s += 'null';")} }`,
  );

  return `const ${a} = ${expr}; if (!Array.isArray(${a})) { const ${t} = JSON.stringify(${ref(plan.write)}(${a})); ${appendText(t, prefix, none)} } else { ${append(prefix, '[')} const ${count} = ${a}.length; ${positions.join(' ')} for (let ${index} = ${items.length}; ${index} < ${count}; ${index}++) { if (${index} !== 0) s += ','; ${emit(rest, `${a}[${index}]`, '', "s += 'null';")} } s += ']'; }`;
};
