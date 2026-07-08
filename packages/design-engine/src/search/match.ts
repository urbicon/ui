import type { ComponentCatalogEntry } from './types.js';

interface ScoredEntry {
  entry: ComponentCatalogEntry;
  score: number;
}

/**
 * Rank catalog entries against a free-text query — the component-discovery ranker
 * behind both `find_components` (remote MCP) and `urbicon find` (CLI), so local and
 * remote discovery agree. Pure and dependency-free: each query keyword scores on an
 * exact / substring / fuzzy (Levenshtein ≤ 2) name-or-slug hit, a tag hit, a
 * description hit, and a weak prop-name hit; an explicit `tags` filter adds weight.
 * Keywords shorter than two characters are dropped. Returns the top `limit` entries
 * with a positive score, best first; an empty list when nothing matches.
 */
export function matchComponents(
  components: ComponentCatalogEntry[],
  query: string,
  tags?: string[],
  limit = 5
): ComponentCatalogEntry[] {
  const keywords = query
    .toLowerCase()
    .split(/[\s,\-_]+/)
    .filter((w) => w.length > 1);

  const scored: ScoredEntry[] = components.map((entry) => {
    let score = 0;
    const nameLower = entry.name.toLowerCase();
    const slugLower = entry.slug.toLowerCase();
    const descLower = entry.description.toLowerCase();

    for (const kw of keywords) {
      // Exact match
      if (nameLower === kw || slugLower === kw) {
        score += 10;
      } else if (nameLower.includes(kw) || slugLower.includes(kw)) {
        score += 7;
      } else {
        // Fuzzy match on name/slug (Levenshtein distance <= 2)
        const nameDist = levenshtein(nameLower, kw);
        const slugDist = levenshtein(slugLower, kw);
        const minDist = Math.min(nameDist, slugDist);
        if (minDist <= 1) {
          score += 6;
        } else if (minDist <= 2) {
          score += 3;
        }
      }

      // Tag match
      if (entry.tags.some((t) => t.toLowerCase() === kw)) {
        score += 5;
      }

      // Description match
      if (descLower.includes(kw)) {
        score += 3;
      }

      // Prop name match
      if (entry.keyProps.some((p) => p.toLowerCase().includes(kw))) {
        score += 1;
      }
    }

    if (tags && tags.length > 0) {
      const entryTags = entry.tags.map((t) => t.toLowerCase());
      for (const tag of tags) {
        if (entryTags.includes(tag.toLowerCase())) {
          score += 5;
        }
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

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Early exit for large length differences
  if (Math.abs(a.length - b.length) > 2) return 3;

  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  // Row 0 was set by the i = 0 iteration above (a.length >= 1 here). Seed its columns.
  const firstRow = matrix[0];
  if (!firstRow) return b.length;
  for (let j = 0; j <= b.length; j++) {
    firstRow[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    // Both rows were populated by the seed loop; the guard just narrows them for the
    // checker (noUncheckedIndexedAccess). Cell reads below are likewise in-bounds, so
    // the `?? 0` fallbacks are never taken.
    const row = matrix[i];
    const prevRow = matrix[i - 1];
    if (!row || !prevRow) continue;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((prevRow[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prevRow[j - 1] ?? 0) + cost);
    }
  }

  return matrix[a.length]?.[b.length] ?? 0;
}
