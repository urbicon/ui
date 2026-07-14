/**
 * Extraction helpers for the docs search index. Pure functions only — no I/O,
 * no DOM, no globals — so they can be unit-tested against fixture strings.
 *
 * Two harvesters, because no single source has the whole content:
 *
 * - `harvestHtml` reads prose out of the prerendered pages.
 * - `harvestApi` reads the API surface out of the generated `api.ts` modules.
 *   It cannot come from the HTML: the API tables are fed through an `$effect`
 *   (`packages/table/src/lib/core/TableProvider.svelte`), and `$effect` does not
 *   run during SSR, so the prerendered markup carries only "Loading" rows. The
 *   same is true of code examples, which are highlighted in an `$effect` too.
 */

import { type SearchRecord, tokenize } from '../src/lib/search';

/** The parts of the generated `ComponentAPIInfo` the index consumes. */
export interface HarvestableApi {
  name: string;
  props?: Array<{ name: string; description?: string; type?: string }>;
  variants?: Array<{ name: string; values?: string[] }>;
  inheritance?: Array<{ props?: Array<{ name: string; description?: string }> }>;
}

/** Longest body text kept per record. Caps the index against outliers like the changelog. */
const MAX_BODY = 2000;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
};

/** Decode the entity subset the docs markup actually emits, plus numeric refs. */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * Remove tags, skipping `>` that sits inside a quoted attribute value.
 *
 * A `<[^>]*>` regex is wrong here: this codebase uses Tailwind arbitrary
 * variants, so `class="[&>span]:font-bold"` carries a literal `>` inside the
 * attribute. The regex closes the tag on it and leaks the rest of the class
 * list into the text, which lands raw CSS in the index and pollutes matching.
 *
 * A bare `<` in text is not valid HTML (it must be `&lt;`), so treating every
 * `<` as a tag start is safe for generated output.
 */
function stripTags(html: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const lt = html.indexOf('<', i);
    if (lt === -1) return out + html.slice(i);
    out += `${html.slice(i, lt)} `;
    let j = lt + 1;
    let quote = '';
    for (; j < html.length; j++) {
      const ch = html[j];
      if (quote) {
        if (ch === quote) quote = '';
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        break;
      }
    }
    i = j + 1;
  }
}

/**
 * Flatten markup to readable text. Drops comments (Svelte's hydration markers
 * are comments), and script/style/svg subtrees, whose contents are not prose.
 *
 * Entities are decoded *after* tag stripping, so markup that the page shows as
 * escaped example code stays text rather than being stripped as tags.
 */
export function stripHtml(html: string): string {
  const text = stripTags(
    html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ')
  );
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

/**
 * Content of the page's `<main>`. Everything else is layout chrome — the
 * sidebar alone carries ~77 links naming every component, which would otherwise
 * make every page match every component name.
 *
 * Returns null for the redirect stubs (a `location.href` script, no `<main>`).
 */
export function extractMain(html: string): string | null {
  const open = html.indexOf('<main');
  if (open === -1) return null;
  const contentStart = html.indexOf('>', open);
  const close = html.lastIndexOf('</main>');
  if (contentStart === -1 || close === -1 || close <= contentStart) return null;
  return html.slice(contentStart + 1, close);
}

/** `<title>Toggle Component – Urbicon UI</title>` → `Toggle Component`. */
export function extractPageTitle(html: string): string {
  const raw = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  if (!raw) return '';
  return decodeEntities(raw)
    .replace(/\s*[–—|-]\s*Urbicon UI\s*$/, '')
    .trim();
}

interface Block {
  id: string;
  inner: string;
}

/**
 * Outermost `<tag id="…">` blocks, depth-tracked. A regex cannot do this: the
 * docs nest `<section>` inside `<section>` (9 tags, 7 ids on a typical page), so
 * a lazy match would close on the wrong tag. Blocks nested inside an already
 * captured block are skipped rather than indexed twice.
 */
export function extractIdBlocks(html: string, tag: string): Block[] {
  const pattern = new RegExp(`<${tag}\\b([^>]*)>|</${tag}>`, 'gi');
  const blocks: Block[] = [];
  const stack: Array<{ id: string | null; contentStart: number }> = [];
  let captureDepth = -1;

  for (let m = pattern.exec(html); m !== null; m = pattern.exec(html)) {
    const isClose = m[0][1] === '/';
    if (!isClose) {
      const id = m[1].match(/\bid="([^"]*)"/)?.[1] ?? null;
      stack.push({ id, contentStart: m.index + m[0].length });
      if (id && captureDepth === -1) captureDepth = stack.length - 1;
      continue;
    }
    const frame = stack.pop();
    if (!frame) continue;
    if (captureDepth === stack.length && frame.id) {
      blocks.push({ id: frame.id, inner: html.slice(frame.contentStart, m.index) });
      captureDepth = -1;
    }
  }
  return blocks;
}

