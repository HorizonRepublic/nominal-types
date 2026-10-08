const zero = 48;
const letterA = 65;
const hyphen = 45;
const letterX = 88;

const valueAt = (text: string, index: number): number => {
  const code = text.codePointAt(index) ?? zero;

  return code === letterX ? 10 : code - zero;
};

// The digits weighted 1 and 3 in turn, or 3 and 1, from the right.
const gs1Sum = (digits: string, lastWeight: number): number => {
  let sum = 0;
  let weight = lastWeight;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    sum += valueAt(digits, index) * weight;
    weight = 4 - weight;
  }

  return sum;
};

/**
 * The GS1 mod 10 check digit of GS1 General Specifications §7.9.1 for the digits before
 * it, which are weighted 3 and 1 in turn from the right.
 *
 * @internal
 */
export const gs1CheckDigit = (digits: string): string =>
  String((10 - (gs1Sum(digits, 3) % 10)) % 10);

/**
 * Whether the last digit of the text is the GS1 check digit of the ones before it.
 *
 * @internal
 */
export const hasGs1CheckDigit = (digits: string): boolean => gs1Sum(digits, 1) % 10 === 0;

// The characters weighted from the right, starting at `lastWeight` and growing by one; hyphens
// are skipped.
const mod11Sum = (text: string, lastWeight: number): number => {
  let sum = 0;
  let weight = lastWeight;

  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (text.codePointAt(index) !== hyphen) {
      sum += valueAt(text, index) * weight;
      weight += 1;
    }
  }

  return sum;
};

/**
 * The mod 11 check character of ISBN-10 and ISSN for the digits before it, which are
 * weighted 2, 3 and up from the right; `X` stands for 10.
 *
 * @internal
 */
export const mod11CheckCharacter = (digits: string): string => {
  const check = (11 - (mod11Sum(digits, 2) % 11)) % 11;

  return check === 10 ? 'X' : String(check);
};

/**
 * Whether the last character of the text, `X` for 10, is the mod 11 check character of
 * the digits before it. Hyphens are skipped.
 *
 * @internal
 */
export const hasMod11CheckCharacter = (text: string): boolean => mod11Sum(text, 1) % 11 === 0;

// A doubled digit counts with the digits of the result added, as the Luhn check takes it:
// 7 → 14 → 5, which is 14 - 9.
const luhnTerm = (digit: number, doubled: boolean): number => {
  if (!doubled) {
    return digit;
  }

  return digit > 4 ? digit * 2 - 9 : digit * 2;
};

/**
 * Whether the text passes the Luhn check of ISO/IEC 7812-1 Annex B once each letter is
 * written as two digits, `A` as 10 to `Z` as 35, as ISO 6166 checks an ISIN. The text holds
 * digits and uppercase letters only.
 *
 * @internal
 */
export const passesLuhnCheck = (text: string): boolean => {
  let sum = 0;
  let doubled = false;

  for (let index = text.length - 1; index >= 0; index -= 1) {
    const code = text.codePointAt(index) ?? zero;

    // A letter is two digits, so it moves the doubling on twice and leaves it where it was.
    if (code >= letterA) {
      const number = code - letterA + 10;

      sum += luhnTerm(number % 10, doubled) + luhnTerm(Math.trunc(number / 10), !doubled);
    } else {
      sum += luhnTerm(code - zero, doubled);
      doubled = !doubled;
    }
  }

  return sum % 10 === 0;
};
