import { typeKey } from './registry.ts';

/**
 * Internal: an object node of ArkType's `.json`.
 */
export type JsonNode = Readonly<Record<string, unknown>>;

/**
 * Internal: whether a value is an object node rather than a union, a keyword or a literal.
 */
export const isJsonNode = (value: unknown): value is JsonNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Internal: a list from the `.json`, or an empty one where the key holds none.
 */
export const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

/**
 * Internal: a value from a node's meta.
 */
export const metaOf = (node: JsonNode, key: string): unknown => {
  const meta = node['meta'];

  return isJsonNode(meta) ? meta[key] : undefined;
};

/**
 * Internal: the type name an `toArk()` node carries, or `undefined` for any other node.
 */
export const nominalNameOf = (node: unknown): string | undefined => {
  const name = isJsonNode(node) ? metaOf(node, typeKey) : undefined;

  return typeof name === 'string' ? name : undefined;
};

/**
 * Internal: whether an `toArk()` node sits anywhere below a node.
 */
export const holdsNominal = (node: unknown): boolean =>
  JSON.stringify(node).includes(`"${typeKey}"`);

const isObjectDomain = (domain: unknown): boolean =>
  domain === 'object' || (isJsonNode(domain) && domain['domain'] === 'object');

/**
 * Internal: whether a node describes an object.
 */
export const isObjectNode = (node: unknown): node is JsonNode =>
  isJsonNode(node) && (isObjectDomain(node['domain']) || 'required' in node || 'optional' in node);

/**
 * Internal: whether a node describes an array.
 */
export const isArrayNode = (node: unknown): node is JsonNode =>
  isJsonNode(node) && node['proto'] === 'Array';

/**
 * Internal: the error for an `toArk()` node in a place whose branch can't be told at runtime.
 */
export const unsupported = (where: string): TypeError =>
  new TypeError(
    `fromArk: ${where} holds a nominal type in a form that can't be told apart at runtime; ` +
      'keep toArk() nodes in object fields, arrays, tuples, records, nullable and optional values, ' +
      'or unions told apart by type or by a literal field',
  );
