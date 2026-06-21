/**
 * `urbicon validate [paths...]` — the deterministic design gate, and the entry
 * point a `PostToolUse` hook or CI step calls. Lints `.svelte` markup with the
 * shared `@urbicon-ui/design-engine` linter (same engine as the remote
 * `validate_design` MCP tool, so local and remote verdicts agree).
 *
 * Paths may be files, directories (recursively scanned for `.svelte`), or `-`
 * (stdin). Exit: 0 = clean / notes only, 1 = errors (or warnings under
 * `--strict`), 2 = unreadable input or nothing to lint.
 */

import type { Dirent, Stats } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import type { LintReport } from '@urbicon-ui/design-engine/linter';
import { lintDesign } from '@urbicon-ui/design-engine/linter';
import { boolFlag, type Flags } from '../args.js';
import { EXIT, formatReport, printError } from '../output.js';

const SKIP_DIRS = new Set([
  'node_modules',
  '.svelte-kit',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage'
]);
const MAX_DEPTH = 24;

interface Unit {
  label: string;
  code: string;
}

/** Project-relative, forward-slashed label for a file, for stable report output. */
function label(abs: string): string {
  return relative(process.cwd(), abs).split(sep).join('/') || abs;
}

async function collectSvelte(dir: string, depth = 0): Promise<string[]> {
  if (depth > MAX_DEPTH) return [];
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      files.push(...(await collectSvelte(join(dir, entry.name), depth + 1)));
    } else if (entry.isFile() && entry.name.endsWith('.svelte')) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

/** Resolve positionals into lintable units, or null on an unreadable path. */
async function gather(positionals: string[]): Promise<Unit[] | null> {
  if (positionals.length === 0 || (positionals.length === 1 && positionals[0] === '-')) {
    return [{ label: '<stdin>', code: await readStdin() }];
  }
  const units: Unit[] = [];
  for (const p of positionals) {
    if (p === '-') {
      units.push({ label: '<stdin>', code: await readStdin() });
      continue;
    }
    const abs = resolve(p);
    let info: Stats;
    try {
      info = await stat(abs);
    } catch {
      printError(`cannot read "${p}"`);
      return null;
    }
    if (info.isDirectory()) {
      for (const file of await collectSvelte(abs)) {
        units.push({ label: label(file), code: await readFile(file, 'utf-8') });
      }
    } else {
      units.push({ label: label(abs), code: await readFile(abs, 'utf-8') });
    }
  }
  return units;
}

export async function runValidate(positionals: string[], flags: Flags): Promise<number> {
  const asJson = boolFlag(flags, 'json');
  const strict = boolFlag(flags, 'strict');
  const skipHeuristics = boolFlag(flags, 'skip-heuristics');

  const units = await gather(positionals);
  if (units === null) return EXIT.USAGE;
  if (units.length === 0) {
    printError('no .svelte files found to validate');
    return EXIT.USAGE;
  }

  const reports: LintReport[] = units.map((unit) =>
    lintDesign(unit.code, { filename: unit.label, skipHeuristics })
  );

  const totals = reports.reduce(
    (acc, r) => {
      acc.error += r.counts.error;
      acc.warning += r.counts.warning;
      acc.info += r.counts.info;
      return acc;
    },
    { error: 0, warning: 0, info: 0 }
  );
  const failed = totals.error > 0 || (strict && totals.warning > 0);

  if (asJson) {
    console.log(JSON.stringify({ ok: !failed, strict, results: reports }, null, 2));
    return failed ? EXIT.FAIL : EXIT.OK;
  }

  for (const report of reports) console.log(formatReport(report));
  if (reports.length > 1) {
    console.log(
      `\n${reports.length} file(s) · ${totals.error} error(s), ` +
        `${totals.warning} warning(s), ${totals.info} note(s)`
    );
  }
  if (failed) {
    console.log(
      strict ? '\nFAIL — errors or warnings present (--strict).' : '\nFAIL — fix the errors above.'
    );
  }
  return failed ? EXIT.FAIL : EXIT.OK;
}
