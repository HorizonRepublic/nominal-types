import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

interface CallFrame {
  readonly functionName: string;
  readonly url: string;
  readonly lineNumber: number;
}

interface ProfileNode {
  readonly id: number;
  readonly callFrame: CallFrame;
}

interface CpuProfile {
  readonly nodes: readonly ProfileNode[];
  readonly samples: readonly number[];
  readonly timeDeltas: readonly number[];
}

const root = resolve(import.meta.dirname, '../..');
const [target, ...rest] = process.argv.slice(2);

if (target === undefined) {
  throw new Error('usage: npm run profile:cpu -- <script.ts> [arguments]');
}

const directory = mkdtempSync(join(tmpdir(), 'nominal-cpu-'));

execFileSync(
  process.execPath,
  ['--cpu-prof', `--cpu-prof-dir=${directory}`, '--cpu-prof-interval=50', target, ...rest],
  { stdio: 'inherit' },
);

const file = readdirSync(directory).find((name) => name.endsWith('.cpuprofile'));

if (file === undefined) {
  throw new Error('node wrote no profile');
}

const isProfile = (value: unknown): value is CpuProfile =>
  typeof value === 'object' &&
  value !== null &&
  ['nodes', 'samples', 'timeDeltas'].every((key) => Array.isArray(Reflect.get(value, key)));

const parsed: unknown = JSON.parse(readFileSync(join(directory, file), 'utf8'));

if (!isProfile(parsed)) {
  throw new Error('the profile has an unknown shape');
}

const profile = parsed;

rmSync(directory, { recursive: true });

const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
const selfTime = new Map<number, number>();

profile.samples.forEach((id, index) => {
  selfTime.set(id, (selfTime.get(id) ?? 0) + (profile.timeDeltas[index] ?? 0));
});

const where = (url: string): string => {
  if (url === '') {
    return 'native';
  }

  const path = url.startsWith('file://') ? new URL(url).pathname : url;
  const inPackages = /node_modules\/((?:@[^/]+\/)?[^/]+)/u.exec(path);

  if (inPackages !== null) {
    return `node_modules/${inPackages[1] ?? ''}`;
  }

  return path.startsWith(root) ? relative(root, path) : path;
};

const area = (location: string): string => {
  if (location.startsWith('src/')) {
    return location
      .split('/')
      .slice(0, location.startsWith('src/adapters/') ? 3 : 2)
      .join('/');
  }

  return location;
};

const byFunction = new Map<string, number>();
const byArea = new Map<string, number>();
let total = 0;

for (const [id, time] of selfTime) {
  const frame = nodes.get(id)?.callFrame;

  if (frame === undefined) {
    continue;
  }

  const location = where(frame.url);
  const name = frame.functionName === '' ? '(anonymous)' : frame.functionName;
  const key = frame.url === '' ? name : `${name}  ${location}:${String(frame.lineNumber + 1)}`;

  total += time;
  byFunction.set(key, (byFunction.get(key) ?? 0) + time);
  const place = frame.url === '' ? name : area(location);

  byArea.set(place, (byArea.get(place) ?? 0) + time);
}

const table = (title: string, rows: Map<string, number>, limit: number): void => {
  console.log(`\n${title}\n`);

  for (const [key, time] of [...rows].toSorted((a, b) => b[1] - a[1]).slice(0, limit)) {
    const share = ((time / total) * 100).toFixed(1).padStart(5);
    const ms = (time / 1000).toFixed(1).padStart(8);

    console.log(`${share}%  ${ms} ms  ${key}`);
  }
};

table('Self time by place', byArea, 15);
table('Self time by function', byFunction, 30);
