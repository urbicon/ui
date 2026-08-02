/**
 * "Has this project decided its shape language?" — resolved project-side and handed
 * to the linter, the same "context as parameter" channel the manifest's token
 * overrides use.
 *
 * Why it cannot live in the engine: the library decides radius by component family
 * (`--radius-commit` / `-modify` / `-contain` / `-bridge`, see `principles.md`,
 * "Semantic Radius Tiers"), so a project that retunes a tier makes ONE declaration
 * in a stylesheet and every container follows. The linter, however, sees one
 * `.svelte` unit at a time and never the CSS — so `no-radius-strategy` fired at
 * exactly the projects that used the sanctioned mechanism, telling them to add the
 * per-element `rounded-*` overrides the anti-pattern forbids. Measured twice: eval
 * run B9b (which recorded the contradiction in its own manifest) and the
 * conformance reference fixture.
 *
 * Deliberately a *declaration* check, not a mention: `border-radius:
 * var(--radius-contain)` reads the token, it does not decide anything.
 */

import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/**
 * Directories never worth walking — for a project stylesheet here, and for the
 * `.svelte` collection in `validate.ts`, which shares this list. Narrowing it for
 * one purpose silently changes the other: the linted file set.
 */
export const SKIP_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  '.svelte-kit',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage'
]);

export const MAX_DEPTH = 24;

/** A tier-token *declaration* (not a mere reference) in a stylesheet. */
const TIER_DECLARATION = /--radius-(?:commit|modify|contain|bridge)\s*:/;

const STYLESHEET = /\.(?:css|pcss|postcss|scss|sass|less)$/;

/**
 * CSS comments, stripped before the declaration test. A commented-out token is the
 * opposite of a decision, and letting one match would disable the nudge project-wide
 * and *silently* — the expensive direction of a false negative, because nothing then
 * indicates that the check stopped applying.
 */
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

/** Does this stylesheet source declare a tier token outside of comments? */
export function declaresTier(css: string): boolean {
  return TIER_DECLARATION.test(css.replace(CSS_COMMENT, ''));
}

/**
 * Does any stylesheet under `root` declare a radius tier? Depth-limited, skipping
 * the usual build/vendor directories, short-circuiting on the first hit.
 *
 * Read tolerant: an unreadable root or file yields `false` for that branch, i.e.
 * exactly the behaviour before this check existed.
 */
export async function findShapeDecision(root: string, depth = 0): Promise<string | null> {
  if (depth > MAX_DEPTH) return null;
  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }
  // Files first: a theme file at the root of the scan is the common case, and
  // finding it there avoids walking the tree at all. `isFile()` is false for a
  // symlinked stylesheet (lstat semantics), so those are picked up by the
  // symlink branch — files only, never symlinked directories, which keeps the
  // walk cycle-free without bookkeeping.
  for (const entry of entries) {
    const isCandidate = entry.isFile() || entry.isSymbolicLink();
    if (!isCandidate || !STYLESHEET.test(entry.name)) continue;
    const path = join(root, entry.name);
    try {
      if (declaresTier(await readFile(path, 'utf-8'))) return path;
    } catch {
      // Unreadable stylesheet (or a dangling symlink): nothing we can see. Keep scanning.
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    const hit = await findShapeDecision(join(root, entry.name), depth + 1);
    if (hit !== null) return hit;
  }
  return null;
}

/**
 * The roots worth scanning for one `validate` run: the manifest's directory (the
 * project root by convention — what the hook and CI use) plus every directory the
 * caller passed, so validating a tree elsewhere than the cwd finds that tree's
 * stylesheets too. Deduplicated, short-circuiting on the first hit.
 */
export async function findShapeDecisionForRun(
  positionals: readonly string[],
  manifestPath: string
): Promise<string | null> {
  const roots = new Set<string>([dirname(manifestPath)]);
  for (const p of positionals) {
    if (p === '-') continue;
    const abs = resolve(p);
    try {
      if ((await stat(abs)).isDirectory()) roots.add(abs);
    } catch {
      // Unreadable path: the caller's own gather step reports it.
    }
  }
  for (const root of roots) {
    const hit = await findShapeDecision(root);
    if (hit !== null) return hit;
  }
  return null;
}
