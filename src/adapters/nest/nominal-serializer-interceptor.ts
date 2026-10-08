import { ClassSerializerInterceptor } from '@nestjs/common';
import type { ClassSerializerContextOptions, PlainLiteralObject } from '@nestjs/common';

import { isNominalType, ownTypes } from '../../core/nominal.ts';

const { root } = ownTypes;
const objectPrototype = Object.prototype;

type JsonOwner = { toJSON(): unknown };

const isNominalInstance = (value: object): value is JsonOwner =>
  value instanceof root ||
  (isNominalType(Reflect.get(value, 'constructor')) &&
    typeof Reflect.get(value, 'toJSON') === 'function');

const copyOf = (value: object): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...value };
  const prototype: unknown = Reflect.getPrototypeOf(value);

  if (prototype !== objectPrototype) {
    Reflect.setPrototypeOf(copy, typeof prototype === 'object' ? prototype : null);
  }

  return copy;
};

// Each object is copied only once something inside it changes, so a response without instances
// comes back as it was. A reference back to an object on the way down is left as it is.
const arrayForm = (value: readonly unknown[], path: object[]): readonly unknown[] => {
  let copy: unknown[] | undefined;
  const count = value.length;

  for (let index = 0; index < count; index += 1) {
    const item = value[index];
    const json = jsonForm(item, path);

    if (json !== item) {
      copy ??= value.slice();
      copy[index] = json;
    }
  }

  return copy ?? value;
};

const objectForm = (value: object, path: object[]): object => {
  let copy: Record<string, unknown> | undefined;

  for (const key of Object.keys(value)) {
    const item: unknown = Reflect.get(value, key);

    if (typeof item === 'object' && item !== null) {
      const json = jsonForm(item, path);

      if (json !== item) {
        copy ??= copyOf(value);
        copy[key] = json;
      }
    }
  }

  return copy ?? value;
};

const jsonForm = (value: unknown, path: object[]): unknown => {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (isNominalInstance(value)) {
    return jsonForm(value.toJSON(), path);
  }

  if (path.includes(value)) {
    return value;
  }

  path.push(value);

  const json = Array.isArray(value) ? arrayForm(value, path) : objectForm(value, path);

  path.pop();

  return json;
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
    const json = jsonForm(response, []) as PlainLiteralObject;

    return super.serialize(json, options);
  }
}
