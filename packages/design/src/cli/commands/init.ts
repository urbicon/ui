/**
 * `urbicon init` — wire a consumer project into the Urbicon UI design loop. This is
 * the content-free, mechanical half of onboarding (the guided intake is the
 * `urbicon verb adopt` / `onboard` recipe): it materialises the static scaffold
 * idempotently and non-destructively, then prints the next steps.
 *
 * - Context block — insert or refresh the `<!-- urbicon:start … end -->` block, stamped
 *   with the CLI version so `urbicon context` can flag it as stale after an upgrade.
 *   A plain re-run finds the block wherever it lives (AGENTS.md or CLAUDE.md, in the
 *   project's casing) and refreshes it in place rather than writing a second copy.
 * - `design.manifest.md` — scaffold it when absent (never overwrites your intent).
 * - `--hook` — merge the PostToolUse `urbicon hook` into `.claude/settings.json`.
 * - `--ci` — write the design-gate workflow when absent.
 *
 * Re-running is safe: the context block is replaced in place, the hook is merged once,
 * and every other file is only created when missing. A hook entry or workflow that
 * diverged from the current template is kept and reported — we cannot tell a
 * deliberate customisation from an outdated template, so we never overwrite either.
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { createManifestTemplate } from '@urbicon-ui/design-engine/manifest';
import {
  AGENTS_NAME,
  BLOCK_END,
  BLOCK_START,
  CLAUDE_NAME,
  sameFile,
  scanAgentsFiles,
  stampBlockVersion,
  withPrimerStep
} from '../agents-block.js';
import { boolFlag, type Flags, stringFlag } from '../args.js';
import { readConsumerDependencies } from '../installed.js';
import { resolveManifestPath } from '../manifest-io.js';
import { EXIT, printError } from '../output.js';
import { readPackageVersion, readTemplate } from '../package-root.js';

/**
 * The Tailwind 4 wiring step for the "next steps" output. Components emit Tailwind
 * utility classes (`bg-surface-base`, …) that need a backing build, so without this a
 * fresh project renders unstyled. The blocks `style/index.css` ships its own `@source`
 * directives for the packaged dist, so importing it (rather than the
 * foundation/semantic/interaction subfiles) is what makes Tailwind scan the component
 * classes — no consumer-side `@source` needed. `init` only scaffolds the design loop
 * (it never edits `vite.config.ts`), so this is documented rather than auto-wired; we
 * tailor it to what's already installed.
 */
function tailwindSteps(deps: Set<string> | null): string[] {
  const has = (p: string): boolean => deps?.has(p) ?? false;
  const tailwindWired = has('@tailwindcss/vite') || has('tailwindcss');
  if (tailwindWired) {
    return [
      '  • Tailwind is installed — ensure your `app.css` has both imports, Tailwind first:',
      "      @import 'tailwindcss';",
      "      @import '@urbicon-ui/blocks/style/index.css';   /* tokens + the component @source directives */"
    ];
  }
  return [
    '  • Wire up Tailwind 4 — REQUIRED, or components render unstyled (they emit Tailwind classes):',
    '      1. bun add -D tailwindcss @tailwindcss/vite',
    '      2. vite.config.ts → add the `tailwindcss()` plugin',
    '      3. src/app.css →',
    "           @import 'tailwindcss';",
    "           @import '@urbicon-ui/blocks/style/index.css';   /* tokens + the component @source directives */",
    "      4. import './app.css' in your root +layout.svelte"
  ];
}

/**
 * Line-ending- and trailing-whitespace-insensitive equality basis for the CI
 * template compare: a formatter or editor that only touches trailing whitespace
 * must not make the workflow read as "differs from the current template" forever
 * — that message's advice (re-run --ci to adopt the update) would be wrong.
 */
