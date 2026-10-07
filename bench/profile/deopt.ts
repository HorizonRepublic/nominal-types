import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const [target, ...rest] = process.argv.slice(2);

if (target === undefined) {
  throw new Error('usage: npm run profile:deopt -- <script.ts> [arguments]');
}

const keywords = new Set([
  'if',
  'for',
  'while',
  'switch',
  'return',
  'catch',
  'function',
  'constructor',
]);

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(directory, entry.name))
      : entry.name.endsWith('.ts')
        ? [join(directory, entry.name)]
        : [],
  );

const ownNames = new Set(
  sourceFiles(join(root, 'src')).flatMap((file) =>
    [
      ...readFileSync(file, 'utf8').matchAll(
        /(?:const|function|class)\s+([A-Za-z_$][\w$]*)|^\s+(?:public |private |protected |static |readonly |get |#)*([A-Za-z_$#][\w$]*)\s*\(/gmu,
      ),
    ]
      .flatMap((match) => [match[1], match[2]])
      .filter((name): name is string => name !== undefined && !keywords.has(name)),
  ),
);

const { stdout } = spawnSync(process.execPath, ['--trace-opt', '--trace-deopt', target, ...rest], {
  encoding: 'utf8',
  maxBuffer: 1024 * 1024 * 512,
});

const functionOf = (line: string): string => /<JSFunction ([^ >]*)/u.exec(line)?.[1] ?? '?';

const optimized = new Map<string, number>();
const deopts = new Map<string, number>();

for (const line of stdout.split('\n')) {
  const name = functionOf(line);

  if (!ownNames.has(name)) {
    continue;
  }

  if (line.startsWith('[completed optimizing') || line.startsWith('[completed compiling')) {
    optimized.set(name, (optimized.get(name) ?? 0) + 1);
  }

  const bailout = /^\[bailout \(kind: ([^,]+), reason: ([^)]+)\)/u.exec(line);

  if (bailout !== null) {
    const key = `${name}: ${bailout[1] ?? ''}, ${bailout[2] ?? ''}`;

    deopts.set(key, (deopts.get(key) ?? 0) + 1);
  }
}

const print = (title: string, rows: Map<string, number>): void => {
  console.log(`\n${title}\n`);

  if (rows.size === 0) {
    console.log('  none');
  }

  for (const [key, count] of [...rows].toSorted((a, b) => b[1] - a[1])) {
    console.log(`${String(count).padStart(5)}  ${key}`);
  }
};

print('Deoptimised functions of this package (count: function: kind, reason)', deopts);
console.log(
  '\n  Anonymous closures are not listed: V8 names them by nothing. Name a hot closure to see it.',
);
print('Optimised functions of this package (count: function)', optimized);
