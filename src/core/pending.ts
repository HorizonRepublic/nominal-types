/**
 * Internal: marks that no value is waiting for a constructor.
 */
export const nothingPending: unique symbol = Symbol('nothingPending');

// One slot is enough: `parse` fills it and calls `new` right away, with no `await` in between, and
// the constructor takes it as its first step. A nested `parse` that runs before the outer
// constructor takes the slot overwrites it; the outer constructor then finds no match and checks
// its input again, which costs time but never gives a wrong value.
let pendingTarget: object | undefined;
let pendingInput: unknown;
let pendingValue: unknown;

/**
 * Internal: hands a value `parse` already checked to the constructor it is about to call, so the
 * constructor doesn't check it again.
 */
export const remember = (target: object, input: unknown, value: unknown): void => {
  pendingTarget = target;
  pendingInput = input;
  pendingValue = value;
};

/**
 * Internal: the value waiting for this constructor call, or `nothingPending`; taking it clears it.
 */
export const takePending = (target: object, input: unknown): unknown => {
  if (pendingTarget !== target || !Object.is(pendingInput, input)) {
    return nothingPending;
  }

  pendingTarget = undefined;

  return pendingValue;
};

/**
 * Internal: empties the slot once the `new` it was filled for has returned or thrown, so a
 * constructor that throws before `super()` leaves no value for a later call with the same input.
 */
export const forget = (): void => {
  pendingTarget = undefined;
  pendingInput = undefined;
  pendingValue = undefined;
};
