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
import { readConsumerDependencies } from '../installed.js';
import { resolveManifestPath } from '../manifest-io.js';
import { EXIT, printError } from '../output.js';
import { findPackageRoot } from '../package-root.js';

const BLOCK_START = '<!-- urbicon:start';
const BLOCK_END = '<!-- urbicon:end -->';

/**
 * The primer step, added to the block on the way into a consumer's AGENTS.md —
 * and deliberately absent from the template itself.
 *
 * Two audiences read the same block, and only one of them can act on this step.
 * An agent inside a tool it does not control (Claude Code, Cursor) has no way to
 * put the primer in its context except by running the command, so it needs the
 * instruction. A harness that owns its system prompt (an `ArtifactFrame`, a chat
 * app) injects the primer's *content* there instead — for it the instruction is
 * not just noise but wrong, since there is nothing left to fetch.
 *
 * Keeping it here rather than in the template means the template stays a clean
 * prompt base that any harness can take verbatim, and neither side carries a
 * sentence that does not apply to it. The earlier attempts were worse: appending
 * "skip step 0" put an instruction and its retraction in one prompt, and phrasing
 * it conditionally ("if it isn't already in your context") made every reader
 * evaluate a condition that is decided long before the model sees it.
 */
const PRIMER_STEP = `0. **Load the primer** — \`bunx urbicon primer\`. How to pick a component plus the token
   reference, in one call. It applies to every task, so fetch it once up front.
`;

/**
 * Where the primer step goes: immediately before the first numbered step of the
 * loop. Anchored on the step's own text, and a missing anchor is a hard failure
 * rather than a silent no-op — a block that quietly lost its primer step would
 * cost the agent ten calls per session with nothing to point at.
 */
const LOOP_FIRST_STEP = '1. **Read the intent**';

function withPrimerStep(block: string): string {
  const at = block.indexOf(LOOP_FIRST_STEP);
  if (at === -1) {
    throw new Error(
      `the context block template has no "${LOOP_FIRST_STEP}" anchor — cannot place the primer step.`
    );
  }
  return `${block.slice(0, at)}${PRIMER_STEP}${block.slice(at)}`;
}

/**
 * The Tailwind 4 wiring step for the "next steps" output. Components emit Tailwind
 * utility classes (`bg-surface-base`, …) that need a backing build, so without this a
 * fresh project renders unstyled — and the `@source` on the blocks dist is the
 * non-obvious, easy-to-miss line that actually generates those classes. `init` only
 * scaffolds the design loop (it never edits `vite.config.ts`), so this is documented
 * rather than auto-wired; we tailor it to what's already installed.
 */
function tailwindSteps(deps: Set<string> | null): string[] {
  const has = (p: string): boolean => deps?.has(p) ?? false;
  const tailwindWired = has('@tailwindcss/vite') || has('tailwindcss');
  if (tailwindWired) {
    return [
      "  • Tailwind is installed — ensure your `app.css` has `@source '../node_modules/@urbicon-ui/blocks/dist';`",
      "    (relative to app.css) so the components' utility classes are generated. Easy to miss."
    ];
  }
  return [
    '  • Wire up Tailwind 4 — REQUIRED, or components render unstyled (they emit Tailwind classes):',
    '      1. bun add -D tailwindcss @tailwindcss/vite',
    '      2. vite.config.ts → add the `tailwindcss()` plugin',
    '      3. src/app.css →',
    "           @import 'tailwindcss';",
    "           @import '@urbicon-ui/blocks/style/index.css';",
    "           @source '../node_modules/@urbicon-ui/blocks/dist';   /* generates component classes */",
    "      4. import './app.css' in your root +layout.svelte"
  ];
}

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

/**
 * Insert the block, or replace an existing one in place. Returns the new content and
 * whether it replaced an existing block. Throws on a malformed managed region — a
 * `urbicon:start` with no matching `urbicon:end` — rather than silently appending a
 * second block (fail loud; the user truncated it, we don't guess the boundary).
 */
function upsertBlock(existing: string, block: string): { content: string; replaced: boolean } {
  const startIdx = existing.indexOf(BLOCK_START);
  if (startIdx !== -1) {
    const endIdx = existing.indexOf(BLOCK_END, startIdx);
    if (endIdx === -1) {
      throw new Error(
        `found an unterminated \`${BLOCK_START}\` marker (no \`${BLOCK_END}\`) — remove the partial block and re-run`
      );
    }
    const content =
      existing.slice(0, startIdx) + block.trim() + existing.slice(endIdx + BLOCK_END.length);
    return { content, replaced: true };
  }
  const sep =
    existing.length === 0
      ? ''
      : existing.endsWith('\n\n')
        ? ''
        : existing.endsWith('\n')
          ? '\n'
          : '\n\n';
  return { content: `${existing}${sep}${block.trim()}\n`, replaced: false };
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
  // A non-object (array, string, null) is valid JSON but the wrong shape: merging into
  // it would silently drop the hook on serialise. Refuse rather than fail silently.
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    throw new Error(
      'unexpected shape (not a JSON object) — merge templates/claude-settings.json by hand'
    );
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
  //
  // `--with-primer` defaults to ON: an agent that cannot reach its own system
  // prompt has no other way to get the primer, and that is the common case for
  // this command. Turn it off (`--with-primer=false`) when the block feeds a
  // harness that injects the primer content itself.
  const withPrimer = flags['with-primer'] === undefined ? true : boolFlag(flags, 'with-primer');
  let block: string;
  try {
    block = await readTemplate('AGENTS.md');
    if (withPrimer) block = withPrimerStep(block);
  } catch (err) {
    printError((err as Error).message);
    return EXIT.FAIL;
  }
  const agentsPath = resolve(stringFlag(flags, 'agents-file') ?? 'AGENTS.md');
  const existingAgents = (await readOrNull(agentsPath)) ?? '';
  let upserted: { content: string; replaced: boolean };
  try {
    upserted = upsertBlock(existingAgents, block);
  } catch (err) {
    printError(`${rel(agentsPath)}: ${(err as Error).message}`);
    return EXIT.FAIL;
  }
  await writeFile(agentsPath, upserted.content, 'utf-8');
  const verb = upserted.replaced ? 'refreshed' : existingAgents ? 'added' : 'created';
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
  for (const line of tailwindSteps(readConsumerDependencies())) console.log(line);
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
