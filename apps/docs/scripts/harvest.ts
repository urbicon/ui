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
/** Offset just past the `>` that closes the tag opening at `lt`. */
function endOfTag(html: string, lt: number): number {
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
  return j + 1;
}

function stripTags(html: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const lt = html.indexOf('<', i);
    if (lt === -1) return out + html.slice(i);
    out += `${html.slice(i, lt)} `;
    i = endOfTag(html, lt);
  }
}

/**
 * Drop what is markup but never prose: comments (Svelte's hydration markers are
 * comments) and script/style/svg subtrees.
 */
function sanitize(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ');
}

/**
 * Flatten markup to readable text.
 *
 * Entities are decoded *after* tag stripping, so markup that the page shows as
 * escaped example code stays text rather than being stripped as tags.
 */
export function stripHtml(html: string): string {
  return decodeEntities(stripTags(sanitize(html)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Elements that carry no close tag, so they own no subtree. */
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

interface Element {
  name: string;
  /** Everything after the tag name in the start tag, verbatim. */
  attrs: string;
  /** Offset of this element's `<`. */
  start: number;
  /** Offset just past its close tag (past the start tag when void or self-closing). */
  end: number;
  children: Element[];
}

/**
 * Element forest with source ranges. Only what the chrome predicates below need:
 * tag name, raw attributes, nesting, and where each element begins and ends.
 *
 * Tolerant by design (the input is generated, but a harvest must never throw on
 * a page): a close tag with no matching open tag is ignored, and an open tag
 * that is never closed runs to the end of the input.
 */
function parseElements(html: string): Element[] {
  const roots: Element[] = [];
  const open: Element[] = [];
  let i = 0;
  for (;;) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;
    const end = endOfTag(html, lt);
    const raw = html.slice(lt + 1, end - 1);
    const match = raw.match(/^(\/?)([a-zA-Z][a-zA-Z0-9-]*)/);
    if (!match) {
      i = end;
      continue;
    }
    const name = match[2].toLowerCase();
    if (match[1]) {
      const at = open.findLastIndex((candidate) => candidate.name === name);
      if (at !== -1) {
        for (let k = open.length - 1; k >= at; k--) open[k].end = end;
        open.length = at;
      }
      i = end;
      continue;
    }
    const element: Element = {
      name,
      attrs: raw.slice(match[0].length),
      start: lt,
      end,
      children: []
    };
    (open[open.length - 1]?.children ?? roots).push(element);
    if (!VOID_TAGS.has(name) && !raw.endsWith('/')) open.push(element);
    i = end;
  }
  for (const element of open) element.end = html.length;
  return roots;
}

function subtreeHas(element: Element, pred: (candidate: Element) => boolean): boolean {
  return pred(element) || element.children.some((child) => subtreeHas(child, pred));
}

/** An element whose content is by its own declaration not final yet. */
const isBusy = (element: Element): boolean => /\baria-busy="true"/.test(element.attrs);

/** CodePanel's control strip: a disclosure button beside the labelled copy control. */
function isCodeToolbar(element: Element): boolean {
  const buttons = element.children.filter((child) => child.name === 'button');
  return (
    buttons.some((button) => /\baria-expanded=/.test(button.attrs)) &&
    buttons.some((button) => /\baria-label=/.test(button.attrs))
  );
}

/** The control strip wrapped over the busy region it toggles. */
function isCodePanel(element: Element): boolean {
  return (
    element.children.length === 2 &&
    isCodeToolbar(element.children[0]) &&
    subtreeHas(element.children[1], isBusy)
  );
}

/**
 * Remove the prerendered placeholder chrome.
 *
 * Code examples are highlighted in an `$effect`, so what prerenders in a
 * CodePanel is never code: it is the panel's shell — language tag, "Hide Code",
 * "Copy", and a spinner — which was landing verbatim in 365 of 650 records. It
 * outranked the pages that genuinely document those words ("syntax highlighting"
 * scored 124 on `planner#installation`) and spent 37k characters of the body
 * budget site-wide.
 *
 * Matched by shape, not by its text: `/customization` documents a copy button and
 * CodePanel's own page discusses syntax highlighting, and both must stay
 * indexed. The panel carries no marker attribute of its own (`packages/docs`
 * ships no `data-` hook on it, and its classes are utility soup shared with every
 * other component), so the shape is the contract: an element whose two children
 * are a toolbar — `button[aria-expanded]` next to `button[aria-label]` — and a
 * region holding `[aria-busy="true"]`. Verified against the real dist: it matches
 * 646 panels across 139 pages and removes 9 distinct strings, all shell.
 *
 * `[aria-busy="true"]` is dropped wherever else it appears too (a demo's loading
 * Button, a stepper mid-sync): the element is telling us its text is a
 * placeholder, and "Loading..." was in 394 records.
 */
export function stripPlaceholderChrome(html: string): string {
  const cuts: Array<[number, number]> = [];

  const visit = (element: Element): void => {
    if (isCodePanel(element) || isBusy(element)) {
      cuts.push([element.start, element.end]);
      return;
    }
    for (const child of element.children) visit(child);
  };
  for (const root of parseElements(html)) visit(root);

  let out = '';
  let at = 0;
  for (const [start, end] of cuts) {
    out += html.slice(at, start);
    at = end;
  }
  return out + html.slice(at);
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

interface HeadingChunk extends Block {
  /** The heading's own text. `inner` is already flattened, so it cannot be recovered from it. */
  heading: string;
}

/**
 * Anchored `<h2 id>`/`<h3 id>` headings and the prose that follows each, used
 * for pages that carry no `<section id>`. Without this the whole
 * `customization/**` tree — the conceptual prose about tokens, theming and dark
 * mode — would be indexed as one undifferentiated blob or missed entirely.
 */
function harvestHeadingChunks(main: string): HeadingChunk[] {
  const pattern = /<(h[1-6])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
  const marks: Array<{ id: string; heading: string; start: number }> = [];
  for (let m = pattern.exec(main); m !== null; m = pattern.exec(main)) {
    if (m[2].endsWith('-title')) continue;
    marks.push({ id: m[2], heading: stripHtml(m[3]), start: m.index + m[0].length });
  }
  return marks.map((mark, i) => ({
    id: mark.id,
    heading: mark.heading,
    inner: `${mark.heading} ${stripHtml(main.slice(mark.start, marks[i + 1]?.start ?? main.length))}`
  }));
}

/**
 * Prose records for one prerendered page, preferring the smallest anchored unit
 * available so a hit deep-links as close to the answer as possible:
 * `<section id>` → anchored heading → whole page.
 */
export function harvestHtml(html: string, route: string): SearchRecord[] {
  const raw = extractMain(html);
  if (!raw) return [];
  const main = stripPlaceholderChrome(sanitize(raw));

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
      .map(({ id, heading, inner }) => ({
        r: route,
        a: id,
        t: heading || titleCase(id),
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
 * The name field is run through `tokenize`, which stores both the joined symbol
 * and its camelCase parts. Search anchors matches to word starts, so without the
 * split parts `checked` could not reach `onCheckedChange`.
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
