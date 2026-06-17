import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { getCatalogPath } from '../utils/paths.js';

export interface ComponentCatalogEntry {
  name: string;
  slug: string;
  package: string;
  group: 'primitives' | 'components' | 'core' | 'auth';
  description: string;
  tags: string[];
  import: string;
  llmTxtPath: string;
  variants: { name: string; values: string[]; default?: string }[];
  keyProps: string[];
  keyPropTypes: Record<string, string>;
  slots: string[];
  hasExamples: boolean;
  relatedComponents: string[];
}

export interface RecipeEntry {
  id: string;
  title: string;
  description: string;
  components: string[];
  code: string;
  features: string[];
  /** Layer-4 composition pattern this recipe is an instance of (e.g. "dashboard"). Cross-links to `get_pattern`. */
  pattern?: string;
}

export interface ComponentCatalog {
  generated: string;
  version: string;
  components: ComponentCatalogEntry[];
  recipes: RecipeEntry[];
  tags: string[];
}

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

export function getCachedCatalog(): ComponentCatalog | null {
  return cachedCatalog;
}
