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

import type { Dirent } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
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
/** Matches the Tailwind 4 entry import in either quote style. */
const TAILWIND_IMPORT = /^\s*@import\s+['"]tailwindcss['"]/m;

/**
 * Find the project's Tailwind stylesheet by its *content* rather than its name, so the
 * next-steps output can point at the real file. Naming conventions differ across
 * scaffolds (`src/app.css` for `sv create --template demo`, `src/routes/layout.css` for
 * `minimal`), and a wrong path here is worse than no path: it sends the consumer to
 * create a stylesheet nothing imports.
 *
 * Returns a project-relative path, or `null` when nothing matches — callers then
 * describe the file instead of naming it. Bounded to `src/` and three levels deep:
 * this runs on every `init` and must not walk a whole repository.
 */
async function findTailwindStylesheet(cwd: string): Promise<string | null> {
  // Absent or unreadable is not an error here, just no answer.
  const entriesOf = async (dir: string): Promise<Dirent[]> => {
    try {
      return await readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
  };
  const walk = async (dir: string, depth: number): Promise<string | null> => {
    if (depth > 3) return null;
    const entries = await entriesOf(dir);
    const dirs: string[] = [];
    for (const e of entries) {
      const full = resolve(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && !e.name.startsWith('.')) dirs.push(full);
      } else if (e.isFile() && e.name.endsWith('.css')) {
        try {
          if (TAILWIND_IMPORT.test(await readFile(full, 'utf-8'))) return relative(cwd, full);
        } catch {
          // unreadable file — keep looking
        }
      }
    }
    for (const d of dirs) {
      const hit = await walk(d, depth + 1);
      if (hit) return hit;
    }
    return null;
  };
  return walk(resolve(cwd, 'src'), 0);
}

function tailwindSteps(deps: Set<string> | null, stylesheet: string | null): string[] {
  const has = (p: string): boolean => deps?.has(p) ?? false;
  const tailwindWired = has('@tailwindcss/vite') || has('tailwindcss');
  if (tailwindWired) {
    // Name the file we actually found. Telling everyone "your app.css" is wrong for
    // any project whose stylesheet lives elsewhere — `sv create --template minimal`
    // puts it in `src/routes/layout.css` — and following that advice creates a second
    // stylesheet the bundler never loads: every token silently resolves to nothing,
    // with no error anywhere. The obvious self-help from there is raw Tailwind colours,
    // i.e. exactly what the system exists to prevent.
    const where = stylesheet
      ? `\`${stylesheet}\``
      : "your Tailwind stylesheet (the file with `@import 'tailwindcss'`)";
    return [
      `  • Tailwind is installed — ensure ${where} has both imports, Tailwind first:`,
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

/**
 * The canonical PostToolUse entry `--hook` installs.
 *
 * The `bunx` prefix is load-bearing, not decoration. A hook command runs in a plain
 * `/bin/sh` whose PATH does not contain the project's `node_modules/.bin`, so the bare
 * `urbicon hook` exits 127 (`command not found`) and — because a non-zero exit that
 * isn't 2 is treated as a non-blocking hook error — lets every violation through while
 * the project looks gated. That failure is silent exactly where it matters: the agent
 * receives no exit-2 feedback, so the run is indistinguishable from "produced no
 * violations". Measured in the wild before this was fixed; the CI template has always
 * used `bunx` for the same reason. `hookCommandRuns` below accepts either form, so an
 * existing bare entry from an older `init` is repaired in place (see `LEGACY_HOOK_ENTRY`).
 */
const HOOK_ENTRY = {
  matcher: 'Edit|MultiEdit|Write',
  hooks: [{ type: 'command', command: 'bunx urbicon hook' }]
};

/**
 * The entry older versions of `init --hook` wrote, byte for byte. It exits 127 in a hook
 * shell and gates nothing, so every project scaffolded before the fix believes it is
 * gated and is not.
 *
 * This one shape is the single case where re-running `--hook` *rewrites* an existing
 * entry instead of keeping it. That is safe precisely because `init` wrote it: an exact
 * match is not a user customisation, it is our own defect. Anything else that runs the
 * gate some other way is still kept and reported — we genuinely cannot tell a deliberate
 * customisation from an outdated template there.
 */
const LEGACY_HOOK_ENTRY = {
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
 * rest. The canonical entry (in any key order) is `'present'`; the exact entry an older
 * `init` wrote is `'repaired'` (rewritten to the working command — see
 * `LEGACY_HOOK_ENTRY`); an entry that runs the gate some other way is `'kept'` — it is
 * either the user's deliberate customisation or an older template, and we cannot tell
 * which, so we never overwrite it and instead report how to adopt the current default.
 * Entries that do not run the gate at all are ignored, not mistaken for it.
 */
async function mergeHook(settingsPath: string): Promise<'added' | 'present' | 'kept' | 'repaired'> {
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
  const legacyAt = entries.findIndex((e) => sameJson(e, LEGACY_HOOK_ENTRY));
  const outcome: 'added' | 'repaired' = legacyAt === -1 ? 'added' : 'repaired';
  if (outcome === 'repaired') {
    entries[legacyAt] = HOOK_ENTRY;
  } else {
    if (entries.some(runsUrbiconHook)) return 'kept';
    entries.push(HOOK_ENTRY);
  }
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf-8');
  return outcome;
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
      } else if (result === 'repaired') {
        // Say what was wrong, not just that something changed: the consumer has been
        // running an ungated project believing otherwise, and that is worth a sentence.
        done.push(
          `${rel(settingsPath)} — repaired the PostToolUse hook (it ran bare \`urbicon hook\`, ` +
            'which exits 127 in a hook shell and gated nothing; now `bunx urbicon hook`)'
        );
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
  for (const line of tailwindSteps(readConsumerDependencies(), await findTailwindStylesheet(cwd)))
    console.log(line);
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
