/**
 * The CLI's reader for the version-pinned `@urbicon-ui/design-content` bundle — the
 * Knowledge plane behind `urbicon find` / `get-component`. It is the thin I/O layer
 * between two shared pieces: the catalog *schema* + search/parse logic live in
 * `@urbicon-ui/design-engine/search` (one authoring, shared with the remote MCP
 * server); the bundle *location* comes from `@urbicon-ui/design-content`'s locators.
 * No watcher — the CLI is short-lived, unlike the long-running server.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { getCatalogPath, getComponentLlmPath } from '@urbicon-ui/design-content';
import type { ComponentCatalog } from '@urbicon-ui/design-engine/search';

/** Catalog `group` dirs the per-component `llm.txt` files live under, in lookup order. */
const SEARCH_GROUPS = [
  'blocks/primitives',
  'blocks/components',
  'docs/components',
  'table',
  'auth/components'
];

let contentDirEnsured = false;

/**
 * Point `design-content`'s locators at the bundle on disk. `bun build` inlines
 * `design-content` into `dist/cli.js`, so its own `import.meta.url`-relative
 * resolution would land inside the CLI bundle, not at the installed content package.
 * Resolve the content package's real install dir (it ships `content/`) and hand it
 * to the locators via the supported `URBICON_CONTENT_DIR` override. Done once, and
 * only when unset — a monorepo dev run or an explicit test override still wins, and
 * an un-bundled run falls back to the locators' own (correct) resolution.
 */
function ensureContentDir(): void {
  if (contentDirEnsured) return;
  contentDirEnsured = true;
  if (process.env.URBICON_CONTENT_DIR) return;
  try {
    const require = createRequire(import.meta.url);
    const pkgJson = require.resolve('@urbicon-ui/design-content/package.json');
    process.env.URBICON_CONTENT_DIR = resolve(dirname(pkgJson), 'content');
  } catch {
    // Unusual install layout: leave the override unset and let the locators resolve
    // relative to design-content's own module URL (correct when the CLI is un-bundled).
  }
}

/**
 * Load and parse the component catalog. A missing or corrupt bundle throws by
 * design (the caller turns it into a clear "run docs:gen / reinstall" message) —
 * we never search a silently-empty catalog.
 */
export async function loadCatalog(): Promise<ComponentCatalog> {
  ensureContentDir();
  const raw = await readFile(getCatalogPath(), 'utf-8');
  return JSON.parse(raw) as ComponentCatalog;
}

/**
 * Load a component's raw `llm.txt`, searching each catalog group in turn. `null`
 * when absent in every group (a genuine "unknown component"); a non-ENOENT error
 * (permission, corrupt mount) is surfaced, not masked as not-found (read tolerant
 * on absence, strict on real faults).
 */
export async function loadComponentLlm(slug: string): Promise<string | null> {
  ensureContentDir();
  for (const group of SEARCH_GROUPS) {
    try {
      return await readFile(getComponentLlmPath(group, slug), 'utf-8');
    } catch (err) {
      if ((err as { code?: string }).code === 'ENOENT') continue;
      throw err;
    }
  }
  return null;
}
