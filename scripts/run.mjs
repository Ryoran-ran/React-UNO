import { spawn } from 'node:child_process';
const targets = {
  dev: ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'],
  preview: ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1'],
  test: ['node_modules/vitest/vitest.mjs', 'run'],
  'test:watch': ['node_modules/vitest/vitest.mjs'],
};
const mode = process.argv[2] ?? 'dev';
const run = args => new Promise(resolve => { const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env }); child.on('error', error => { console.error(error.message); resolve(1); }); child.on('exit', code => resolve(code ?? 1)); });
if (mode === 'build') {
  const checked = await run(['node_modules/typescript/bin/tsc', '-b']);
  process.exitCode = checked || await run(['node_modules/vite/bin/vite.js', 'build']);
} else if (targets[mode]) process.exitCode = await run([...targets[mode], ...process.argv.slice(3)]);
else { console.error(`Unknown command: ${mode}`); process.exitCode = 1; }
