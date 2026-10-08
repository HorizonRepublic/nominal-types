import { trimmedText } from './compile.ts';
import { normalizeSlot } from './hierarchy.ts';
import { shared } from './shared.ts';

/**
 * How a type reads its value from text, as an environment variable or a query string
 * carries it. Returns `undefined` for text that doesn't look like a value, which then goes to the
 * type's rule unchanged and is rejected there with the usual message.
 *
 * @internal
 */
export type TextForm = (text: string) => unknown;

/**
 * Gives a type and every type under it a text form.
 *
 * @internal
 */
export const defineTextForm = (type: object, form: TextForm): void => {
  shared.textForms.set(type, form);
};

const ownFormOf = (type: unknown): TextForm | undefined => {
  let current: unknown = type;

  while (typeof current === 'function') {
    const form = shared.textForms.get(current);

    if (form !== undefined) {
      return form;
    }

    current = Object.getPrototypeOf(current);
  }

  return undefined;
};

/**
 * The text form of a type, inherited from the closest type above it that has one; it
 * trims the text first while `n.configure({ normalize: { trimStrings: true } })` is set, unless
 * the type opts out with `normalize: false`.
 *
 * @internal
 */
export const textFormOf = (type: unknown): TextForm | undefined => {
  const form = ownFormOf(type);

  if (
    form === undefined ||
    (typeof type === 'function' && Reflect.get(type, normalizeSlot) === false)
  ) {
    return form;
  }

  return (text) => form(trimmedText(text));
};

/**
 * Reads text as itself, for types whose value already is a string.
 *
 * @internal
 */
export const asText: TextForm = (text) => text;
