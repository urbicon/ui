import type { ComponentCatalogEntry } from './types.js';

interface ScoredEntry {
  entry: ComponentCatalogEntry;
  score: number;
  /** A query word landed whole on the entry (see `searchComponents`). */
  landed: boolean;
}

/** What `searchComponents` returns: the matches, or — when nothing landed — the nearest misses. */
export interface ComponentSearch {
  /** Entries on which at least one query word landed whole, best first, at most `limit`. */
  matches: ComponentCatalogEntry[];
  /**
   * Up to three entries that scored without landing — reached by a fragment of a
   * longer word, a name two edits away, or only by words too common in the catalog
   * to discriminate — best first. Filled when `matches` is empty, and also when the
   * best of these outscores the best match, so a right answer the floor filed as
   * weak stays visible. What a surface shows as "closest (weak)", with
   * `CLOSEST_NOTE`, so the reader can judge the miss.
   */
  closest: ComponentCatalogEntry[];
}

const CLOSEST_LIMIT = 3;

/**
 * The sentence a surface prints under a `closest` list. Lives here because the CLI
 * and the MCP tool must say the same thing about the same list, and the accurate
 * claim is narrow: these entries scored without a *distinctive* word landing —
 * a fragment of a longer word, or only a word too common in the catalog to mean
 * anything. It must not claim they are wrong (for `weekly plan` the first is Planner).
 */
export const CLOSEST_NOTE =
  'No distinctive query word landed on these — read one before building on it.';

/** A scored entry before the second pass decides which of its hits discriminate. */
interface DraftEntry {
  entry: ComponentCatalogEntry;
  score: number;
  /** The whole query, joined, is this entry's name or slug — a landing on its own. */
  queryLanded: boolean;
  /** Query words that landed on a name, slug word, tag, variant value or prop name. */
  hardLanded: Set<string>;
  /** Query words that landed *only* in the description, summary or prop docs. */
  textLanded: Set<string>;
}

/**
 * How much of the catalog a word's *text* landings cover decides what one landing
 * is worth. Three classes, both boundaries measured against the catalog being
 * searched and never below `UBIQUITY_FLOOR` entries:
 *
 * - **filler**, over `FILLER_SHARE` — never a landing. Grammar and boilerplate.
 * - **common**, over `COMMON_SHARE` — a landing only next to another non-filler
 *   landing on the same entry. Two ordinary words meeting on one component
 *   discriminate even though neither does alone: `dark`+`mode` is ThemeSwitcher,
 *   while `component` alone is every second entry in the catalog.
 * - **distinctive**, the rest — a landing on its own.
 *
 * A name, slug word, tag, variant value or prop name always lands, whatever class
 * the word is in: `find button` reaches Button by name though `button` is common.
 *
 * The shares come from *text* landings per single-word query over the 99-entry
 * 8.18 bundle — the count this classifies on, not the all-routes count (`form`
 * lands on 24 texts but on 31 entries once its slug word counts, and it is the 24
 * that decides its class). Over 74.25 — grammar and the `preset` /
 * `BlocksProvider` boilerplate every component repeats: `the` 99, `and` 98, `to` 96,
 * `via` 96, `preset` 95, `when` 95, `for` 94, `apply` 94, `with` 88, `of` 86,
 * `in` 85, `default` 82, `override` 80. Over 24.75: `label` 61, `mode` 51,
 * `text` 49, `content` 48, `dark` 46, `show` 45, `state` 43, `button` 40,
 * `value` 39, `component` 34, `width` 33, `click` 33, `size` 30, `error` 29,
 * `key` 28, `open` 27, `input` 26. Then the only real gap in the distribution,
 * 26 → 24, and 24.75 sits inside it: `form` 24, `icon` 24, `row` 24, `message` 24,
 * `item` 22, `list` 22, `page` 21, `title` 18, `color` 16, `card` 12, `menu` 10,
 * `binding` 9, `help` 8, `date` 7, `filter` 6, `widget` 3, `rating` 0 all still
 * discriminate.
 *
 * A share needs a population, so neither boundary drops below `UBIQUITY_FLOOR`
 * entries — a word landing on 8 entries or fewer is never discounted, whatever the
 * catalog's size, because a quarter of a handful is not evidence of anything (the
 * ranker is also called on sub-catalogs, and the fixtures are five entries wide).
 *
 * Two limits this does not reach. Generic words still pair with each other, so a
 * query built only from them lands widely: `label text` is two common words and
 * lands on 43 of the 99. And a word can be generic in English yet rare in this
 * catalog, which makes it distinctive by construction — `widget` lands on 3 texts,
 * so `a star rating widget` matches the three entries that say it (Popover,
 * Combobox, Select) rather than reporting the miss that `rating` alone would.
 */
