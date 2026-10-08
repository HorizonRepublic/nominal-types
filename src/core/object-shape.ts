import { generateFunction } from './compile.ts';
import type { AnyConstraint } from './constraint-types.ts';
import { mustBe } from './messages.ts';
import { Rejection } from './rejection.ts';
import type { Shape } from './shapes.ts';
import type { StandardJSONSchemaV1, StandardSchemaV1 } from './standard-spec.ts';

/**
 * Internal: a field of an object schema: how its value runs, whether it may be missing, and how it
 * describes itself.
 */
export interface ObjectField {
  readonly key: string;
  readonly run: (value: unknown) => unknown;
  readonly optional: boolean;
  readonly describe: (
    side: 'input' | 'output',
    options: StandardJSONSchemaV1.Options,
  ) => Record<string, unknown>;
}

type Issues = StandardSchemaV1.Issue[] | undefined;

type Run = (input: unknown) => unknown;

const isRun = (value: unknown): value is Run => typeof value === 'function';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fieldIssues = (
  issues: Issues,
  key: string,
  rejection: Rejection,
): StandardSchemaV1.Issue[] => {
  const all = issues ?? [];

  for (const issue of rejection.issues) {
    all.push({ message: issue.message, path: [key, ...(issue.path ?? [])] });
  }

  return all;
};

const missingIssues = (issues: Issues, key: string): StandardSchemaV1.Issue[] => {
  const all = issues ?? [];

  all.push({ message: 'is required', path: [key] });

  return all;
};

const unknownKeyIssues = (
  issues: Issues,
  input: Readonly<Record<string, unknown>>,
  declared: ReadonlySet<string>,
): Issues => {
  let all = issues;

  for (const key of Object.keys(input)) {
    if (!declared.has(key)) {
      all ??= [];
      all.push({ message: 'is not allowed', path: [key] });
    }
  }

  return all;
};

const constraintIssues = (
  issues: Issues,
  value: Readonly<Record<string, unknown>>,
  constraints: readonly AnyConstraint[],
): Issues => {
  let all = issues;

  for (const constraint of constraints) {
    const found = constraint.issuesOf(value);

    if (found.length > 0) {
      all ??= [];
      all.push(...found);
    }
  }

  return all;
};

const notObject = (input: unknown): Rejection =>
  new Rejection([{ message: mustBe('an object', input) }]);

const loopRun =
  (fields: readonly ObjectField[], constraints: readonly AnyConstraint[], strict: boolean): Run =>
  (input) => {
    if (!isRecord(input)) {
      return notObject(input);
    }

    const value: Record<string, unknown> = {};
    let issues: Issues;

    for (const { key, run, optional } of fields) {
      const item = Object.hasOwn(input, key) ? input[key] : undefined;

      if (item === undefined) {
        if (!optional) {
          issues = missingIssues(issues, key);
        }

        continue;
      }

      const result = run(item);

      if (result instanceof Rejection) {
        issues = fieldIssues(issues, key, result);
      } else {
        value[key] = result;
      }
    }

    if (strict) {
      issues = unknownKeyIssues(issues, input, new Set(fields.map(({ key }) => key)));
    }

    issues ??= constraintIssues(undefined, value, constraints);

    return issues === undefined ? value : new Rejection(issues);
  };

const fieldSource = ({ key, optional }: ObjectField, index: number): string => {
  const name = JSON.stringify(key);
  const at = String(index);
  const read = `const raw${at} = hasOwn.call(input, ${name}) ? input[${name}] : undefined;`;
  const check = `v${at} = run${at}(raw${at});
    if (v${at} instanceof Rejection) issues = fieldIssues(issues, ${name}, v${at});`;

  return optional
    ? `${read}
      let present${at} = false;
      let value${at};
      if (raw${at} !== undefined) {
        const ${check}
        else { present${at} = true; value${at} = v${at}; }
      }`
    : `${read}
      let v${at};
      if (raw${at} === undefined) issues = missingIssues(issues, ${name});
      else { ${check} }`;
};

