import { execFileSync } from 'node:child_process';
import { arch, cpus, platform, release, totalmem } from 'node:os';

/**
 * The runtime the benchmark runs on, read from the runtime itself: Bun sets `process.version` to a
 * Node.js version it is compatible with, so that alone would name the wrong one.
 */
export const runtime = (): string => {
  const bun: unknown = Reflect.get(process.versions, 'bun');

  return typeof bun === 'string' ? `Bun ${bun}` : `Node.js ${process.versions.node}`;
};

/**
 * One line that says where and when the numbers were taken: runtime, processor, memory, system and
 * date.
 */
export const environment = (): string => {
  const memory = `${Math.round(totalmem() / 1024 ** 3)} GB`;
  const system = platform() === 'darwin' ? `macOS ${macOsVersion()}` : `${platform()} ${release()}`;

  return `${runtime()}, ${cpus()[0]?.model ?? 'unknown CPU'} (${arch()}, ${memory}), ${system}, ${new Date().toISOString().slice(0, 10)}`;
};

const macOsVersion = (): string => {
  try {
    return execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim();
  } catch {
    return release();
  }
};

/**
 * Runs one benchmark script in a process of its own and returns the JSON it printed last, so no
 * library warms up, deoptimises or fills the heap for another.
 */
export const inOwnProcess = (script: string, ...args: string[]): unknown => {
  const output = execFileSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  return JSON.parse(output.trim().split('\n').at(-1) ?? 'null');
};

/**
 * The median of `runs` timings of `work` in milliseconds, after `warmUps` runs that are not
 * timed.
 */
export const medianOf = async (
  work: () => unknown,
  { warmUps = 3, runs = 9 }: { readonly warmUps?: number; readonly runs?: number } = {},
): Promise<number> => {
  for (let index = 0; index < warmUps; index += 1) {
    await work();
  }

  const times: number[] = [];

  for (let index = 0; index < runs; index += 1) {
    const started = performance.now();

    await work();
    times.push(performance.now() - started);
  }

  times.sort((left, right) => left - right);

  return times[Math.floor(times.length / 2)] ?? Number.NaN;
};