const COMMON_SHARE = 0.25;
const FILLER_SHARE = 0.75;
const UBIQUITY_FLOOR = 8;

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
 * | field                          | hit                                     | score        | lands       |
 * | ------------------------------ | --------------------------------------- | ------------ | ----------- |
 * | name / slug                    | exact · slug word · fragment · edits ≤1/≤2 | 15 · 7 · 3 · 6/3 | ✓ · ✓ · – · ✓/– |
 * | tags                           | exact                                   | 5            | ✓           |
 * | description                    | word or plural · word start             | 3            | ✓ · –       |
 * | summary                        | word or plural · word start             | 2            | ✓ · –       |
 * | variant values                 | exact, non-boolean axes                 | 2            | ✓           |
 * | prop docs + value descriptions | word or plural · word start             | 1            | ✓ · –       |
 * | prop names                     | word or plural · substring              | 1            | ✓ · –       |
 *
 * **The floor is a kind of hit, not a number.** An entry is a match only when at
 * least one query word *lands*: whole on the name, a slug word, a tag, a variant
 * value or a prop name; whole or as its regular plural in the description, the
 * summary or the prop docs; or within one edit of the name (`accordeon`). The whole
 * query joined lands too, so a name the caller split ("tool tip", "combo box")
 * still reaches its component. A text landing by a word over `FILLER_SHARE` never
 * counts, and one over `COMMON_SHARE` counts only beside a second non-filler word
 * — one word the whole catalog says would otherwise re-enable the best-of for
 * every query carrying it ("a rating component" returned ten confident matches
 * through `component` alone). Measured on the 8.18 catalog (99 components), no
 * score threshold could do this job:
 * `filter` reaches Combobox at 6 (description 3 + summary 2 + prop docs 1) and
 * `stat` reaches Badge at the same 6 through the same three fields — the one via
 * `filter` / `filterable` / `filtering`, the other via `status` / `static` /
 * `state`. What separates them is that `filter` occurs whole (Combobox's summary)
 * while `stat` occurs whole on no component at all — nor do `metric`, `kpi` or
 * `rating`. Entries nothing landed on still score, but only order the `closest`
 * list a surface shows when there is no match: `stat metric kpi` → EmptyState
 * (fragment `State` 3 + `states` 3 + prop docs 1), Badge, Chat.
 *
 * Plural, not stem: `shift` must reach Planner's "shifts" and `filter` Table's
 * "filters", but the word-start rule that would also catch them counts `stat` as
 * a hit on `status`. Regular English plurals (`+s`, and `+es` after s/x/z/ch/sh)
 * are the same word; "states" is `state` + s, not `stat` + es, so it does not land.
 * A longer derivation (`filtering`, `planning`) still scores, at the word start,
 * but does not land. An `-ies` plural is not reached at all: `entry` is not a
 * prefix of `entries`, so there is no occurrence to score — `find category`
 * reaches Badge through its summary, never through "categories". A stemmer would
 * be a second vocabulary to argue with.
 *
 * Two name tiers above the slug word, because they answer two questions. An entry
 * whose name or slug *is* the whole query (`avatar`, `date picker`, `date-picker`,
 * `DatePicker`) gets 25 once — above the 21 a sibling can stack from that one word
 * (slug word 7 + tag 5 + description 3 + summary 2 + value 2 + docs 1 + prop 1),
 * so `Avatar` beats `AvatarGroup` for "avatar"; and it is the whole query, not a
 * word, so "avatar-group" does not hand `Avatar` 25 for its first word (scored
 * per word at 25, 22 of the catalog's 198 names and slugs stopped ranking first
 * for themselves). A word that is a name inside a longer query ("toast
 * notification", "small avatar") gets 15 against the slug-word sibling's 7: with
 * the text a sibling adds for the same word without a tag (description 3 +
 * summary 2 + docs 1 + prop 1 = 7, plus 2 if an axis value happens to equal it)
 * it reaches 14–16, and the exact entry collects those same text hits for its
 * own name on top. Without this tier the whole-query bonus alone scored the
 * word like a slug word, and six two-word queries lost their obvious answer
 * ("toast notification" → NotificationListener). 12 would sit inside that 14–16
 * band; 22 overshoots — measured on the catalog, it flips "date picker input"
 * to Input, while 15 keeps every single-word top-3 as it was. A fragment of a
 * name word (`list` in `Listener`, `stat` in `State`, `butt` in `Button`) scored
 * 7 like a slug word and led `list` with NotificationListener (7 + `listener` 3
 * + 1 = 11) over ChatMessageList (7 + 1 = 8); at 3, and never landing, it orders
 * the closest list (`butt` → Button) and nothing else. Equal scores are broken
 * by name, ascending — never by catalog order.
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
 * prop (a component's prop count must not become its score). All three text
 * fields match at word starts only: "row" occurs 58 times inside a word
 * ("arrow", "browser", "narrow") against 111 times starting one; `rating` lit
 * Separator through "separating" — its only hit in the catalog — and `graph` led
 * with Tooltip's "paragraph" at 3 over the Sankey that has the word, at 1.
 *
 * An explicit `tags` filter adds 5 per matching tag; it is a filter the caller
 * set, not a word that landed. Returns the matches with a positive score, best
 * first, at most `limit`; when none landed, up to three `closest` instead.
 */
export function searchComponents(
  components: ComponentCatalogEntry[],
  query: string,
  tags?: string[],
  limit = 5
): ComponentSearch {
  // `slice(0, 0)` would empty `matches` and hand every landed entry to `closest`,
  // inverting the contract instead of returning nothing.
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`searchComponents: limit must be a positive integer, got ${limit}`);
  }
  const scored = scoreComponents(components, query, tags);
  const landed = scored.filter((s) => s.landed);
  const weak = scored.filter((s) => !s.landed);
  const matches = landed.slice(0, limit).map((s) => s.entry);
  // Show the near misses when there is nothing else to show — and also when a weak
  // entry outscores everything that landed, because then the answer the reader
  // wants is the one the floor filed away: `dark mode` reaches ThemeSwitcher at 10
  // while the entries that merely have a `mode` prop land at 1.
  const outscored = (weak[0]?.score ?? 0) > (landed[0]?.score ?? 0);
  const closest =
    matches.length === 0 || outscored ? weak.slice(0, CLOSEST_LIMIT).map((s) => s.entry) : [];
  return { matches, closest };
}

/** The `matches` of `searchComponents` — for callers that only want the answer. */
export function matchComponents(
  components: ComponentCatalogEntry[],
  query: string,
  tags?: string[],
  limit = 5
): ComponentCatalogEntry[] {
  return searchComponents(components, query, tags, limit).matches;
}

/**
 * Every entry with a positive score, best first, landed or not — the ranking
 * `searchComponents` splits into matches and closest. Module-level for the tests.
 */
export function scoreComponents(
  components: ComponentCatalogEntry[],
  query: string,
  tags?: string[]
): ScoredEntry[] {
  const keywords = query
    .toLowerCase()
    .split(/[\s,\-_]+/)
    .filter((w) => w.length > 1);
  // The whole query as a name (`datepicker`) and as a slug (`date-picker`).
  const queryAsName = keywords.join('');
  const queryAsSlug = keywords.join('-');

  const draft: DraftEntry[] = components.map((entry) => {
    let score = 0;
    let queryLanded = false;
    const hardLanded = new Set<string>();
    const textLanded = new Set<string>();
    const nameLower = entry.name.toLowerCase();
    const slugLower = entry.slug.toLowerCase();
    const slugWords = slugLower.split('-');
    const slugJoined = slugWords.join('');
    const descLower = entry.description.toLowerCase();
    const summaryLower = entry.summary?.toLowerCase() ?? '';
    const values = new Set(
      entry.variants
        .filter((v) => !isBooleanAxis(v.values))
        .flatMap((v) => v.values.map((x) => x.toLowerCase()))
    );
    const docsLower = docText(entry);
    const props = entry.keyProps.map((p) => p.toLowerCase());

    // The query, joined, IS this component's name or slug — including across the
    // words the caller split it into ("tool tip", "combo box") and against a
    // hyphenated slug ("datepicker" vs `date-picker`). It lands: every word of
    // such a query is a fragment of the one-word name, so without this the entry
    // the query names scored 35-37 and still counted as a miss (#446).
    if (
      keywords.length > 0 &&
      (nameLower === queryAsName || slugLower === queryAsSlug || slugJoined === queryAsName)
    ) {
      score += 25;
      queryLanded = true;
    }

    for (const kw of keywords) {
      if (nameLower === kw || slugLower === kw) {
        score += 15;
        hardLanded.add(kw);
      } else if (slugWords.includes(kw)) {
        score += 7;
        hardLanded.add(kw);
      } else if (nameLower.includes(kw) || slugLower.includes(kw)) {
        score += 3;
      } else {
        const minDist = Math.min(levenshtein(nameLower, kw), levenshtein(slugLower, kw));
        if (minDist <= 1) {
          score += 6;
          hardLanded.add(kw);
        } else if (minDist <= 2) {
          score += 3;
        }
      }

      if (entry.tags.some((t) => t.toLowerCase() === kw)) {
        score += 5;
        hardLanded.add(kw);
      }

      const desc = wordHit(descLower, kw);
      if (desc) {
        score += 3;
        if (desc === 'word') textLanded.add(kw);
      }

      const summary = wordHit(summaryLower, kw);
      if (summary) {
        score += 2;
        if (summary === 'word') textLanded.add(kw);
      }

      if (values.has(kw)) {
        score += 2;
        hardLanded.add(kw);
      }

      const docs = wordHit(docsLower, kw);
      if (docs) {
        score += 1;
        if (docs === 'word') textLanded.add(kw);
      }

      if (props.some((p) => isSameWord(p, kw))) {
        score += 1;
        hardLanded.add(kw);
      } else if (props.some((p) => p.includes(kw))) {
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

    return { entry, score, queryLanded, hardLanded, textLanded };
  });

  // Second pass: how much of the catalog each word's text landings cover decides
  // its class, and the class decides what one landing is worth. One word that
  // everything says re-enabled the best-of the floor exists to stop.
  const textLandings = new Map<string, number>();
  for (const d of draft) {
    for (const kw of d.textLanded) textLandings.set(kw, (textLandings.get(kw) ?? 0) + 1);
  }
  const commonAt = Math.max(components.length * COMMON_SHARE, UBIQUITY_FLOOR);
  const fillerAt = Math.max(components.length * FILLER_SHARE, UBIQUITY_FLOOR);
  const classOf = (kw: string): 'filler' | 'common' | 'distinctive' => {
    const n = textLandings.get(kw) ?? 0;
    if (n > fillerAt) return 'filler';
    if (n > commonAt) return 'common';
    return 'distinctive';
  };

  return draft
    .map(({ entry, score, queryLanded, hardLanded, textLanded }) => {
      const text = [...textLanded];
      // Words that said something about this entry: any hard route, plus the text
      // hits that were not filler. Two of them is the pair rule.
      const speaking = new Set([...hardLanded, ...text.filter((kw) => classOf(kw) !== 'filler')]);
      return {
        entry,
        score,
        landed:
          queryLanded ||
          hardLanded.size > 0 ||
          text.some((kw) => classOf(kw) === 'distinctive') ||
          speaking.size >= 2
      };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
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

/** `+es` is the plural after a sibilant; everywhere else the plural is `+s`. */
const TAKES_ES = /(?:[sxz]|[cs]h)$/;

/**
 * Whether `word` is `kw` or its regular plural — the one place that rule is
 * written, so the text scan and the prop-name tier cannot come to disagree about
 * what counts as the same word. Nothing further: "helper" is not "help".
 */
function isSameWord(word: string, kw: string): boolean {
  return word === kw || word === `${kw}s` || (TAKES_ES.test(kw) && word === `${kw}es`);
}

/**
 * How `kw` sits in `text`. A word boundary ends at any non-word character, so
 * "row" is a whole word in both "rows" and "row-level".
 *
 * - `'word'` — some occurrence is the word itself or its regular plural ("box" in "boxes")
 * - `'prefix'` — every occurrence only starts a longer word ("plan" in "planning")
 * - `null` — every occurrence is inside a word ("rating" in "separating"), or there is none
 */
function wordHit(text: string, kw: string): 'word' | 'prefix' | null {
  let hit: 'word' | 'prefix' | null = null;
  let at = text.indexOf(kw);
  while (at !== -1) {
    if (at === 0 || !WORD_CHAR.test(text.charAt(at - 1))) {
      let end = at + kw.length;
      while (end < text.length && WORD_CHAR.test(text.charAt(end))) end++;
      if (isSameWord(text.slice(at, end), kw)) return 'word';
      hit = 'prefix';
    }
    at = text.indexOf(kw, at + 1);
  }
  return hit;
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
