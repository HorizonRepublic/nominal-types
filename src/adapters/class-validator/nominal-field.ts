import { Transform } from 'class-transformer';
import { registerDecorator } from 'class-validator';
import type { ValidationArguments, ValidationOptions } from 'class-validator';

import { isTarget, parseTarget } from '../../core/target.ts';
import type { NominalTarget } from '../../core/target.ts';

const messageOf = (target: NominalTarget, value: unknown, property: string): string => {
  const parsed = parseTarget(target, value);
  const issues = parsed.ok ? [] : parsed.issues;
  return issues
    .map((issue) => `${[property, ...(issue.path ?? [])].map(String).join('.')}: ${issue.message}`)
    .join('; ');
};

/**
 * Declares a DTO property as a nominal type, for class-validator and class-transformer: the value
 * becomes an instance, and a value the type rejects fails validation with the type's message.
 *
 * @remarks
 * Takes a nominal type or a `schemaOf()` schema, so `schemaOf(Uuid).array()` and
 * `schemaOf(Email).optional()` describe lists and optional properties. The value becomes an
 * instance only when the DTO is built with `plainToInstance`, which NestJS's `ValidationPipe` does
 * with `transform: true`; validation works either way. The property counts as known for
 * `whitelist`. `options` are class-validator's own, such as `message` or `groups`.
 *
 * @throws TypeError when `target` is neither a nominal type nor a `schemaOf()` schema.
 *
 * @example
 * ```ts
 * class CreateOrderDto {
 *   @NominalField(Email) contact!: Email;
 *   @NominalField(schemaOf(Uuid).array({ min: 1, max: 50 })) items!: readonly Uuid[];
 *   @NominalField(schemaOf(Email).optional()) backup?: Email;
 * }
 * ```
 */
export const NominalField = (
  target: NominalTarget,
  options?: ValidationOptions,
): PropertyDecorator => {
  if (!isTarget(target)) {
    throw new TypeError('NominalField() takes a nominal type or a schemaOf() schema');
  }
  const toInstance = Transform(({ value }: { value: unknown }) => {
    const parsed = parseTarget(target, value);
    return parsed.ok ? parsed.value : value;
  });
  return (prototype, property) => {
    toInstance(prototype, property);
    registerDecorator({
      name: 'nominalField',
      target: prototype.constructor,
      propertyName: String(property),
      ...(options === undefined ? {} : { options }),
      validator: {
        validate: (value: unknown) => parseTarget(target, value).ok,
        defaultMessage: (args?: ValidationArguments) =>
          messageOf(target, args?.value, args?.property ?? String(property)),
      },
    });
  };
};
