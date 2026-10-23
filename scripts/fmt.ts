#!/usr/bin/env bun
/**
 * fmt — `bun fmt` over the tracked `.svelte` and `.md` files below the working
 * directory. Biome formats every other file; unscoped, `bun fmt` would format
 * those too. Arguments go through to `bun fmt` (`--check`).
 *
 * - The file list comes from git because `bun fmt` reads `.gitignore` and
 *   `.prettierignore` from the working directory only: run from the root it
 *   misses nested ignore files, run from a package it formats what the root
 *   `.gitignore` excludes (`coverage/`, `test-results/`).
 * - `--ignore-path` makes the root `.prettierignore` the one exemption list from
 *   any directory; its patterns resolve against the file, not the cwd.
 * - git lists symlinks, and `bun fmt` exits 2 on an explicit symlink instead of
 *   writing through it. `--no-error-on-unmatched-pattern` skips them; their
 *   targets are tracked under their own paths.
 * - `--no-script`: in the root, `bun fmt` runs the `fmt` script, which is this
 *   file, so without it the call recurses.
 */
import { join } from 'node:path';

const root = join(import.meta.dir, '..');

// Positive control. `bun fmt` sorts Tailwind classes only while `.prettierrc`
// lists `prettier-plugin-tailwindcss` and a `tailwindcss` package resolves
// upward from the file; without either it leaves them unsorted and `--check`
// passes them. Without the `prettier-plugin-svelte` entry it formats no
// `.svelte` at all, so the probe fails then too.
const probe = Bun.spawnSync(
  [process.execPath, 'fmt', '--no-script', `--stdin-filepath=${join(root, 'fmt-probe.svelte')}`],
  { stdin: new Blob(['<div class="p-4 flex"></div>\n']) }
);
if (!probe.stdout.toString().includes('class="flex p-4"')) {
  console.error(
    'fmt: bun fmt left the Tailwind classes of its probe unsorted — is `tailwindcss` ' +
      'installed (`bun install`) and does `.prettierrc` list both plugins?\n' +
      `probe output: ${probe.stdout}${probe.stderr}`
  );
  process.exit(1);
}

const listed = Bun.spawnSync(['git', 'ls-files', '-z', '--', '*.svelte', '*.md']);
if (listed.exitCode !== 0) throw new Error(`fmt: git ls-files failed: ${listed.stderr}`);
const files = listed.stdout.toString().split('\0').filter(Boolean);

// With no file argument `bun fmt` formats the whole directory, `.ts` included.
if (files.length === 0) {
  console.log('fmt: no tracked .svelte or .md file below this directory');
  process.exit(0);
}

const fmt = Bun.spawn(
  [
    process.execPath,
    'fmt',
    '--no-script',
    '--no-error-on-unmatched-pattern',
    '--ignore-path',
    join(root, '.prettierignore'),
    ...process.argv.slice(2),
    ...files
  ],
  { stdio: ['inherit', 'inherit', 'inherit'] }
);
process.exit(await fmt.exited);
