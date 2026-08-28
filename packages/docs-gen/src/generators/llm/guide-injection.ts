/**
 * Package-guide plumbing shared by the two distributors that embed or bundle
 * the canonical, tarball-shipped package guides (e.g. `packages/auth/docs/AUTH.md`):
 * `LlmsFullAssembler` (inlines a guide into `llms-full.txt` via a
 * `{{GUIDE:<slug>}}` placeholder) and `ContentBundleEmitter` (emits each guide
 * as `guides/<slug>.md` + an index into the `@urbicon-ui/design-content` bundle).
 * One source, all channels generated — see docs/DOCS-SURFACES.md.
 */

/**
 * A canonical package guide document distributed into the generated channels.
 * The source of truth stays in the package (shipped in its npm tarball);
 * everything here is distribution metadata.
 */
export interface PackageGuide {
  /** Stable bundle id: `guides/<slug>.md`, `{{GUIDE:<slug>}}`, `urbicon guide <slug>`. */
  slug: string;
  /** Human title for guide listings (CLI, MCP resource names). */
  title: string;
  /** One-line description for guide listings. */
  description: string;
  /** Absolute path to the canonical markdown source. */
  sourcePath: string;
}

/** Slug shape shared with the bundle locators (lowercase segments, single hyphens). */
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The template placeholder that embeds a guide: `{{GUIDE:<slug>}}`. */
export function guidePlaceholder(slug: string): string {
  return `{{GUIDE:${slug}}}`;
}

/** Matches any guide placeholder — the fail-loud sweep for unconfigured leftovers. */
export const GUIDE_PLACEHOLDER_PATTERN = /\{\{GUIDE:([a-z0-9-]+)\}\}/;

/**
 * Validate a guide's slug (it becomes a bundle file name and a CLI argument).
 * Throws on anything outside the lowercase-hyphen shape — a bad slug is a
 * build error, never a silently odd bundle path.
 */
export function assertGuideSlug(slug: string): void {
  if (!SAFE_SLUG.test(slug)) {
    throw new Error(`Package guide slug "${slug}" is invalid (want lowercase-hyphen, e.g. "auth")`);
  }
}

/**
 * One fence grammar for every reader of these documents (the heading demotion,
 * the marker strip, `docs:fences:lint`): a CommonMark fence delimiter is
 * optional indentation, three or more backticks or tildes, and an info string
 * (which cannot contain a backtick on a backtick fence). A fence closes only
 * on the same character, at least as many of them, with no info string —
 * a ``` line inside a ~~~ fence is content.
 */
export interface FenceDelimiter {
  indent: number;
  char: '`' | '~';
  length: number;
  info: string;
}

export function parseFenceDelimiter(line: string): FenceDelimiter | null {
  const m = /^([ \t]*)(`{3,}|~{3,})(.*)$/.exec(line);
  if (!m) return null;
  const run = m[2] ?? '';
  const info = (m[3] ?? '').trim();
  const char = run[0] === '~' ? '~' : '`';
  if (char === '`' && info.includes('`')) return null;
  return { indent: (m[1] ?? '').length, char, length: run.length, info };
}

export function closesFence(line: string, open: FenceDelimiter): boolean {
  const d = parseFenceDelimiter(line);
  return d !== null && d.char === open.char && d.length >= open.length && d.info === '';
}

/**
 * Line-by-line fence state for one pass over a document: the returned function
 * answers whether the line it is fed is fenced — a delimiter or the code
 * between two.
 */
export function fenceTracker(): (line: string) => boolean {
  let open: FenceDelimiter | null = null;
  return (line) => {
    if (open) {
      if (closesFence(line, open)) open = null;
      return true;
    }
    open = parseFenceDelimiter(line);
    return open !== null;
  };
}

/**
 * Demote every ATX heading by `by` levels (capped at h6), leaving fenced code
 * blocks untouched — a guide's own `#`/`##` hierarchy has to nest under the
 * embedding document's section heading without colliding with its h1/h2 levels.
 */
export function demoteHeadings(markdown: string, by: number): string {
  const fenced = fenceTracker();
  return markdown
    .split('\n')
    .map((line) => {
      if (fenced(line)) return line;
      const hashes = /^(#{1,6})\s/.exec(line)?.[1];
      if (!hashes) return line;
      const level = Math.min(6, hashes.length + by);
      return `${'#'.repeat(level)}${line.slice(hashes.length)}`;
    })
    .join('\n');
}

/**
 * Drop a leading h1 title line (and the blank line after it). The embedding
 * document supplies its own section heading, so the guide's document title
 * would only duplicate it.
 */
export function stripLeadingH1(markdown: string): string {
  const lines = markdown.split('\n');
  let i = 0;
  while (i < lines.length && (lines[i] ?? '').trim() === '') i++;
  if (i < lines.length && /^#\s/.test(lines[i] ?? '')) {
    i++;
    while (i < lines.length && (lines[i] ?? '').trim() === '') i++;
    return lines.slice(i).join('\n');
  }
  return markdown;
}

/**
 * The line that opts a `ts` fence into `docs:fences:lint` (`<!-- typecheck -->`,
 * optionally `<!-- typecheck: stub <pkg> -->`), sitting directly above the
 * fence; surrounding whitespace (a fence inside a list item is indented) does
 * not count. Group 1 is the directive list. The lint reads this same pattern,
 * so what it selects and what the channels strip cannot disagree.
 */
export const TYPECHECK_MARKER = /^\s*<!--\s*typecheck(?::\s*(.*?))?\s*-->\s*$/;

/**
 * Remove the `<!-- typecheck -->` marker lines — a build instruction, not
 * content — and nothing else: every other line, including HTML comments (a
 * `<!-- Client: … -->` inside a svelte fence is prose) and a marker-shaped
 * line inside a fence, passes through byte for byte.
 */
export function stripTypecheckMarkers(markdown: string): string {
  const fenced = fenceTracker();
  return markdown
    .split('\n')
    .filter((line) => fenced(line) || !TYPECHECK_MARKER.test(line))
    .join('\n');
}

/**
 * The embeddable form of a guide: typecheck markers dropped, document title
 * dropped, remaining headings demoted one level (`##` → `###`), so the guide
 * slots under a `##` section of the embedding document.
 */
export function renderGuideForEmbedding(markdown: string): string {
  return demoteHeadings(stripLeadingH1(stripTypecheckMarkers(markdown)), 1).trim();
}
