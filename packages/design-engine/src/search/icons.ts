/**
 * The icon-metadata schema (`icons.json`, emitted by docs-gen from the blocks icon
 * registry) and its discovery matcher — shared by `urbicon icons` (CLI) and
 * `find_icons` (remote MCP) so local and remote icon knowledge agree. Pure and
 * dependency-free; consumers own the file I/O.
 */

export interface IconEntry {
  name: string;
  componentName: string;
  label: string;
  categories: string[];
  keywords: string[];
}

/** Category presentation order for grouped icon listings (CLI `icons` and MCP `find_icons`). */
export const ICON_CATEGORY_ORDER = [
  'navigation',
  'action',
  'status',
  'media',
  'communication',
  'data',
  'layout',
  'toggle'
] as const;

interface ScoredIcon {
  entry: IconEntry;
  score: number;
}

/**
 * Rank icons against a free-text query. Each query keyword scores on an exact /
 * substring name-or-component hit, a keyword hit, a label hit, and a category hit.
 * Returns the top `limit` entries with a positive score, best first.
 */
export function matchIcons(icons: IconEntry[], query: string, limit = 20): IconEntry[] {
  const keywords = query
    .toLowerCase()
    .split(/[\s,\-_]+/)
    .filter((w) => w.length > 1);

  const scored: ScoredIcon[] = icons.map((entry) => {
    let score = 0;
    const nameLower = entry.name.toLowerCase();
    const componentLower = entry.componentName.toLowerCase();
    const labelLower = entry.label.toLowerCase();

    for (const kw of keywords) {
      if (nameLower === kw) {
        score += 10;
      } else if (nameLower.includes(kw) || componentLower.includes(kw)) {
        score += 7;
      }
      if (entry.keywords.some((k) => k.toLowerCase().includes(kw))) {
        score += 5;
      }
      if (labelLower.includes(kw)) {
        score += 3;
      }
      if (entry.categories.some((c) => c.toLowerCase() === kw)) {
        score += 3;
      }
    }

    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}
