import { shared } from './shared.ts';

/**
 * Internal: how a type reads its value from text, as an environment variable or a query string
 * carries it. Returns `undefined` for text that doesn't look like a value, which then goes to the
 * type's rule unchanged and is rejected there with the usual message.
 */
export type TextForm = (text: string) => unknown;

const forms = shared.textForms;

/**
 * Internal: gives a type and every type under it a text form.
 */
export const defineTextForm = (type: object, form: TextForm): void => {
  forms.set(type, form);
};

/**
 * Internal: the text form of a type, inherited from the closest type above it that has one.
 */
export const textFormOf = (type: unknown): TextForm | undefined => {
  let current: unknown = type;
  while (typeof current === 'function') {
    const form = forms.get(current);
    if (form !== undefined) {
      return form;
    }
    current = Object.getPrototypeOf(current);
  }
  return undefined;
};

/**
 * Internal: reads text as itself, for types whose value already is a string.
 */
export const asText: TextForm = (text) => text;