function normalizeWhitespace(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
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
 * `urbicon:start` with no matching `urbicon:end`, or more than one block — rather
 * than guessing (fail loud; refreshing only the first of two blocks would leave the
 * other to drift silently).
 */
function upsertBlock(existing: string, block: string): { content: string; replaced: boolean } {
  const startIdx = existing.indexOf(BLOCK_START);
  if (startIdx !== -1) {
    if (existing.indexOf(BLOCK_START, startIdx + BLOCK_START.length) !== -1) {
      throw new Error(
        `found more than one \`${BLOCK_START}\` marker — remove the extra block(s) and re-run`
      );
    }
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

/** The canonical PostToolUse entry `--hook` installs. */
const HOOK_ENTRY = {
  matcher: 'Edit|MultiEdit|Write',
  hooks: [{ type: 'command', command: 'urbicon hook' }]
};

/** Key-order-independent structural equality, for comparing small JSON values. */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => sameJson(v, b[i]))
    );
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return (
      ka.length === kb.length &&
      ka.every(
        (k, i) =>
          k === kb[i] &&
          sameJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
      )
    );
  }
  return false;
}

/**
 * A command that actually runs the gate: `urbicon hook`, including runner-prefixed
 * (`bunx urbicon hook`) and flagged (`urbicon hook --strict`) forms. Anchored at
 * the start so an unrelated command that merely mentions the words — say
 * `echo "urbicon hook todo"` — is not mistaken for the gate.
 */
const HOOK_COMMAND_RE = /^(?:(?:bunx|npx|bun x)\s+)?urbicon\s+hook(?:\s|$)/;

/** Whether a PostToolUse entry runs the `urbicon hook` gate in any of its hooks. */
function runsUrbiconHook(entry: unknown): boolean {
  const hooks = (entry as { hooks?: unknown[] } | null)?.hooks;
  return (
    Array.isArray(hooks) &&
    hooks.some((h) => {
      const cmd = (h as { command?: unknown } | null)?.command;
      return typeof cmd === 'string' && HOOK_COMMAND_RE.test(cmd);
    })
  );
}

/**
 * Merge the PostToolUse `urbicon hook` into a settings.json — once, preserving the
 * rest. The canonical entry (in any key order) is `'present'`; an entry that runs
 * the gate some other way is `'kept'` — it is either the user's deliberate
 * customisation or an older template, and we cannot tell which, so we never
 * overwrite it and instead report how to adopt the current default. Entries that
 * do not run the gate at all are ignored, not mistaken for it.
 */
async function mergeHook(settingsPath: string): Promise<'added' | 'present' | 'kept'> {
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
  const entries = settings.hooks.PostToolUse;
  if (entries.some((e) => sameJson(e, HOOK_ENTRY))) return 'present';
  if (entries.some(runsUrbiconHook)) return 'kept';
  entries.push(HOOK_ENTRY);
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf-8');
  return 'added';
}

