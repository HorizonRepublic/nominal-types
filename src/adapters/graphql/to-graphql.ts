import { GraphQLError, GraphQLScalarType, Kind, valueFromASTUntyped } from 'graphql';
import type { ValueNode } from 'graphql';

import type { AnyNominalType } from '../../core/contracts.ts';
import { hideValues } from '../../core/hidden-values.ts';
import { issueText } from '../../core/issue-text.ts';
import { Rejection } from '../../core/rejection.ts';
import { instanceParserFor } from '../../core/type-functions.ts';
import { AnyBigInt } from '../../types/bigint/any-bigint.ts';
import { isUnder } from '../orm/column.ts';
import { typeJsonOf } from '../type-json.ts';

/**
 * Options of {@link toGraphQL}.
 *
 * @typeParam Instance - The instances of the type.
 */
export interface GraphQLOptions<Instance> {
  /**
   * The scalar's name in the schema.
   *
   * @defaultValue The last part of the type's name, such as `Email` for `nominal.Email`.
   */
  readonly name?: string;
  /**
   * The scalar's description.
   *
   * @defaultValue The type's own description, such as `an email address`.
   */
  readonly description?: string;
  /**
   * What a value is sent as.
   *
   * @defaultValue The instance's `toJSON()`.
   */
  readonly serialize?: (value: Instance) => unknown;
  /**
   * A URL of the scalar's specification, shown by GraphQL tools.
   *
   * @defaultValue No URL.
   */
  readonly specifiedByURL?: string;
  /**
   * Leaves rejected values out of error messages, for every type, since GraphQL sends the messages
   * to the client. Types declared `sensitive` leave them out anyway.
   *
   * @defaultValue `false`
   */
  readonly hideValues?: boolean;
}

const scalarName = (typeName: string): string =>
  typeName
    .slice(typeName.lastIndexOf('.') + 1)
    .replaceAll(/[^\w]/gu, '_')
    .replace(/^(?=\d)/u, '_');

const storedOf = (instance: unknown): unknown => {
  const toJson: unknown =
    typeof instance === 'object' && instance !== null ? Reflect.get(instance, 'toJSON') : undefined;

  return typeof toJson === 'function' ? Reflect.apply(toJson, instance, []) : instance;
};

const instanceMaker = <Target extends AnyNominalType>(
  target: Target,
  name: string,
  hidden: boolean,
): ((value: unknown) => Target['prototype']) => {
  const parse = instanceParserFor(target);

  /**
   * The instance a value stands for.
   *
   * @throws {@link GraphQLError} when the type refuses the value; the message lists the problems.
   *
   * @internal
   */
  return (value) => {
    const result = parse(value);

    if (result instanceof Rejection) {
      const issues = hidden ? hideValues(result.issues) : result.issues;

      throw new GraphQLError(`${name}: ${issues.map((issue) => issueText(issue)).join('; ')}`);
    }

    // The parser gave an instance of `target`.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return result as Target['prototype'];
  };
};

const literalReader =
  (bigints: boolean) =>
  (node: ValueNode, variables?: Readonly<Record<string, unknown>> | null): unknown =>
    // @throws-ignore the text of an INT literal is an integer, which BigInt() reads
    bigints && node.kind === Kind.INT ? BigInt(node.value) : valueFromASTUntyped(node, variables);

/**
 * A GraphQL scalar for a nominal type, for arguments and fields that hold instances, in Apollo,
 * NestJS GraphQL, Pothos, type-graphql or any server built on `graphql`.
 *
 * @remarks
 * Values from variables and literals become instances, checked by the type; a value it refuses is
 * a GraphQL error with the type's message. Results are sent as the instance's `toJSON()`, or
 * `serialize` of it; a plain result the type accepts is sent the same way. Integer literals of big
 * integer types are read from their text, without losing digits. The scalar carries the type's
 * JSON Schema in `extensions.jsonSchema`.
 *
 * @typeParam Target - The nominal type.
 * @param target - The nominal type the scalar holds.
 * @param options - The scalar's name, description and how values are sent.
 * @returns The scalar, to use in a schema or a resolver map.
 *
 * @example
 * ```ts
 * import { GraphQLNonNull, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
 * import { Email } from '@horizon-republic/nominal-types';
 * import { toGraphQL } from '@horizon-republic/nominal-types/adapters/graphql';
 *
 * const EmailScalar = toGraphQL(Email);
 *
 * const schema = new GraphQLSchema({
 *   query: new GraphQLObjectType({
 *     name: 'Query',
 *     fields: {
 *       domain: {
 *         type: GraphQLString,
 *         args: { email: { type: new GraphQLNonNull(EmailScalar) } },
 *         resolve: (_source, args: { email: Email }) => args.email.domain,
 *       },
 *     },
 *   }),
 * });
 * ```
 */
export const toGraphQL = <Target extends AnyNominalType>(
  target: Target,
  options: GraphQLOptions<Target['prototype']> = {},
): GraphQLScalarType<Target['prototype'], unknown> => {
  const name = options.name ?? scalarName(target.typeName);
  const json = typeJsonOf(target);
  const description: unknown = Reflect.get(target.rule, 'description');

  const instanceOf = instanceMaker(target, name, options.hideValues === true);
  const literalOf = literalReader(isUnder(AnyBigInt, target));

  const output = (value: unknown): unknown => {
    const instance = instanceOf(value);

    return options.serialize === undefined ? storedOf(instance) : options.serialize(instance);
  };

  return new GraphQLScalarType<Target['prototype'], unknown>({
    name,
    description: options.description ?? (typeof description === 'string' ? description : null),
    specifiedByURL: options.specifiedByURL ?? null,
    coerceOutputValue: output,
    coerceInputValue: instanceOf,
    coerceInputLiteral: (node) => instanceOf(literalOf(node)),
    // GraphQL 16 knows only these three, so they stay beside the ones 17 reads.
    // oxlint-disable-next-line typescript/no-deprecated
    serialize: output,
    // oxlint-disable-next-line typescript/no-deprecated
    parseValue: instanceOf,
    // oxlint-disable-next-line typescript/no-deprecated
    parseLiteral: (node, variables) => instanceOf(literalOf(node, variables)),
    extensions: json === undefined ? {} : { jsonSchema: json },
  });
};
