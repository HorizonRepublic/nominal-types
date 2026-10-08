import { typeKey } from './registry.ts';

/**
 * An object node of ArkType's `.json`.
 *
 * @internal
 */
export type JsonNode = Readonly<Record<string, unknown>>;

/**
 * Whether a value is an object node rather than a union, a keyword or a literal.
 *
 * @internal
 */
export const isJsonNode = (value: unknown): value is JsonNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A list from the `.json`, or an empty one where the key holds none.
 *
 * @internal
 */
export const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

/**
 * A value from a node's meta.
 *
 * @internal
 */
export const metaOf = (node: JsonNode, key: string): unknown => {
  const meta = node['meta'];

  return isJsonNode(meta) ? meta[key] : undefined;
};

/**
 * The type name an `toArk()` node carries, or `undefined` for any other node.
 *
 * @internal
 */
export const nominalNameOf = (node: unknown): string | undefined => {
  const name = isJsonNode(node) ? metaOf(node, typeKey) : undefined;

  return typeof name === 'string' ? name : undefined;
};

/**
 * Whether an `toArk()` node sits anywhere below a node.
 *
 * @internal
 */
export const holdsNominal = (node: unknown): boolean =>
  // @throws-ignore the node is a part of ArkType's `.json`, which is JSON already
  JSON.stringify(node).includes(`"${typeKey}"`);

const isObjectDomain = (domain: unknown): boolean =>
  domain === 'object' || (isJsonNode(domain) && domain['domain'] === 'object');

/**
 * Whether a node describes an object.
 *
 * @internal
 */
export const isObjectNode = (node: unknown): node is JsonNode =>
  isJsonNode(node) && (isObjectDomain(node['domain']) || 'required' in node || 'optional' in node);

/**
 * Whether a node describes an array.
 *
 * @internal
 */
export const isArrayNode = (node: unknown): node is JsonNode =>
  isJsonNode(node) && node['proto'] === 'Array';

/**
 * The error for an `toArk()` node in a place whose branch can't be told at runtime.
 *
 * @internal
 */
export const unsupported = (where: string): TypeError =>
  new TypeError(
    `fromArk: ${where} holds a nominal type in a form that can't be told apart at runtime; ` +
      'keep toArk() nodes in object fields, arrays, tuples, records, nullable and optional values, ' +
      'or unions told apart by type or by a literal field',
  );
