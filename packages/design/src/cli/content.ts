/**
 * The CLI's reader for the version-pinned `@urbicon-ui/design-content` bundle — the
 * Knowledge plane behind `urbicon find` / `get-component` / `pattern` / `principles`
 * / `icons` / `recipe`. It is the thin I/O layer between two shared pieces: the
 * catalog/icon *schemas* + search/parse logic live in `@urbicon-ui/design-engine`
 * (`search` + `reference`, one authoring, shared with the remote MCP server); the
 * bundle *location* comes from `@urbicon-ui/design-content`'s locators.
 * No watcher — the CLI is short-lived, unlike the long-running server.
 */

import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import {
  getCatalogPath,
  getComponentLlmPath,
  getDesignSystemDir,
  getGuideIndexPath,
  getGuidePath,
  getIconsPath
} from '@urbicon-ui/design-content';
import { type PatternEntry, parsePatternEntry } from '@urbicon-ui/design-engine/reference';
import type { ComponentCatalog, IconEntry } from '@urbicon-ui/design-engine/search';

const BUNDLE_MISSING =
  'design-content bundle missing — reinstall @urbicon-ui/design-content, or run `docs:gen:all` in the monorepo';

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
 * Load a component's raw `llm.txt`, searching each catalog group in turn. `null` when
 * absent in every group *but the bundle is present* (a genuine "unknown component"); a
 * non-ENOENT error (permission, corrupt mount) is surfaced; a wholly missing bundle
 * throws a clear "reinstall" error rather than masquerading as not-found — otherwise
 * the caller would steer the user to `urbicon find`, which fails the same way (read
 * tolerant on absence, strict on real faults).
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
  // Absent in every group. If the catalog is gone too, the whole bundle is missing —
  // surface that instead of reporting a genuine "unknown component".
  try {
    await readFile(getCatalogPath(), 'utf-8');
  } catch {
    throw new Error(BUNDLE_MISSING);
  }
  return null;
}

/** Load the bundled design principles (`design-system/principles.md`). Missing bundle throws (see `loadCatalog`). */
export async function loadPrinciplesText(): Promise<string> {
  ensureContentDir();
  try {
    return await readFile(resolve(getDesignSystemDir(), 'principles.md'), 'utf-8');
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') throw new Error(BUNDLE_MISSING);
    throw err;
  }
}

/** Load the bundled composition patterns (`design-system/patterns/*.md`), sorted by name. */
export async function loadPatternEntries(): Promise<PatternEntry[]> {
  ensureContentDir();
  const patternsDir = resolve(getDesignSystemDir(), 'patterns');

  let files: string[];
  try {
    files = await readdir(patternsDir);
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') throw new Error(BUNDLE_MISSING);
    throw err;
  }

  const entries: PatternEntry[] = [];
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const content = await readFile(resolve(patternsDir, file), 'utf-8');
    entries.push(parsePatternEntry(file.replace(/\.md$/, ''), content));
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

/** One entry of the bundled package-guide listing (`guides/index.json`). */
export interface GuideIndexEntry {
  slug: string;
  title: string;
  description: string;
}

/** Load the package-guide listing (`guides/index.json`). Missing bundle throws (see `loadCatalog`). */
export async function loadGuideIndex(): Promise<GuideIndexEntry[]> {
  ensureContentDir();
  try {
    return JSON.parse(await readFile(getGuideIndexPath(), 'utf-8')) as GuideIndexEntry[];
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') throw new Error(BUNDLE_MISSING);
    throw err;
  }
}

/**
 * Load one bundled package guide (`guides/<slug>.md`). `null` for a slug that
 * is simply not in the bundle (a genuine "unknown guide" — the caller lists
 * what exists); a wholly missing bundle throws the clear "reinstall" error.
 */
export async function loadGuideText(slug: string): Promise<string | null> {
  ensureContentDir();
  try {
    return await readFile(getGuidePath(slug), 'utf-8');
  } catch (err) {
    if ((err as { code?: string }).code !== 'ENOENT') throw err;
  }
  try {
    await readFile(getGuideIndexPath(), 'utf-8');
  } catch {
    throw new Error(BUNDLE_MISSING);
  }
  return null;
}

/** Load the bundled icon metadata (`icons.json`). Missing bundle throws (see `loadCatalog`). */
export async function loadIconEntries(): Promise<IconEntry[]> {
  ensureContentDir();
  try {
    return JSON.parse(await readFile(getIconsPath(), 'utf-8')) as IconEntry[];
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') throw new Error(BUNDLE_MISSING);
    throw err;
  }
}
