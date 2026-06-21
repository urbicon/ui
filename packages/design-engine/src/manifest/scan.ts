/**
 * Scan a source tree for `data-design-pattern="…"` markers. This is the
 * convention (analogous to the `data-guide` namespace) that makes pattern usage
 * greppable instead of guessable — the answer to DESIGN-SYSTEM-INTELLIGENCE.md's
 * "how does the LLM reliably find which pages follow a pattern?".
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { PatternUsage } from './types.js';

const SCANNED_EXT = /\.(svelte|html|tsx|jsx|astro|vue)$/;
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

const MARKER_RE = /data-design-pattern\s*=\s*["'`]([a-z0-9-]+)["'`]/g;

/** Recursion cap — guards against symlink loops; real source trees are far shallower. */
const MAX_DEPTH = 24;

/**
 * Recursively scan `dir` for marker usages. Files in the returned list are
 * relative to `baseDir` (default `dir`) so the manifest stays portable.
 */
export async function scanMarkers(
  dir: string,
  baseDir: string = dir,
  depth = 0
): Promise<PatternUsage[]> {
  const usages: PatternUsage[] = [];
  if (depth > MAX_DEPTH) return usages;

  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return usages;
  }

  for (const name of names) {
    const full = join(dir, name);
    const info = await stat(full).catch(() => null);
    if (!info) continue;

    if (info.isDirectory()) {
      if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
      usages.push(...(await scanMarkers(full, baseDir, depth + 1)));
    } else if (info.isFile() && SCANNED_EXT.test(name)) {
      let content: string;
      try {
        content = await readFile(full, 'utf-8');
      } catch {
        continue;
      }
      const seen = new Set<string>();
      for (const m of content.matchAll(MARKER_RE)) {
        const pattern = m[1]!;
        if (seen.has(pattern)) continue; // one entry per (pattern, file)
        seen.add(pattern);
        usages.push({ pattern, file: relative(baseDir, full).split(sep).join('/') });
      }
    }
  }

  return usages;
}
