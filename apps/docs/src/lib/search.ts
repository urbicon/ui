/**
 * Query tokenizing, scoring and excerpting for the docs full-text index.
 * Pure functions only — no Svelte reactivity, no DOM, no fetch — so they can be
 * unit-tested without mounting the palette or building the site.
 *
 * The record shape uses one-letter keys because it is serialised verbatim into
 * `dist/search-index.json`, which ships over the wire on first palette open.
 */

/**
 * Where a record's text came from. `api` records are harvested from the
 * generated `api.ts` modules rather than the prerendered HTML, because the API
 * tables render inside an `$effect` and are therefore absent from the
 * prerendered markup.
 */
export type SearchKind = 'prose' | 'api';

/** One indexed unit: a page section, an anchored heading, or a component's API surface. */
export interface SearchRecord {
  /** Route path, e.g. `/blocks/primitives/checkbox`. */
  r: string;
  /** Anchor within the route. Hits deep-link to `/{r}#{a}`. */
  a?: string;
  /** Section heading. */
  t: string;
  /** Title of the page the section belongs to. */
  p: string;
  /** Extracted body text. */
  b: string;
  /** Symbol names (props, variants, variant values), space-separated. Ranked above body prose. */
  n?: string;
  k: SearchKind;
}

/** A scored record, ready to render. */
export interface SearchHit {
  record: SearchRecord;
  score: number;
  /** `/{r}#{a}` when the record is anchored, otherwise `/{r}`. */
  href: string;
  /** Body text around the first query match, ellipsed. Empty when nothing matched in the body. */
  excerpt: string;
}

export interface SearchOptions {
  /** Maximum hits returned. @default 8 */
  limit?: number;
  /** Characters of context around a match in the excerpt. @default 90 */
  excerptRadius?: number;
}

const DEFAULT_LIMIT = 8;
const DEFAULT_EXCERPT_RADIUS = 90;

/**
 * Field weights. Titles outrank symbol names, which outrank body prose, so a
 * page *about* toggles beats a page that merely mentions one. Within a field a
 * whole-word hit outranks a word-prefix hit, so `toggle` beats `toggleable`
 * while a half-typed `togg` still finds both.
 *
 * The phrase weights are high on purpose. A record's `n` field holds every prop
 * and variant name of a component (dozens of them), so one incidental name hit
 * is weak evidence about the record as a whole — without a strong phrase bonus,
 * "focus ring" ranks the Avatar API (which happens to have a `ring` prop) above
 * the token page that literally documents the focus ring.
 */
const WEIGHT = {
  titleWord: 100,
  titlePrefix: 55,
  nameWord: 80,
  namePrefix: 35,
  bodyWord: 12,
  bodyPrefix: 4,
  phraseTitle: 200,
  phraseBody: 100
} as const;

const MATCH_NONE = 0;
const MATCH_PREFIX = 1;
const MATCH_WORD = 2;

/**
 * Split a string into lowercase search tokens. camelCase and kebab/underscore
 * runs are additionally split into their parts, so `onCheckedChange` is
 * reachable by `checked` and `focus-visible` by `visible`, while the joined
 * form is kept so the exact symbol still matches as one token.
 */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  for (const raw of input.toLowerCase().split(/[^a-z0-9]+/i)) {
    if (raw) tokens.push(raw);
  }
  for (const raw of input.split(/[^A-Za-z0-9]+/)) {
    const parts = raw.split(/(?<=[a-z0-9])(?=[A-Z])/);
    if (parts.length < 2) continue;
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (lower) tokens.push(lower);
    }
  }
  return [...new Set(tokens)];
}

/**
 * Best match of `needle` in `haystack`, anchored to a word start:
 * `MATCH_WORD` for a whole word, `MATCH_PREFIX` when a word merely starts with
 * it, `MATCH_NONE` otherwise.
 *
 * Anchoring is what keeps precision usable — an unanchored substring scan makes
 * "ring" match "during" and "string", which pulled dozens of junk records into
 * a "focus ring" query. Anchoring still lets a half-typed word match, so
 * type-ahead keeps working.
 *
 * Hand-rolled rather than built from a `RegExp`: the needle is user input and
 * would otherwise need escaping.
 */
