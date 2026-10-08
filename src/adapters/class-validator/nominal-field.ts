import { Transform } from 'class-transformer';
import { registerDecorator } from 'class-validator';
import type { ValidationArguments, ValidationOptions } from 'class-validator';

import { issueText } from '../../core/issue-text.ts';
import { isTarget, parseTarget } from '../../core/target.ts';
import type { NominalTarget, TargetValue } from '../../core/target.ts';

const hasToJson = (value: unknown): value is { toJSON: () => unknown } =>
  typeof value === 'object' && value !== null && typeof Reflect.get(value, 'toJSON') === 'function';

const toPlain = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => toPlain(item));
  }

  return hasToJson(value) ? toPlain(value.toJSON()) : value;
};

/**
 * Options of {@link NominalField}: class-validator's own, and how the value is written back.
 *
 * @typeParam Value - The value the property holds.
 */
export interface NominalFieldOptions<Value> extends ValidationOptions {
  /**
   * What the property becomes when the DTO is turned back into a plain object, as
   * `ClassSerializerInterceptor` does. `undefined` and `null` are written as they are.
   *
   * @defaultValue The instance's value.
   */
  readonly serialize?: (value: NonNullable<Value>) => unknown;
}

const messageOf = (target: NominalTarget, value: unknown, property: string): string => {
  const parsed = parseTarget(target, value);

  return (parsed.ok ? [] : parsed.issues).map((issue) => issueText(issue, property)).join('; ');
};

const toInstance = (target: NominalTarget): PropertyDecorator =>
  Transform(
    ({ value }: { value: unknown }) => {
      const parsed = parseTarget(target, value);

      return parsed.ok ? parsed.value : value;
    },
    { toClassOnly: true },
  );

const toValue = <Target extends NominalTarget>(
  target: Target,
  serialize: ((value: NonNullable<TargetValue<Target>>) => unknown) | undefined,
): PropertyDecorator =>
  Transform(
    ({ value }: { value: unknown }) => {
      if (serialize === undefined || value === undefined || value === null) {
        return toPlain(value);
      }

      const parsed = parseTarget(target, value);

      if (!parsed.ok) {
        return toPlain(value);
      }

      // parse() of the target gives the value the target produces; the compiler can't follow a
      // target that is either a type or a schema that far.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const produced = parsed.value as NonNullable<TargetValue<Target>>;

      return serialize(produced);
    },
    { toPlainOnly: true },
  );

const checkOf =
  (target: NominalTarget, options: ValidationOptions): PropertyDecorator =>
  (prototype, property) => {
    registerDecorator({
      name: 'nominalField',
      target: prototype.constructor,
      propertyName: String(property),
      options,
      validator: {
        validate: (value: unknown) => parseTarget(target, value).ok,
        defaultMessage: (args?: ValidationArguments) =>
          messageOf(target, args?.value, args?.property ?? String(property)),
      },
    });
  };

/**
 * Declares a DTO property as a nominal type, for class-validator and class-transformer: the value
 * becomes an instance, and a value the type rejects fails validation with the type's message.
 *
 * @remarks
 * Takes a nominal type or a `n.of()` schema, so `n.of(Uuid).array()` and
 * `n.of(Email).optional()` describe lists and optional properties. The value becomes an
 * instance only when the DTO is built with `plainToInstance`, which NestJS's `ValidationPipe` does
 * with `transform: true`; validation works either way. Turning the DTO back into a plain object
 * with `instanceToPlain`, as NestJS's `ClassSerializerInterceptor` does, gives each instance's
 * value again, or what `serialize` makes of it. The property counts as known for `whitelist`.
 * The other options are class-validator's own, such as `message` or `groups`.
 *
 * @typeParam Target - The nominal type or schema of the property.
 * @param target - The nominal type or `n.of()` schema the property must match.
 * @param options - Options of class-validator, and `serialize` for writing the value back.
 * @returns A decorator for a DTO property.
 * @throws {@link TypeError} when `target` is neither a nominal type nor a `n.of()` schema.
 *
 * @example
 * ```ts
 * import { Email, n, Uuid } from '@horizon-republic/nominal-types';
 * import { NominalField } from '@horizon-republic/nominal-types/adapters/class-validator';
 *
 * export class CreateOrderDto {
 *   @NominalField(Email)
 *   public contact!: Email;
 *
 *   @NominalField(n.of(Uuid).array({ min: 1, max: 50 }))
 *   public items!: readonly Uuid[];
 *
 *   @NominalField(n.of(Email).optional())
 *   public backup?: Email;
 * }
 * ```
 */
export const NominalField = <Target extends NominalTarget>(
  target: Target,
  options: NominalFieldOptions<TargetValue<Target>> = {},
): PropertyDecorator => {
  if (!isTarget(target)) {
    throw new TypeError('NominalField() takes a nominal type or an n.of() schema');
  }

  const { serialize, ...validation } = options;
  const decorators = [toInstance(target), toValue(target, serialize), checkOf(target, validation)];

  return (prototype, property) => {
    for (const decorate of decorators) {
      decorate(prototype, property);
    }
  };
};
