import { NetworkError, ParseError } from './errors.ts';

/** @throws {NetworkError} as a rejection when the link drops. */
const fetchText = async (url: string): Promise<string> => {
  if (url === '') {
    throw new NetworkError('offline');
  }

  return url;
};

/** @throws {NetworkError} passed on through await. */
export const awaited = async (url: string): Promise<string> => await fetchText(url);

export const awaitedSilently = async (url: string): Promise<string> => {
  const text = await fetchText(url); // error: undocumented

  return text;
};

export const caught = async (url: string): Promise<string> => {
  try {
    return await fetchText(url);
  } catch {
    return '';
  }
};

export const notAwaited = (url: string): void => {
  void fetchText(url);
};

export const returned = (url: string): Promise<string> => fetchText(url); // error: undocumented

export const returnedFromAsync = async (url: string): Promise<string> => {
  return fetchText(url); // error: undocumented
};

export const asyncThrow = async (text: string): Promise<number> => {
  if (text === '') {
    throw new ParseError('empty'); // error: undocumented
  }

  return text.length;
};

export const executor = (text: string): Promise<number> =>
  new Promise((resolve, reject) => {
    if (text === '') {
      reject(new ParseError('empty')); // error: undocumented
    }

    if (text === 'x') {
      throw new NetworkError('x'); // error: undocumented
    }

    resolve(text.length);
  });

export const chained = (url: string): Promise<number> =>
  fetchText(url) // error: undocumented
    .then((text) => text.length)
    .finally(() => undefined);

export const recovered = (url: string): Promise<string> => fetchText(url).catch(() => '');

export const handlerThrows = (url: string): Promise<string> =>
  fetchText(url).catch(() => {
    throw new ParseError('handler'); // error: undocumented
  });
