/**
 * The TSDoc rules of this package that no published plugin has, loaded by oxlint as a JS plugin.
 *
 * @packageDocumentation
 */

interface Comment {
  readonly type: 'Block' | 'Line' | 'Shebang';
  readonly value: string;
}

interface Node {
  readonly type: string;
  readonly parent?: Node | null;
  readonly optional?: boolean;
  readonly id?: { readonly name: string } | null;
}

interface Context {
  readonly sourceCode: { getCommentsBefore: (node: Node) => Comment[] };
  readonly report: (descriptor: { node: Node; message: string }) => void;
}

interface Rule {
  readonly meta: { readonly type: string; readonly docs: { readonly description: string } };
  readonly create: (context: Context) => Record<string, (node: Node) => void>;
}

interface Plugin {
  readonly meta: { readonly name: string };
  readonly rules: Record<string, Rule>;
}

const optionsName = /(?:Options|Configuration)$/u;

/**
 * Returns the name of the interface or type alias a member is declared in.
 *
 * @param node - The member.
 * @returns The name, or `null` for a member outside a named declaration.
 */
const ownerName = (node: Node): string | null => {
  let parent = node.parent;

  while (parent !== undefined && parent !== null) {
    if (parent.type === 'TSInterfaceDeclaration' || parent.type === 'TSTypeAliasDeclaration') {
      return parent.id?.name ?? null;
    }

    parent = parent.parent;
  }

  return null;
};

/**
 * Returns the TSDoc block right before a node.
 *
 * @param context - The rule context.
 * @param node - The node the block documents.
 * @returns The text of the block, or `null` when the node has none.
 */
const docOf = (context: Context, node: Node): string | null => {
  const comment = context.sourceCode.getCommentsBefore(node).at(-1);

  return comment?.type === 'Block' && comment.value.startsWith('*') ? comment.value : null;
};

/**
 * Requires `@defaultValue` on every optional property of an options interface, the interfaces
 * whose names end with `Options` or `Configuration`.
 */
const defaultValue: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require `@defaultValue` on optional properties of option interfaces.' },
  },
  create: (context: Context): Record<string, (node: Node) => void> => ({
    TSPropertySignature: (node: Node): void => {
      const owner = ownerName(node);

      if (node.optional !== true || owner === null || !optionsName.test(owner)) {
        return;
      }

      const doc = docOf(context, node);

      if (doc !== null && /@(?:defaultValue|internal)\b/u.test(doc)) {
        return;
      }

      context.report({
        node,
        message: `An optional property of \`${owner}\` documents its default with \`@defaultValue\`.`,
      });
    },
  }),
};

const plugin: Plugin = {
  meta: { name: 'api-docs' },
  rules: { 'default-value': defaultValue },
};

export default plugin;
