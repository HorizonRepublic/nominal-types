/**
 * How many items `array()` accepts: an exact `length`, or a `min`, a `max` or both.
 */
export interface ArrayOptions {
  readonly length?: number;
  readonly min?: number;
  readonly max?: number;
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const items = (count: number): string => (count === 1 ? '1 item' : `${count} items`);

/**
 * Internal: the lowest and highest count `options` allow.
 *
 * @throws TypeError for options that are not whole numbers from 0 up, mix `length` with `min` or
 * `max`, or put `min` above `max`.
 */
export const boundsOf = (options: ArrayOptions): { readonly min: number; readonly max: number } => {
  const { length, min, max } = options;
  for (const [name, value] of Object.entries({ length, min, max })) {
    if (value !== undefined && !isCount(value)) {
      throw new TypeError(
        `array(): ${name} must be a whole number from 0 up (was ${String(value)})`,
      );
    }
  }
  if (length !== undefined && (min !== undefined || max !== undefined)) {
    throw new TypeError('array(): pass either length or min and max, not both');
  }
  if (min !== undefined && max !== undefined && min > max) {
    throw new TypeError(`array(): min (${min}) is greater than max (${max})`);
  }
  return {
    min: length ?? min ?? 0,
    max: length ?? max ?? Number.POSITIVE_INFINITY,
  };
};

/**
 * Internal: the message for an array whose count `options` don't allow.
 */
export const countMessage = (options: ArrayOptions, count: number): string => {
  if (options.length !== undefined) {
    return `must have ${items(options.length)} (was ${count})`;
  }
  return options.min !== undefined && count < options.min
    ? `must have at least ${items(options.min)} (was ${count})`
    : `must have at most ${items(options.max ?? 0)} (was ${count})`;
};
