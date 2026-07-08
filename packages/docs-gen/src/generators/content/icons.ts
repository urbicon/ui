/**
 * Parse the blocks icon registry (`icon-registry.ts`) into plain icon metadata for
 * the content bundle's `icons.json`. The registry imports `.svelte` components, so
 * it cannot be module-imported in a Node build — we extract the two data blocks
 * (`DEFAULT_ICONS`, `ICON_METADATA`) from source text. This runs at bundle time, so
 * the MCP server reads a ready `icons.json` instead of re-parsing TS at runtime.
 */

export interface IconBundleEntry {
  name: string;
  componentName: string;
  label: string;
  categories: string[];
  keywords: string[];
}

/** Parse `DEFAULT_ICONS` → a real `name → ComponentName` map. */
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

/** Parse `ICON_METADATA` (+ the `DEFAULT_ICONS` mapping) into bundle entries. */
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
