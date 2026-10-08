/**
 * How many different inputs each case cycles through. With one constant input, a library that
 * compiles its checks lets the engine fold the whole check away, and the time shown is 0 ns.
 */
export const poolSize = 1024;

/**
 * A pool of `poolSize` inputs, the same on every run.
 */
export const pool = <Input>(make: (index: number) => Input): readonly Input[] =>
  Array.from({ length: poolSize }, (_, index) => make(index));

/**
 * The same text as one flat string. V8 keeps a joined string as a tree of parts until something
 * reads it whole, and the first library to do so would pay for flattening it.
 */
export const flat = (text: string): string => {
  const copy: unknown = JSON.parse(JSON.stringify(text));

  return typeof copy === 'string' ? copy : text;
};

/**
 * A pool of `poolSize` flat strings.
 */
export const textPool = (make: (index: number) => string): readonly string[] =>
  pool((index) => flat(make(index)));

const hexOf = (seed: number, length: number): string => {
  let state = (seed * 2_654_435_761) >>> 0;
  let text = '';

  while (text.length < length) {
    state = Math.imul(state ^ (state >>> 15), 2_246_822_519) >>> 0;
    state = (state ^ (state >>> 13)) >>> 0;
    text += state.toString(16).padStart(8, '0');
  }

  return text.slice(0, length);
};

/**
 * A UUID every library accepts: version 4 or 7, the RFC 9562 variant, lowercase hex.
 */
export const uuidAt = (index: number): string => {
  const hex = hexOf(index + 1, 32);
  const version = index % 2 === 0 ? '7' : '4';
  const variant = '89ab'.charAt(index % 4);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${version}${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const brokenUuids: ReadonlyArray<(uuid: string, index: number) => string> = [
  (uuid, index) => `${uuid.slice(0, index % 8)}g${uuid.slice((index % 8) + 1)}`,
  (uuid) => uuid.slice(0, 35),
  (uuid) => `${uuid.slice(0, 8)}_${uuid.slice(9)}`,
  (uuid) => `${uuid}0`,
];

/**
 * A string that looks like a UUID and that no library accepts: a letter outside hex, a missing or
 * extra digit, or a dash replaced.
 */
export const brokenUuidAt = (index: number): string =>
  brokenUuids[index % brokenUuids.length]?.(uuidAt(index), index) ?? '';

const domains = ['example.com', 'mail.example.org', 'example.io', 'post.example.dev'];

/**
 * An address every library accepts, from 16 to 40 characters.
 */
export const emailAt = (index: number): string =>
  `${index % 3 === 0 ? 'jane.doe' : 'j'}${index}${index % 5 === 0 ? '+news' : ''}@${domains[index % domains.length] ?? ''}`;

const brokenEmails: ReadonlyArray<(index: number) => string> = [
  (index) => `jane.doe${index}.example.com`,
  (index) => `jane${index}@@example.com`,
  (index) => `jane ${index}@example.com`,
  (index) => `@example${index}.com`,
  (index) => `jane${index}@`,
  (index) => `jane${index}@exa mple.com`,
];

/**
 * A string near an address that no library accepts: no `@`, two of them, a space, no local part
 * or no domain.
 */
export const brokenEmailAt = (index: number): string =>
  brokenEmails[index % brokenEmails.length]?.(index) ?? '';

/**
 * A SKU the shared pattern `^SKU-\d{4}$` accepts.
 */
export const skuAt = (index: number): string =>
  `SKU-${String((index * 7919) % 10_000).padStart(4, '0')}`;

const brokenSkus: ReadonlyArray<(index: number) => string> = [
  (index) => `SKU-${String(10_000 + index)}`,
  (index) => `sku-${String(index).padStart(4, '0')}`,
  (index) => `SKU-${String(index % 1000).padStart(3, '0')}`,
  (index) => `nope-${index}`,
];

/**
 * A string the shared SKU pattern refuses.
 */
export const brokenSkuAt = (index: number): string =>
  brokenSkus[index % brokenSkus.length]?.(index) ?? '';

/**
 * A positive integer.
 */
export const positiveIntegerAt = (index: number): number => 1 + index * 37;

/**
 * A number that is not a positive integer: zero, a negative integer or a fraction.
 */
export const brokenPositiveIntegerAt = (index: number): number =>
  [-index, index + 0.5][index % 2] ?? 0;
