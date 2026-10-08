const native: unknown = Reflect.get(Uint8Array, 'fromBase64');

const sextets = new Uint8Array(128);
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

for (const alphabet of [`${letters}+/`, `${letters}-_`]) {
  for (let index = 0; index < alphabet.length; index++) {
    sextets[alphabet.codePointAt(index) ?? 0] = index;
  }
}

const sextetAt = (text: string, index: number): number =>
  sextets[text.codePointAt(index) ?? 0] ?? 0;

/**
 * The number of bytes a checked base64 or base64url text decodes to, padded or not.
 *
 * @internal
 */
export const decodedLength = (text: string): number => {
  let digits = text.length;

  while (digits > 0 && text.codePointAt(digits - 1) === 61) {
    digits--;
  }

  return Math.floor((digits * 3) / 4);
};

// Both alphabets are read by one table, since the text was checked against its own alphabet.
const decodeHere = (text: string): Uint8Array => {
  const bytes = new Uint8Array(decodedLength(text));
  const whole = Math.floor(bytes.length / 3) * 4;
  let out = 0;

  for (let index = 0; index < whole; index += 4) {
    const bits =
      (sextetAt(text, index) << 18) |
      (sextetAt(text, index + 1) << 12) |
      (sextetAt(text, index + 2) << 6) |
      sextetAt(text, index + 3);

    bytes[out++] = bits >> 16;
    bytes[out++] = (bits >> 8) & 255;
    bytes[out++] = bits & 255;
  }

  const rest = bytes.length - out;

  if (rest > 0) {
    const bits =
      (sextetAt(text, whole) << 18) |
      (sextetAt(text, whole + 1) << 12) |
      (sextetAt(text, whole + 2) << 6);

    bytes[out] = bits >> 16;

    if (rest === 2) {
      bytes[out + 1] = (bits >> 8) & 255;
    }
  }

  return bytes;
};

/**
 * The bytes of a checked base64 or base64url text, in a new array, decoded by
 * `Uint8Array.fromBase64` where the runtime has it.
 *
 * @internal
 */
export const decodeBase64 = (text: string, alphabet: 'base64' | 'base64url'): Uint8Array => {
  const decoded: unknown =
    typeof native === 'function'
      ? Reflect.apply(native, Uint8Array, [text, { alphabet }])
      : undefined;

  return decoded instanceof Uint8Array ? decoded : decodeHere(text);
};
