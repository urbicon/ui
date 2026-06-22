/**
 * `urbicon init` — wire a consumer project into the Urbicon UI design loop. This is
 * the content-free, mechanical half of onboarding (the guided intake is the
 * `urbicon verb adopt` / `onboard` recipe): it materialises the static scaffold
 * idempotently and non-destructively, then prints the next steps.
 *
 * - `AGENTS.md` — insert or refresh the `<!-- urbicon:start … end -->` context block.
 * - `design.manifest.md` — scaffold it when absent (never overwrites your intent).
 * - `--hook` — merge the PostToolUse `urbicon hook` into `.claude/settings.json`.
 * - `--ci` — write the design-gate workflow when absent.
 *
 * Re-running is safe: the AGENTS block is replaced in place, the hook is merged once,
 * and every other file is only created when missing.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { createManifestTemplate } from '@urbicon-ui/design-engine/manifest';
import { boolFlag, type Flags, stringFlag } from '../args.js';
import { resolveManifestPath } from '../manifest-io.js';
import { EXIT, printError } from '../output.js';
import { findPackageRoot } from '../package-root.js';

const BLOCK_START = '<!-- urbicon:start';
const BLOCK_END = '<!-- urbicon:end -->';

/** Read a packaged template (`templates/<name>`), or throw a clear error. */
async function readTemplate(name: string): Promise<string> {
  const root = await findPackageRoot();
  if (!root) throw new Error('could not locate the @urbicon-ui/design package root');
  return readFile(join(root, 'templates', name), 'utf-8');
}

/** Read a file, or null when it does not exist (read tolerant). */
async function readOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

/** Insert the block, or replace an existing one in place — idempotent across re-runs. */
function upsertBlock(existing: string, block: string): string {
  const startIdx = existing.indexOf(BLOCK_START);
  if (startIdx !== -1) {
    const endIdx = existing.indexOf(BLOCK_END, startIdx);
    if (endIdx !== -1) {
      return existing.slice(0, startIdx) + block.trim() + existing.slice(endIdx + BLOCK_END.length);
    }
  }
  const sep =
    existing.length === 0
      ? ''
      : existing.endsWith('\n\n')
        ? ''
        : existing.endsWith('\n')
          ? '\n'
          : '\n\n';
  return `${existing}${sep}${block.trim()}\n`;
}

/** Merge the PostToolUse `urbicon hook` into a settings.json — once, preserving the rest. */
async function mergeHook(settingsPath: string): Promise<'added' | 'present'> {
  const existing = await readOrNull(settingsPath);
  let settings: { hooks?: { PostToolUse?: unknown[] } };
  try {
    settings = existing ? JSON.parse(existing) : {};
  } catch {
    throw new Error('invalid JSON — merge templates/claude-settings.json by hand');
  }
  settings.hooks ??= {};
  settings.hooks.PostToolUse ??= [];
  if (JSON.stringify(settings.hooks.PostToolUse).includes('urbicon hook')) return 'present';
  settings.hooks.PostToolUse.push({
    matcher: 'Edit|MultiEdit|Write',
    hooks: [{ type: 'command', command: 'urbicon hook' }]
  });
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf-8');
  return 'added';
}

export async function runInit(_positionals: string[], flags: Flags): Promise<number> {
  const cwd = process.cwd();
  const rel = (p: string): string => relative(cwd, p) || p;
  const done: string[] = [];
  const skipped: string[] = [];

  // 1. AGENTS.md context block — idempotent upsert.
  let block: string;
  try {
    block = await readTemplate('AGENTS.md');
  } catch (err) {
    printError((err as Error).message);
    return EXIT.FAIL;
  }
  const agentsPath = resolve(stringFlag(flags, 'agents-file') ?? 'AGENTS.md');
  const existingAgents = (await readOrNull(agentsPath)) ?? '';
  const verb = existingAgents.includes(BLOCK_START)
    ? 'refreshed'
    : existingAgents
      ? 'added'
      : 'created';
  await writeFile(agentsPath, upsertBlock(existingAgents, block), 'utf-8');
  done.push(`${rel(agentsPath)} — ${verb} the Urbicon UI context block`);

  // 2. design.manifest.md scaffold — never overwrite recorded intent.
  const manifestPath = resolveManifestPath(stringFlag(flags, 'manifest'));
  if (await readOrNull(manifestPath)) {
    skipped.push(`${rel(manifestPath)} — already present (kept your intent)`);
  } else {
    await writeFile(manifestPath, createManifestTemplate({}), 'utf-8');
    done.push(`${rel(manifestPath)} — scaffolded`);
  }

  // 3. --hook: merge the edit-time gate into .claude/settings.json.
  if (boolFlag(flags, 'hook')) {
    const settingsPath = resolve('.claude', 'settings.json');
    try {
      const result = await mergeHook(settingsPath);
      (result === 'added' ? done : skipped).push(
        `${rel(settingsPath)} — ${result === 'added' ? 'wired' : 'already has'} the PostToolUse \`urbicon hook\``
      );
    } catch (err) {
      skipped.push(`${rel(settingsPath)} — skipped (${(err as Error).message})`);
    }
  }

  // 4. --ci: write the design-gate workflow when absent.
  if (boolFlag(flags, 'ci')) {
    const ciPath = resolve('.github', 'workflows', 'design-gate.yml');
    if (await readOrNull(ciPath)) {
      skipped.push(`${rel(ciPath)} — already present`);
    } else {
      const ci = await readTemplate('ci-github.yml');
      await mkdir(dirname(ciPath), { recursive: true });
      await writeFile(ciPath, ci, 'utf-8');
      done.push(`${rel(ciPath)} — wrote the design-gate workflow`);
    }
  }

  // Report + next steps.
  console.log('urbicon init — project wired into the design loop\n');
  for (const d of done) console.log(`  ✓ ${d}`);
  for (const s of skipped) console.log(`  · ${s}`);
  console.log('\nNext steps:');
  console.log(
    '  • Make sure your agent reads AGENTS.md (or paste the block into CLAUDE.md / .cursorrules).'
  );
  console.log(
    '  • Seed the design memory: `bunx urbicon verb adopt` (brownfield) or `onboard` (greenfield) — the guided intake.'
  );
  if (!boolFlag(flags, 'hook')) {
    console.log('  • Enforce at edit time: re-run with `--hook` to wire the PostToolUse gate.');
  }
  if (!boolFlag(flags, 'ci')) {
    console.log(
      '  • Enforce in CI: re-run with `--ci`, or add `bunx urbicon validate src/` to your pipeline.'
    );
  }
  return EXIT.OK;
}
