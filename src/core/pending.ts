/**
 * Internal: marks that no value is waiting for a constructor.
 */
export const nothingPending: unique symbol = Symbol('nothingPending');

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
