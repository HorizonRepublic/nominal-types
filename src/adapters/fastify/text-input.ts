import { isNominalType } from '../../core/nominal.ts';
import { objectParts } from '../../core/object-helpers.ts';
import type { NominalTarget } from '../../core/target.ts';
import { textFormOf } from '../../core/text-form.ts';
import { isArraySchema } from '../../core/type-schema.ts';

type Reader = (value: unknown) => unknown;

const textParts = new Set(['querystring', 'params', 'headers']);

const readerOf = (field: unknown): Reader | undefined => {
  const form = isNominalType(field) ? textFormOf(field) : undefined;

  if (form !== undefined) {
    return (value) => (typeof value === 'string' ? (form(value) ?? value) : value);
  }

  return isArraySchema(field)
    ? (value) => (value === undefined || Array.isArray(value) ? value : [value])
    : undefined;
};

/**
 * Internal: how a part of a request that arrives as text is read for an `n.object()` schema, as
 * `NominalPipe` reads a query value: a string for a number or boolean type is read as its value,
 * and a lone value for a list becomes a list of one. `undefined` when nothing is read.
 */
export const textReaderFor = (
  target: NominalTarget,
  part: string | undefined,
): Reader | undefined => {
  const fields =
    part !== undefined && textParts.has(part) ? objectParts.get(target)?.source : undefined;

  if (fields === undefined) {
    return undefined;
  }

  const readers = Object.entries(fields).flatMap(([key, field]) => {
    const read = readerOf(field);

    return read === undefined ? [] : [[key, read] as const];
  });

  if (readers.length === 0) {
    return undefined;
  }

  return (input) => {
    if (typeof input !== 'object' || input === null) {
      return input;
    }

    const copy: Record<string, unknown> = { ...input };

    for (const [key, read] of readers) {
      if (Object.hasOwn(copy, key)) {
        copy[key] = read(copy[key]);
      }
    }

    return copy;
  };
};
