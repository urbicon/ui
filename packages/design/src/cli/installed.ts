/**
 * Consumer-dependency awareness for `find` / `get-component`. The catalog is the
 * union of every `@urbicon-ui/*` package (blocks, table, auth, …), but a given
 * project installs only some of them — so a match like `Table` (from
 * `@urbicon-ui/table`) can be a dead end when only `blocks` is installed. These
 * helpers read the consumer's declared dependencies so the commands can mark an
 * entry's origin package and whether it is actually importable here.
 *
 * Only the CLI can do this: it runs inside the project. The remote MCP server is
 * stateless and never sees the consumer's `package.json`, so it can show the
 * origin package but not its install state.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies'
] as const;

/**
 * Walk up from `cwd` to the nearest `package.json` and collect every declared
 * dependency name. Returns `null` when none is found (no consumer context — e.g.
 * run from a scratch directory), which callers treat as "can't tell" rather than
 * "nothing installed".
 */
export function readConsumerDependencies(cwd: string = process.cwd()): Set<string> | null {
  let dir = resolve(cwd);
  const { root } = parse(dir);
  for (;;) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8')) as Record<
        string,
        unknown
      >;
      const names = new Set<string>();
      for (const field of DEP_FIELDS) {
        const deps = pkg[field];
        if (deps && typeof deps === 'object') {
          for (const name of Object.keys(deps as Record<string, unknown>)) names.add(name);
        }
      }
      return names;
    } catch {
      // Not in this dir (or unreadable) — keep walking up.
    }
    if (dir === root) return null;
    dir = dirname(dir);
  }
}

export type InstallState = 'installed' | 'missing' | 'unknown';

/**
 * Whether `pkg` is present in the consumer's dependency set. Returns `'unknown'`
 * — never `'missing'` — when we lack a reliable signal: no `package.json`, or one
 * that declares no `@urbicon-ui/*` package at all (so we're probably outside a real
 * consumer, e.g. a `bunx`-from-scratch run). This keeps us from stamping a
 * misleading "not installed" on every entry.
 */
export function installStateFor(pkg: string, deps: Set<string> | null): InstallState {
  if (!deps) return 'unknown';
  let hasUrbiconContext = false;
  for (const d of deps) {
    if (d.startsWith('@urbicon-ui/')) {
      hasUrbiconContext = true;
      break;
    }
  }
  if (!hasUrbiconContext) return 'unknown';
  return deps.has(pkg) ? 'installed' : 'missing';
}
