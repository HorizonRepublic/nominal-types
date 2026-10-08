import type { NominalIssue } from './issue-codes.ts';
import { issueOf } from './messages.ts';

/**
 * What `array()` accepts: how many items, as an exact `length` or a `min`, a `max` or both, and
 * whether an item may repeat.
 */
export interface ArrayOptions {
  readonly length?: number;
  readonly min?: number;
  readonly max?: number;
  /**
   * Refuses an item equal to an earlier one, compared as `equals()` compares them.
   */
  readonly unique?: boolean;
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const items = (count: number): string => (count === 1 ? '1 item' : `${count} items`);

/**
 * Internal: the lowest and highest count `options` allow.
 *
 * @throws TypeError for counts that are not whole numbers from 0 up, `length` mixed with `min` or
 * `max`, `min` above `max`, or a `unique` that is not a boolean.
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

  if (options.unique !== undefined && typeof options.unique !== 'boolean') {
    throw new TypeError(`array(): unique must be true or false (was ${String(options.unique)})`);
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

const countMessage = (options: ArrayOptions, count: number): string => {
  if (options.length !== undefined) {
    return `must have ${items(options.length)} (was ${count})`;
  }

  return options.min !== undefined && count < options.min
    ? `must have at least ${items(options.min)} (was ${count})`
    : `must have at most ${items(options.max ?? 0)} (was ${count})`;
};

/**
 * Internal: the issue for an array whose count `options` don't allow; the count is shown whatever
 * the `values` setting, since it is not the value.
 */
export const countIssue = (options: ArrayOptions, count: number): NominalIssue => {
  const { min, max } = boundsOf(options);

  return issueOf(count < min ? 'too_few_items' : 'too_many_items', countMessage(options, count), {
    wording: {
      value: String(count),
      hiddenValue: String(count),
      min,
      max: max === Number.POSITIVE_INFINITY ? undefined : max,
    },
  });
};
