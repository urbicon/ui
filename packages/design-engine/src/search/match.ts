import type { ComponentCatalogEntry } from './types.js';

interface ScoredEntry {
  entry: ComponentCatalogEntry;
  score: number;
}

/**
 * Whether a variant axis is a boolean switch (`true`/`false`, or a lone `true`)
 * rather than a named look. The one predicate behind every surface that lists
 * or scores axis values — the CLI's `find` lines, the MCP catalog formatters and
 * the ranker — so the three cannot disagree on what a boolean axis is.
 */
export function isBooleanAxis(values: string[]): boolean {
  return values.length > 0 && values.every((v) => v === 'true' || v === 'false');
}

/**
 * Rank catalog entries against a free-text query — the component-discovery ranker
 * behind both `find_components` (remote MCP) and `urbicon find` (CLI), so local and
 * remote discovery agree. Pure and dependency-free. The query is lower-cased and
 * split on whitespace, commas, hyphens and underscores; words shorter than two
 * characters are dropped. Every remaining word scores each field it hits, each
 * field at most once per word:
 *
 * | field                          | hit                           | score   |
 * | ------------------------------ | ----------------------------- | ------- |
 * | name / slug                    | substring · Levenshtein ≤1/≤2 | 7 · 6/3 |
 * | tags                           | exact                         | 5       |
 * | description                    | substring                     | 3       |
 * | summary                        | substring                     | 2       |
 * | variant values                 | exact, non-boolean axes       | 2       |
 * | prop docs + value descriptions | word-prefix                   | 1       |
 * | prop names                     | substring                     | 1       |
 *
 * On top of the per-word scores, an entry whose name or slug *is* the whole query
 * (`avatar`, `date picker`, `date-picker`, `DatePicker`) gets 25 once. Whole
 * query, not per word: scored per word, "avatar-group" handed `Avatar` the bonus
 * for its first word and 22 of the catalog's 198 names and slugs stopped ranking
 * first for themselves. The bonus is set so that no stack a sibling can build
 * from one word reaches it: substring 7 + tag 5 + description 3 + summary 2 +
 * value 2 + docs 1 + prop 1 = 21, so 25 — below that `Avatar` lost to
 * `AvatarGroup` (substring plus four text hits) for "avatar". Equal scores are
 * broken by name, ascending — never by catalog order.
 *
 * Why the shipped-text rows sit below `description`: the description is the
 * contract and stays the primary text; the summary is the one-line paraphrase a
 * person reads under the name, worth a step less — it scores at all because it
 * carries vocabulary of its own (97 of 99 summaries contain a word their
 * description lacks; mean word overlap 44 %). A variant value is a token the
 * author named (`dot`, `ghost`), but `md` and `sm` sit on 48 of 99 components, so
 * it cannot outrank the text that says what a component *is*; exact-only, so `sm`
 * never lights up "small", and boolean axes are skipped — `true` names nothing.
 * Prop docs are the longest and most repetitive text in the catalog — twelve auth
 * components carry the identical `t` sentence, eight components the same `preset`
 * one — so a hit is worth the least, counted once per word rather than once per
 * prop (a component's prop count must not become its score), and matched at word
 * starts rather than anywhere: "row" occurs 58 times inside a word ("arrow",
 * "browser", "narrow") against 111 times starting one, and lights 36 components
 * by substring against 18 by word start.
 *
 * An explicit `tags` filter adds 5 per matching tag. Returns the top `limit`
 * entries with a positive score, best first; an empty list when nothing matches.
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
  // The whole query as a name (`datepicker`) and as a slug (`date-picker`).
  const queryAsName = keywords.join('');
  const queryAsSlug = keywords.join('-');

  const scored: ScoredEntry[] = components.map((entry) => {
    let score = 0;
    const nameLower = entry.name.toLowerCase();
    const slugLower = entry.slug.toLowerCase();
    const descLower = entry.description.toLowerCase();
    const summaryLower = entry.summary?.toLowerCase() ?? '';
    const values = new Set(
      entry.variants
        .filter((v) => !isBooleanAxis(v.values))
        .flatMap((v) => v.values.map((x) => x.toLowerCase()))
    );
    const docsLower = docText(entry);

    // Whole-query exact match
    if (keywords.length > 0 && (nameLower === queryAsName || slugLower === queryAsSlug)) {
      score += 25;
    }

    for (const kw of keywords) {
      // Substring match on name/slug
      if (nameLower.includes(kw) || slugLower.includes(kw)) {
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

      // Summary match
      if (summaryLower.includes(kw)) {
        score += 2;
      }

      // Variant value match
      if (values.has(kw)) {
        score += 2;
      }

      // Prop-doc / value-description match
      if (hasWordPrefix(docsLower, kw)) {
        score += 1;
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
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map((s) => s.entry);
}

/**
 * Every hand-written prop and value doc of an entry as one lower-cased text, so a
 * word is scored once however many props say it.
 */
function docText(entry: ComponentCatalogEntry): string {
  const parts: string[] = [];
  for (const doc of Object.values(entry.propDocs ?? {})) {
    if (doc.description) parts.push(doc.description);
    if (doc.summary) parts.push(doc.summary);
  }
  for (const variant of entry.variants) {
    parts.push(...Object.values(variant.valueDescriptions ?? {}));
  }
  return parts.join('\n').toLowerCase();
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** `kw` starts a word somewhere in `text` — "row" in "rows" and "row-level", not in "arrow". */
function hasWordPrefix(text: string, kw: string): boolean {
  let at = text.indexOf(kw);
  while (at !== -1) {
    if (at === 0 || !WORD_CHAR.test(text.charAt(at - 1))) return true;
    at = text.indexOf(kw, at + 1);
  }
  return false;
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