function matchWord(haystack: string, needle: string): number {
  let from = 0;
  let best = MATCH_NONE;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return best;
    if (!isWordChar(at === 0 ? '' : haystack[at - 1])) {
      const afterAt = at + needle.length;
      if (!isWordChar(afterAt >= haystack.length ? '' : haystack[afterAt])) return MATCH_WORD;
      best = MATCH_PREFIX;
    }
    from = at + 1;
  }
}

function isWordChar(ch: string): boolean {
  if (!ch) return false;
  return (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9');
}

/** First index where a word starts with `needle`, or -1. Mirrors `matchWord`'s anchoring. */
function indexOfWord(haystack: string, needle: string): number {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return -1;
    if (!isWordChar(at === 0 ? '' : haystack[at - 1])) return at;
    from = at + 1;
  }
}

interface Haystacks {
  title: string;
  name: string;
  body: string;
}

function graded(haystack: string, token: string, word: number, prefix: number): number {
  const match = matchWord(haystack, token);
  if (match === MATCH_WORD) return word;
  if (match === MATCH_PREFIX) return prefix;
  return 0;
}

function scoreToken(hay: Haystacks, token: string): number {
  return (
    graded(hay.title, token, WEIGHT.titleWord, WEIGHT.titlePrefix) +
    (hay.name ? graded(hay.name, token, WEIGHT.nameWord, WEIGHT.namePrefix) : 0) +
    graded(hay.body, token, WEIGHT.bodyWord, WEIGHT.bodyPrefix)
  );
}

/**
 * Score one record against pre-tokenized query terms. Returns 0 unless *every*
 * term hits some field — AND semantics, so "focus ring" does not return every
 * page that merely says "focus".
 */
export function scoreRecord(record: SearchRecord, terms: string[], phrase: string): number {
  const hay: Haystacks = {
    title: `${record.t} ${record.p}`.toLowerCase(),
    name: (record.n ?? '').toLowerCase(),
    body: record.b.toLowerCase()
  };

  let total = 0;
  for (const term of terms) {
    const termScore = scoreToken(hay, term);
    if (termScore === 0) return 0;
    total += termScore;
  }

  if (phrase.includes(' ')) {
    if (hay.title.includes(phrase)) total += WEIGHT.phraseTitle;
    else if (hay.body.includes(phrase)) total += WEIGHT.phraseBody;
  }

  return total;
}

/** Deep link for a record. */
export function hrefFor(record: SearchRecord): string {
  return record.a ? `${record.r}#${record.a}` : record.r;
}

/**
 * Body text around the first matching term, clipped to word boundaries and
 * ellipsed. Returns '' when no term appears in the body (a title-only hit).
 */
export function excerptFor(record: SearchRecord, terms: string[], radius: number): string {
  const body = record.b;
  if (!body) return '';
  const lower = body.toLowerCase();

  let at = -1;
  for (const term of terms) {
    const found = indexOfWord(lower, term);
    if (found !== -1 && (at === -1 || found < at)) at = found;
  }
  if (at === -1) return '';

  let start = Math.max(0, at - radius);
  let end = Math.min(body.length, at + radius);
  if (start > 0) {
    const space = body.indexOf(' ', start);
    if (space !== -1 && space < at) start = space + 1;
  }
  if (end < body.length) {
    const space = body.lastIndexOf(' ', end);
    if (space > at) end = space;
  }

  return `${start > 0 ? '…' : ''}${body.slice(start, end).trim()}${end < body.length ? '…' : ''}`;
}

/**
 * Rank `records` against a raw query string. Ties break on shorter body first,
 * so the tighter, more specific section wins over a long page that happens to
 * contain the same terms.
 */
export function searchRecords(
  records: readonly SearchRecord[],
  query: string,
  options: SearchOptions = {}
): SearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const limit = options.limit ?? DEFAULT_LIMIT;
  const radius = options.excerptRadius ?? DEFAULT_EXCERPT_RADIUS;
  const phrase = query.trim().toLowerCase();

  const hits: SearchHit[] = [];
  for (const record of records) {
    const score = scoreRecord(record, terms, phrase);
    if (score === 0) continue;
    hits.push({ record, score, href: hrefFor(record), excerpt: excerptFor(record, terms, radius) });
  }

  hits.sort((a, b) => b.score - a.score || a.record.b.length - b.record.b.length);
  return hits.slice(0, limit);
}
