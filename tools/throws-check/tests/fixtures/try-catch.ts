import { NetworkError, ParseError, StrictParseError } from './errors.ts';

/** @throws {ParseError | NetworkError} on bad input or a lost link. */
const load = (text: string): string => {
  if (text === '') {
    throw new ParseError('empty');
  }

  if (text === 'offline') {
    throw new NetworkError('offline');
  }

  return text;
};

export const swallowAll = (text: string): string => {
  try {
    return load(text);
  } catch {
    return '';
  }
};

/** @throws {NetworkError} passed on. */
export const keepNetwork = (text: string): string => {
  try {
    return load(text);
  } catch (error) {
    if (error instanceof ParseError) {
      return '';
    } else {
      throw error;
    }
  }
};

/** @throws {NetworkError} passed on. */
export const earlyRethrow = (text: string): string => {
  try {
    return load(text);
  } catch (error) {
    if (!(error instanceof ParseError)) {
      throw error;
    }

    return '';
  }
};

/** @throws {NetworkError} passed on. */
export const earlyReturn = (text: string): string => {
  try {
    return load(text);
  } catch (error) {
    if (error instanceof ParseError) {
      return '';
    }

    throw error;
  }
};

export const rethrowAll = (text: string): string => {
  try {
    return load(text); // error: undocumented, undocumented
  } catch (error) {
    throw error;
  }
};

/** @throws {ParseError} the only one passed on. */
export const rethrowOne = (text: string): string => {
  try {
    return load(text);
  } catch (error) {
    if (error instanceof ParseError) {
      throw error;
    }

    return '';
  }
};

/** @throws {ParseError | NetworkError} each one passed on. */
export const eitherOf = (text: string): string => {
  try {
    return load(text);
  } catch (error) {
    if (!(error instanceof ParseError || error instanceof NetworkError)) {
      return '';
    }

    throw error;
  }
};

/** @throws {TypeError} wraps everything. */
export const wrap = (text: string): string => {
  try {
    return load(text);
  } catch (error) {
    throw new TypeError('cannot load', { cause: error });
  }
};

export const wrapSilently = (text: string): string => {
  try {
    return load(text);
  } catch (error) {
    throw new TypeError('cannot load', { cause: error }); // error: undocumented
  }
};

export const finallyThrows = (text: string): string => {
  try {
    return text;
  } finally {
    load(text); // error: undocumented, undocumented
  }
};

/** @throws {ParseError | NetworkError} nothing is caught. */
export const noCatch = (text: string): string => {
  try {
    return load(text);
  } finally {
    void text;
  }
};

export const nested = (text: string): string => {
  try {
    try {
      return load(text);
    } catch (error) {
      if (error instanceof NetworkError) {
        return '';
      }

      throw error;
    }
  } catch {
    return 'outer';
  }
};

/** @throws {StrictParseError} narrowed by the catch. */
export const narrowToSubclass = (text: string): string => {
  try {
    return load(text);
  } catch (error) {
    if (error instanceof StrictParseError) {
      throw error;
    }

    return '';
  }
};

export const outsideOfTry = (text: string): string => {
  try {
    void text;
  } catch {
    return '';
  }

  return load(text); // error: undocumented, undocumented
};
