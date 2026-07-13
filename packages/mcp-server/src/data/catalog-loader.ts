import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { getCatalogPath } from '@urbicon-ui/design-content';
import type {
  ComponentCatalog,
  ComponentCatalogEntry,
  RecipeEntry
} from '@urbicon-ui/design-engine/search';

// The catalog schema lives in the engine now (DESIGN-MCP-V2 §5) so the `urbicon`
// CLI's find/get-component and this server share one authoritative type. Imported
// above for the loader below; re-exported here for the server's many local
// importers (tools, resources, format-catalog) that still source it from here.
export type { ComponentCatalog, ComponentCatalogEntry, RecipeEntry };

let cachedCatalog: ComponentCatalog | null = null;
let watcherInitialized = false;

function initWatcher(): void {
  if (watcherInitialized) return;
  watcherInitialized = true;

  const catalogPath = getCatalogPath();
  try {
    watch(catalogPath, () => {
      cachedCatalog = null;
    });
  } catch {
    // File may not exist yet during initial setup — watcher will be retried on next load
    watcherInitialized = false;
  }
}

/**
 * Load and cache the assembled component catalog (the single source of truth,
 * auth components included). Unlike the read-tolerant loaders, this **throws**
 * on a missing or corrupt catalog by design — the server never serves a
 * silently empty or stale catalog. A file watcher invalidates the cache when
 * the catalog changes on disk (dev regeneration).
 */
export async function loadCatalog(): Promise<ComponentCatalog> {
  if (cachedCatalog) return cachedCatalog;

  // Single source of truth: the assembled catalog already contains the auth
  // package's components — docs-gen's MCPCatalogAssembler globs every package's
  // _catalog.json (auth/ included) into this one file. A missing or corrupt
  // catalog throws here by design; we never serve a silently-empty or stale
  // catalog. (Run `docs:gen:all`/`build` — not a single `docs:gen:<target>` —
  // to regenerate it after editing component metadata.)
  const raw = await readFile(getCatalogPath(), 'utf-8');
  cachedCatalog = JSON.parse(raw) as ComponentCatalog;

  initWatcher();

  return cachedCatalog;
}

/** The in-memory catalog if {@link loadCatalog} has run, else `null`. No I/O. */
export function getCachedCatalog(): ComponentCatalog | null {
  return cachedCatalog;
}
