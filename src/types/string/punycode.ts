// RFC 3492 §5 parameters.
const base = 36;
const tMin = 1;
const tMax = 26;
const skew = 38;
const damp = 700;
const initialBias = 72;
const initialN = 128;
const maxInt = 0x7f_ff_ff_ff;

const adapt = (delta: number, points: number, first: boolean): number => {
  let scaled = first ? Math.floor(delta / damp) : Math.floor(delta / 2);
  let k = 0;

  scaled += Math.floor(scaled / points);

  while (scaled > ((base - tMin) * tMax) / 2) {
    scaled = Math.floor(scaled / (base - tMin));
    k += base;
  }

  return k + Math.floor(((base - tMin + 1) * scaled) / (scaled + skew));
};

const threshold = (k: number, bias: number): number => {
  if (k <= bias) {
    return tMin;
  }

  return k >= bias + tMax ? tMax : k - bias;
};

const digitOf = (code: number): number => {
  if (code >= 97 && code <= 122) {
    return code - 97;
  }

  return code >= 48 && code <= 57 ? code - 22 : -1;
};

const characterOf = (digit: number): string =>
  String.fromCodePoint(digit < 26 ? digit + 97 : digit + 22);

// One variable-length integer from `position`, as [value, position after it], or `undefined` when
// the text ends early, holds a character that is no digit, or passes 2^31 - 1. RFC 3492 §6.2 also
// guards the weight, `i` and `n` against overflow; numbers here are doubles, which hold every sum
// below 2^53 exactly, so this bound and the code point check below leave nothing to overflow.
const readInteger = (
  input: string,
  position: number,
  bias: number,
): readonly [number, number] | undefined => {
  let value = 0;
  let weight = 1;
  let at = position;

  for (let k = base; ; k += base) {
    const digit = at < input.length ? digitOf(input.codePointAt(at) ?? -1) : -1;

    at += 1;

    if (digit === -1 || digit > (maxInt - value) / weight) {
      return undefined;
    }

    value += digit * weight;

    const t = threshold(k, bias);

    if (digit < t) {
      return [value, at];
    }

    weight *= base - t;
  }
};

/**
 * Internal: the code points a lowercase Punycode string stands for, or `undefined` when it is not
 * one, per RFC 3492 §6.2.
 */
export const decodePunycode = (input: string): readonly number[] | undefined => {
  const delimiter = input.lastIndexOf('-');
  const output = Array.from(
    input.slice(0, Math.max(delimiter, 0)),
    (character) => character.codePointAt(0) ?? 0,
  );
  let n = initialN;
  let i = 0;
  let bias = initialBias;
  let position = delimiter > 0 ? delimiter + 1 : 0;

  while (position < input.length) {
    const read = readInteger(input, position, bias);

    if (read === undefined) {
      return undefined;
    }

    const points = output.length + 1;

    bias = adapt(read[0], points, i === 0);
    i += read[0];
    position = read[1];

    n += Math.floor(i / points);
    i %= points;

    if (n > 0x10_ff_ff || (n >= 0xd8_00 && n <= 0xdf_ff)) {
      return undefined;
    }

    output.splice(i, 0, n);
    i += 1;
  }

  return output;
};

const integerText = (delta: number, bias: number): string => {
  let text = '';
  let q = delta;

  for (let k = base; ; k += base) {
    const t = threshold(k, bias);

    if (q < t) {
      return text + characterOf(q);
    }

    text += characterOf(t + ((q - t) % (base - t)));
    q = Math.floor((q - t) / (base - t));
  }
};

const smallestFrom = (points: readonly number[], lowest: number): number =>
  Math.min(...points.filter((point) => point >= lowest));

/**
 * Internal: code points as Punycode, per RFC 3492 §6.3; the labels it encodes are short enough
 * that no overflow can occur.
 */
export const encodePunycode = (points: readonly number[]): string => {
  const basic = points.filter((point) => point < initialN);
  let output = basic.length > 0 ? `${String.fromCodePoint(...basic)}-` : '';
  let handled = basic.length;
  let n = initialN;
  let delta = 0;
  let bias = initialBias;

  while (handled < points.length) {
    const next = smallestFrom(points, n);

    delta += (next - n) * (handled + 1);
    n = next;

    for (const point of points) {
      delta += point < n ? 1 : 0;

      if (point === n) {
        output += integerText(delta, bias);
        bias = adapt(delta, handled + 1, handled === basic.length);
        delta = 0;
        handled += 1;
      }
    }

    delta += 1;
    n += 1;
  }

  return output;
};
