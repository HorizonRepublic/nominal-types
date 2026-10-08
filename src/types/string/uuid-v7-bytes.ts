// The counter of RFC 9562 section 6.2, method 1: the 12 bits of `rand_a` count up within one
// millisecond, so ids made by one process sort in the order they were made.
const counterBits = 12;
const counterLimit = 2 ** counterBits;

// Random bytes are drawn for 256 ids at a time, which costs far less than a call per id.
const poolSize = 16 * 256;

let lastTime = -1;
let counter = 0;
let pool = new Uint8Array(0);
let taken = poolSize;

const randomBytes = (): Uint8Array => {
  if (taken >= poolSize) {
    pool = crypto.getRandomValues(new Uint8Array(poolSize));
    taken = 0;
  }

  const bytes = pool.slice(taken, taken + 16);

  taken += 16;

  return bytes;
};

/**
 * The 16 bytes of a new version 7 UUID (RFC 9562 section 5.7): the Unix time in
 * milliseconds, a counter that keeps one process's ids in order, and 62 random bits.
 *
 * @remarks
 * A clock that goes back keeps the last time used, and a counter that runs out within one
 * millisecond moves on to the next, so the order holds either way.
 *
 * @internal
 */
export const uuidV7Bytes = (now: number = Date.now()): Uint8Array => {
  const bytes = randomBytes();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (now > lastTime) {
    lastTime = now;
    // Seeded below half the range, so a busy millisecond seldom runs out.
    counter = view.getUint16(6) & 0x7_ff;
  } else {
    counter += 1;

    if (counter >= counterLimit) {
      lastTime += 1;
      counter = 0;
    }
  }

  view.setUint16(0, Math.floor(lastTime / 2 ** 32));
  view.setUint32(2, lastTime % 2 ** 32);
  view.setUint16(6, 0x70_00 | counter);
  view.setUint8(8, 0x80 | (view.getUint8(8) & 0x3f));

  return bytes;
};
