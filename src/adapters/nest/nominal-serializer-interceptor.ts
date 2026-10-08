import { ClassSerializerInterceptor } from '@nestjs/common';
import type { ClassSerializerContextOptions, PlainLiteralObject } from '@nestjs/common';

import { isNominalType } from '../../core/nominal.ts';

const isNominalInstance = (value: object): value is { toJSON: () => unknown } =>
  isNominalType(Reflect.get(value, 'constructor')) &&
  typeof Reflect.get(value, 'toJSON') === 'function';

const withJsonFields = (value: object, seen: WeakMap<object, unknown>): unknown => {
  const known = seen.get(value);

  if (known !== undefined) {
    return known;
  }

  seen.set(value, value);

  if (Array.isArray(value)) {
    const items: unknown[] = value.map((item: unknown) => jsonForm(item, seen));
    const result = items.some((item, index) => item !== value[index]) ? items : value;

    seen.set(value, result);

    return result;
  }

  const entries = Object.entries(value).map(
    ([key, field]: [string, unknown]) => [key, field, jsonForm(field, seen)] as const,
  );

  if (entries.every(([, field, json]) => field === json)) {
    return value;
  }

  const copy = Object.fromEntries(entries.map(([key, , json]) => [key, json]));

  Reflect.setPrototypeOf(copy, Reflect.getPrototypeOf(value));
  seen.set(value, copy);

  return copy;
};

const jsonForm = (value: unknown, seen: WeakMap<object, unknown>): unknown => {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return isNominalInstance(value) ? jsonForm(value.toJSON(), seen) : withJsonFields(value, seen);
};

/**
 * Nest's `ClassSerializerInterceptor` that writes each nominal instance in a response as its
 * value, as `JSON.stringify()` does, rather than as `{ "value": … }`.
 *
 * @remarks
 * class-transformer, which `ClassSerializerInterceptor` runs, ignores `toJSON()`. This interceptor
 * first replaces every nominal instance in the response, in arrays, plain objects and class
 * instances at any depth, with what its `toJSON()` returns, then lets class-transformer apply
 * `@Exclude()`, `@Expose()` and groups as before. The response is not changed: an object that
 * holds an instance is copied with its prototype, so getters on it read the plain values. It takes
 * the same constructor arguments and options as `ClassSerializerInterceptor`.
 *
 * @example
 * ```ts
 * app.useGlobalInterceptors(new NominalSerializerInterceptor(app.get(Reflector)));
 * ```
 */
export class NominalSerializerInterceptor extends ClassSerializerInterceptor {
  public override serialize(
    response: PlainLiteralObject | PlainLiteralObject[],
    options: ClassSerializerContextOptions,
  ): PlainLiteralObject | PlainLiteralObject[] {
    // A response that is one instance becomes its value, which may be a string or a number;
    // `super.serialize()` returns anything that is not an object as it is.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const json = jsonForm(response, new WeakMap()) as PlainLiteralObject;

    return super.serialize(json, options);
  }
}
