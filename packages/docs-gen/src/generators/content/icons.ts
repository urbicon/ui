/**
 * Parse the blocks icon registry (`icon-registry.ts`) into plain icon metadata for
 * the content bundle's `icons.json`. The registry imports `.svelte` components, so
 * it cannot be module-imported in a Node build — we extract the two data blocks
 * (`DEFAULT_ICONS`, `ICON_METADATA`) from source text. This runs at bundle time, so
 * the MCP server reads a ready `icons.json` instead of re-parsing TS at runtime.
 */

/**
 * One icon's metadata as it lands in the bundle's `icons.json` — the search
 * surface behind `urbicon icons` and the remote `find_icons` tool.
 */
export interface IconBundleEntry {
  /** Registry key, camelCase (e.g. `arrowRight`) — what `<Icon name="…">` accepts. */
  name: string;
  /** Exported Svelte component name (e.g. `ArrowRightIcon`) for direct imports. */
  componentName: string;
  /** Human-readable display label from `ICON_METADATA`. */
  label: string;
  /** Registry categories the icon is filed under (e.g. `navigation`). */
  categories: string[];
  /** Search keywords from `ICON_METADATA` (what fuzzy icon search matches). */
  keywords: string[];
}

/**
 * Parse the `DEFAULT_ICONS` block into a real `name → ComponentName` map.
 * Tolerant by design (returns an empty map when the block is absent) —
 * `parseIconRegistry` falls back to deriving the component name from the
 * icon name for any unmapped entry.
 */
export function parseComponentNames(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const start = content.indexOf('DEFAULT_ICONS');
  if (start === -1) return map;

  const end = content.indexOf('};', start);
  if (end === -1) return map;

  const block = content.slice(start, end);
  const regex = /(\w+):\s*(\w+Icon)/g;
  for (const match of block.matchAll(regex)) {
    map.set(match[1] ?? '', match[2] ?? '');
  }
  return map;
}

/**
 * Parse the icon registry source into bundle entries: `ICON_METADATA` drives
 * the entry list (label/categories/keywords per icon), `DEFAULT_ICONS`
 * supplies the component names (falling back to `name` + `Icon` capitalised
 * when unmapped). Returns an empty array when no `ICON_METADATA` block is
 * found — the emitter's icon count then makes the regression visible in the
 * `docs:gen:all` output.
 */
export function parseIconRegistry(content: string): IconBundleEntry[] {
  const componentNames = parseComponentNames(content);
  const entries: IconBundleEntry[] = [];

  const metadataStart = content.indexOf('ICON_METADATA');
  if (metadataStart === -1) return [];

  const entryRegex =
    /(\w+):\s*\{\s*label:\s*'([^']*)',\s*categories:\s*\[([^\]]*)\],\s*keywords:\s*\[([^\]]*)\]\s*\}/g;
  const block = content.slice(metadataStart);

  for (const match of block.matchAll(entryRegex)) {
    const name = match[1] ?? '';
    const label = match[2] ?? '';
    const categories = (match[3] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter((s) => s.length > 0);
    const keywords = (match[4] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter((s) => s.length > 0);

    const componentName =
      componentNames.get(name) ?? `${name.charAt(0).toUpperCase() + name.slice(1)}Icon`;

    entries.push({ name, componentName, label, categories, keywords });
  }

  return entries;
}
