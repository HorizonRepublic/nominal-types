import { ParseError } from './errors.ts';

declare const dynamic: any;

export const callsAny = (): unknown => dynamic.run(); // error: unresolved

export const throwsUnknown = (reason: unknown): never => {
  throw reason; // error: unresolved
};

const later = (callback: () => void): void => {
  void callback;
};

/** @throws {ParseError} always. */
const fail = (): never => {
  throw new ParseError('lost');
};

export const lostCallback = (): void => {
  later(() => fail()); // error: unresolved
};