const sourceOf = (
  fields: readonly ObjectField[],
  hasConstraints: boolean,
  strict: boolean,
): string => {
  // The fields before the first optional one go in an object literal, which V8 builds fastest; the
  // rest are stored in order, so the value keeps the declared order with optional fields missing.
  const firstOptional = fields.findIndex(({ optional }) => optional);
  const literalCount = firstOptional === -1 ? fields.length : firstOptional;
  const literal = fields
    .slice(0, literalCount)
    .map((field, index) => `${JSON.stringify(field.key)}: v${String(index)}`)
    .join(', ');
  const stores = fields.slice(literalCount).map((field, offset) => {
    const index = String(literalCount + offset);
    const key = JSON.stringify(field.key);

    return field.optional
      ? `if (present${index}) value[${key}] = value${index};`
      : `value[${key}] = v${index};`;
  });
  const checkConstraints = hasConstraints
    ? 'issues = constraintIssues(issues, value, constraints); if (issues !== undefined) return new Rejection(issues);'
    : '';

  return `function parseObject(input) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return notObject(input);
    let issues;
    ${fields.map((field, index) => fieldSource(field, index)).join('\n')}
    ${strict ? 'issues = unknownKeyIssues(issues, input, declared);' : ''}
    if (issues !== undefined) return new Rejection(issues);
    const value = { ${literal} };
    ${stores.join('\n')}
    ${checkConstraints}
    return value;
  }`;
};

const generatedRun = (
  fields: readonly ObjectField[],
  constraints: readonly AnyConstraint[],
  strict: boolean,
): Run | undefined => {
  const names = [
    'Rejection',
    'notObject',
    'fieldIssues',
    'missingIssues',
    'hasOwn',
    'unknownKeyIssues',
    'constraintIssues',
    'declared',
    'constraints',
    ...fields.map((_field, index) => `run${String(index)}`),
  ];
  const values = [
    Rejection,
    notObject,
    fieldIssues,
    missingIssues,
    Reflect.get(Object.prototype, 'hasOwnProperty'),
    unknownKeyIssues,
    constraintIssues,
    new Set(fields.map(({ key }) => key)),
    constraints,
    ...fields.map(({ run }) => run),
  ];
  const built = generateFunction(names, sourceOf(fields, constraints.length > 0, strict), values);

  return isRun(built) ? built : undefined;
};

const describeObject =
  (fields: readonly ObjectField[], strict: boolean) =>
  (side: 'input' | 'output', options: StandardJSONSchemaV1.Options): Record<string, unknown> => ({
    type: 'object',
    properties: Object.fromEntries(
      fields.map(({ key, describe }) => [key, describe(side, options)]),
    ),
    required: fields.filter(({ optional }) => !optional).map(({ key }) => key),
    ...(strict || side === 'output' ? { additionalProperties: false } : {}),
  });

/**
 * Internal: how an `n.object()` schema runs and describes itself: every field through its own
 * schema, all issues collected, unknown keys dropped or, when `strict`, refused, the constraints
 * once every field passed. The result is a new object, read-only by type; a nominal type built on
 * it freezes it.
 *
 * @remarks
 * Where code generation is allowed, each object runs one function generated for its fields, with
 * a call site of its own per field.
 */
export const objectShape = (
  fields: readonly ObjectField[],
  constraints: readonly AnyConstraint[],
  strict: boolean,
  generate?: boolean,
): Shape<Readonly<Record<string, unknown>>> => {
  const run =
    (generate === false ? undefined : generatedRun(fields, constraints, strict)) ??
    loopRun(fields, constraints, strict);

  return {
    // The function returns a new object of the fields, or a Rejection.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    run: run as (input: unknown) => Readonly<Record<string, unknown>> | Rejection,
    describe: describeObject(fields, strict),
  };
};