/**
 * A section's own heading, which `Section.svelte` renders as
 * `<h2 id="{id}-title">`. The leading marker span ("04") is editorial numbering,
 * not part of the title.
 */
function extractSectionHeading(inner: string, id: string): string {
  const pattern = new RegExp(
    `<(h[1-6])\\b[^>]*\\bid="${escapeRegExp(id)}-title"[^>]*>([\\s\\S]*?)</\\1>`,
    'i'
  );
  const raw = inner.match(pattern)?.[2];
  if (!raw) return '';
  return stripHtml(raw)
    .replace(/^\d+\s+/, '')
    .trim();
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clamp(text: string): string {
  return text.length > MAX_BODY ? text.slice(0, MAX_BODY) : text;
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Anchored `<h2 id>`/`<h3 id>` headings and the prose that follows each, used
 * for pages that carry no `<section id>`. Without this the whole
 * `customization/**` tree — the conceptual prose about tokens, theming and dark
 * mode — would be indexed as one undifferentiated blob or missed entirely.
 */
function harvestHeadingChunks(main: string): Block[] {
  const pattern = /<(h[1-6])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
  const marks: Array<{ id: string; heading: string; start: number }> = [];
  for (let m = pattern.exec(main); m !== null; m = pattern.exec(main)) {
    if (m[2].endsWith('-title')) continue;
    marks.push({ id: m[2], heading: stripHtml(m[3]), start: m.index + m[0].length });
  }
  return marks.map((mark, i) => ({
    id: mark.id,
    inner: `${mark.heading} ${stripHtml(main.slice(mark.start, marks[i + 1]?.start ?? main.length))}`
  }));
}

/**
 * Prose records for one prerendered page, preferring the smallest anchored unit
 * available so a hit deep-links as close to the answer as possible:
 * `<section id>` → anchored heading → whole page.
 */
export function harvestHtml(html: string, route: string): SearchRecord[] {
  const main = extractMain(html);
  if (!main) return [];

  const pageTitle = extractPageTitle(html) || titleCase(route.split('/').pop() ?? '');

  const sections = extractIdBlocks(main, 'section');
  if (sections.length > 0) {
    return sections
      .map(({ id, inner }) => ({
        r: route,
        a: id,
        t: extractSectionHeading(inner, id) || titleCase(id),
        p: pageTitle,
        b: clamp(stripHtml(inner)),
        k: 'prose' as const
      }))
      .filter((record) => record.b.length > 0);
  }

  const chunks = harvestHeadingChunks(main);
  if (chunks.length > 0) {
    return chunks
      .map(({ id, inner }) => ({
        r: route,
        a: id,
        t: stripHtml(inner).split(' ').slice(0, 8).join(' ') || titleCase(id),
        p: pageTitle,
        b: clamp(inner),
        k: 'prose' as const
      }))
      .filter((record) => record.b.length > 0);
  }

  const body = clamp(stripHtml(main));
  if (!body) return [];
  return [{ r: route, t: pageTitle, p: pageTitle, b: body, k: 'prose' }];
}

/**
 * One record per component API, anchored at `#api`. Prop names and variant
 * values go to the `n` field so an exact symbol (`onCheckedChange`) outranks
 * prose that merely mentions it; descriptions become the body so the *meaning*
 * of a prop is searchable too.
 *
 * The name field is run through the query-side `tokenize`, which stores both the
 * joined symbol and its camelCase parts. Search anchors matches to word starts,
 * so without the split parts `checked` could not reach `onCheckedChange`.
 */
export function harvestApi(data: HarvestableApi, route: string): SearchRecord[] {
  const props = [...(data.props ?? []), ...(data.inheritance ?? []).flatMap((i) => i.props ?? [])];
  const variants = data.variants ?? [];
  if (props.length === 0 && variants.length === 0) return [];

  const names = tokenize(
    [
      ...props.map((p) => p.name),
      ...variants.map((v) => v.name),
      ...variants.flatMap((v) => v.values ?? [])
    ].join(' ')
  );

  const descriptions = props
    .map((p) => (p.description ? `${p.name} ${stripHtml(p.description)}` : p.name))
    .join('. ');

  return [
    {
      r: route,
      a: 'api',
      t: `${data.name} API`,
      p: data.name,
      b: clamp(descriptions),
      n: names.join(' '),
      k: 'api'
    }
  ];
}

/**
 * Merge prose and API records, letting an API record win its `route#anchor`.
 * The prerendered `#api` section exists but holds only "Loading" placeholders,
 * so without this the empty shell would shadow the real API text.
 */
export function mergeRecords(
  prose: readonly SearchRecord[],
  api: readonly SearchRecord[]
): SearchRecord[] {
  const byKey = new Map<string, SearchRecord>();
  for (const record of prose) byKey.set(`${record.r}#${record.a ?? ''}`, record);
  for (const record of api) byKey.set(`${record.r}#${record.a ?? ''}`, record);
  return [...byKey.values()];
}
