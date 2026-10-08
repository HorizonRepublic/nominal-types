import path from 'node:path';
import { parseArgs } from 'node:util';

import { check } from './src/index.ts';

const usage = `Usage: throws-check --project tsconfig.json [--include 'src/**/*.ts']
  [--report-unresolved] [--allow-unused-supertypes]
`;

const { values } = parseArgs({
  options: {
    project: { type: 'string', short: 'p', default: 'tsconfig.json' },
    include: { type: 'string', multiple: true },
    'report-unresolved': { type: 'boolean', default: false },
    'allow-unused-supertypes': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  process.stdout.write(usage);
} else {
  const started = performance.now();
  const diagnostics = check({
    project: values.project,
    include: values.include ?? [],
    reportUnresolved: values['report-unresolved'],
    allowUnusedSupertypes: values['allow-unused-supertypes'],
  });
  const seconds = ((performance.now() - started) / 1000).toFixed(1);

  for (const { file, line, column, code, message } of diagnostics) {
    process.stdout.write(
      `${path.relative(process.cwd(), file)}:${line}:${column} ${message} (${code})\n`,
    );
  }

  const plural = diagnostics.length === 1 ? '' : 's';

  process.stderr.write(`${diagnostics.length} problem${plural} in ${seconds}s\n`);
  process.exitCode = diagnostics.length > 0 ? 1 : 0;
}
