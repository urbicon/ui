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
 * Demote every ATX heading by `by` levels (capped at h6), leaving fenced code
 * blocks untouched — a guide's own `#`/`##` hierarchy has to nest under the
 * embedding document's section heading without colliding with its h1/h2 levels.
 */
export function demoteHeadings(markdown: string, by: number): string {
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const match = /^(#{1,6})(\s)/.exec(line);
      if (!match) return line;
      const level = Math.min(6, match[1].length + by);
      return `${'#'.repeat(level)}${line.slice(match[1].length)}`;
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
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && /^#\s/.test(lines[i])) {
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
    return lines.slice(i).join('\n');
  }
  return markdown;
}

/**
 * The embeddable form of a guide: document title dropped, remaining headings
 * demoted one level (`##` → `###`), so the guide slots under a `##` section
 * of the embedding document.
 */
export function renderGuideForEmbedding(markdown: string): string {
  return demoteHeadings(stripLeadingH1(markdown), 1).trim();
}
