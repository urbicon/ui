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
 * A keyword's rank inside its own list is a real signal: authors write the
 * closest synonym first. Worth well under a name hit, so it only ever decides
 * ties — which is exactly the case it exists for ("delete" hitting both `trash`
 * and `folderMinus`, where `trash` lists it first).
 */
const keywordPositionBonus = (index: number): number => Math.max(0, 1.5 - index * 0.25);

/**
 * Rank icons against a free-text query. Each query word scores on a name hit, a
 * keyword hit (exact ahead of partial), a label hit, and a category hit. Returns
 * the top `limit` entries with a positive score, best first.
 *
 * Two things this deliberately does *not* do, both learned from probing it with
 * real vocabulary:
 *
 * - **`componentName` is matched whole, never as a substring.** It is always
 *   `<name>Icon`, so a substring test adds nothing the name test doesn't already
 *   cover — but it does invent words at the seam: "MapIcon" contains "api", which
 *   put `map`, `graduationCap` and `plugZap` above `code` and `braces` for that
 *   query. The whole-string test keeps the case that matters (a component name
 *   pasted out of code) without the phantoms. It also stops the query "icon" from
 *   scoring every icon in the set.
 * - **Ties never fall back to registry order.** Equal scores are broken by the
 *   shorter name (the more generic icon is the likelier intent), then
 *   alphabetically, so the ranking is a property of the data rather than of when
 *   an icon happened to be added.
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
    const keywordsLower = entry.keywords.map((k) => k.toLowerCase());

    for (const kw of keywords) {
      if (nameLower === kw || componentLower === kw) {
        score += 10;
      } else if (nameLower.includes(kw)) {
        score += 7;
      }

      const exactAt = keywordsLower.indexOf(kw);
      if (exactAt >= 0) {
        score += 5 + keywordPositionBonus(exactAt);
      } else if (keywordsLower.some((k) => k.includes(kw))) {
        score += 3;
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
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.entry.name.length - b.entry.name.length ||
        a.entry.name.localeCompare(b.entry.name)
    )
    .slice(0, limit)
    .map((s) => s.entry);
}