export async function runInit(_positionals: string[], flags: Flags): Promise<number> {
  const cwd = process.cwd();
  const rel = (p: string): string => relative(cwd, p) || p;
  const done: string[] = [];
  const skipped: string[] = [];
  const hints: string[] = [];

  // 1. Context block — idempotent upsert, stamped with the CLI version so
  // `urbicon context` can flag a stale block after an upgrade.
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
  const version = await readPackageVersion();
  if (version !== 'unknown') block = stampBlockVersion(block, version);

  // Where the block goes: an explicit `--agents-file` always wins. Otherwise the
  // file that already carries the block — a project initialised into CLAUDE.md
  // must be refreshed there on a plain re-run, not given a second copy in a
  // fresh AGENTS.md — else an existing AGENTS.md in whatever casing the project
  // uses (see scanAgentsFiles), else a new canonical AGENTS.md. The scan itself
  // always runs: the duplicate report and the pointer hints below must not go
  // blind just because the target was pinned.
  const explicit = stringFlag(flags, 'agents-file');
  const scanned = await scanAgentsFiles(cwd);
  const carrier = scanned.find((f) => f.hasBlock);
  const agentsNamed = scanned.find((f) => AGENTS_NAME.test(f.name));
  const agentsPath =
    explicit !== undefined
      ? resolve(explicit)
      : ((carrier ?? agentsNamed)?.path ?? resolve('AGENTS.md'));

  // Read the target fail-loud: `readOrNull` here would turn an unreadable —
  // but writable — existing file into '' and silently clobber it on write. Only
  // a genuinely absent target may read as empty.
  let existingAgents = '';
  try {
    if ((await stat(agentsPath)).isDirectory()) {
      printError(`${rel(agentsPath)} is a directory — remove it or pass --agents-file`);
      return EXIT.FAIL;
    }
    existingAgents = await readFile(agentsPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      printError(`${rel(agentsPath)}: cannot read (${(err as Error).message}) — fix it and re-run`);
      return EXIT.FAIL;
    }
  }
  let upserted: { content: string; replaced: boolean };
  try {
    upserted = upsertBlock(existingAgents, block);
  } catch (err) {
    printError(`${rel(agentsPath)}: ${(err as Error).message}`);
    return EXIT.FAIL;
  }
  await writeFile(agentsPath, upserted.content, 'utf-8');
  const verb = upserted.replaced ? 'refreshed' : existingAgents ? 'added' : 'created';
  const stamp = version === 'unknown' ? '' : ` (v${version})`;
  done.push(`${rel(agentsPath)} — ${verb} the Urbicon UI context block${stamp}`);

  const targetName = basename(agentsPath);
  for (const f of scanned) {
    if (await sameFile(f.path, agentsPath)) continue;
    if (f.hasBlock) {
      // A second copy of the block in another context file would drift silently
      // the moment this one is refreshed — surface it on every run until gone.
      skipped.push(
        `${rel(f.path)} — also carries an urbicon block; remove it (the managed one lives in ${rel(agentsPath)})`
      );
    } else if (!f.content.toLowerCase().includes(targetName.toLowerCase())) {
      // A context file that never mentions the block's file, in either direction
      // (CLAUDE.md beside an AGENTS.md carrier, or AGENTS.md beside a CLAUDE.md
      // carrier): an agent that reads only that file misses the block, and
      // nothing else would ever say so.
      const moveTip =
        CLAUDE_NAME.test(f.name) && AGENTS_NAME.test(targetName)
          ? `, or re-run with \`--agents-file ${f.name}\``
          : '';
      hints.push(
        `  • ${f.name} never mentions ${targetName} — an agent that reads only ${f.name} ` +
          `will miss the block. Add a pointer there${moveTip}.`
      );
    }
  }

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
      if (result === 'added') {
        done.push(`${rel(settingsPath)} — wired the PostToolUse \`urbicon hook\``);
      } else if (result === 'present') {
        skipped.push(`${rel(settingsPath)} — already has the PostToolUse \`urbicon hook\``);
      } else {
        skipped.push(
          `${rel(settingsPath)} — has a customised \`urbicon hook\` entry (kept yours; delete it and re-run --hook for the current default)`
        );
      }
    } catch (err) {
      skipped.push(`${rel(settingsPath)} — skipped (${(err as Error).message})`);
    }
  }

  // 4. --ci: write the design-gate workflow when absent; an existing one is
  // compared against the template so an outdated copy is at least visible.
  if (boolFlag(flags, 'ci')) {
    const ciPath = resolve('.github', 'workflows', 'design-gate.yml');
    try {
      const template = await readTemplate('ci-github.yml');
      const existingCi = await readOrNull(ciPath);
      if (existingCi === null) {
        await mkdir(dirname(ciPath), { recursive: true });
        await writeFile(ciPath, template, 'utf-8');
        done.push(`${rel(ciPath)} — wrote the design-gate workflow`);
      } else if (normalizeWhitespace(existingCi) === normalizeWhitespace(template)) {
        skipped.push(`${rel(ciPath)} — already present (matches the current template)`);
      } else {
        // Customised or written by an older template — indistinguishable, so we
        // keep it and say so rather than silently reporting "already present".
        skipped.push(
          `${rel(ciPath)} — differs from the current template (kept yours; delete it and re-run --ci to adopt the update)`
        );
      }
    } catch (err) {
      printError((err as Error).message);
      return EXIT.FAIL;
    }
  }

  // Report + next steps.
  console.log('urbicon init — project wired into the design loop\n');
  for (const d of done) console.log(`  ✓ ${d}`);
  for (const s of skipped) console.log(`  · ${s}`);
  console.log('\nNext steps:');
  for (const line of tailwindSteps(readConsumerDependencies())) console.log(line);
  const pasteTargets = ['CLAUDE.md', '.cursorrules']
    .filter((n) => n.toLowerCase() !== targetName.toLowerCase())
    .join(' / ');
  console.log(
    `  • Make sure your agent reads ${targetName} (or paste the block into ${pasteTargets}).`
  );
  for (const h of hints) console.log(h);
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
