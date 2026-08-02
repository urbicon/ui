/**
 * Sections lint — the table of contents against the page it describes.
 *
 * Every DocsLayout page hand-maintains a `navigation` array, and every section
 * hand-writes an `id`. Nothing has ever checked that the two agree, and both
 * failure directions are silent:
 *
 *   - a nav entry with no matching section renders a TOC link that scrolls
 *     nowhere;
 *   - a section with no nav entry is unreachable from the TOC and invisible to
 *     the scroll-spy, so the reader loses their place while scrolling past it.
 *
 * The 2026-07 docs triage found ten pages in this state by hand and flagged the
 * check as "a candidate for a small lint". This is that lint.
 *
 * Two traps this has to survive, both observed on real pages:
 *
 *   1. Section ids are spread across files. A page is typically `+page.svelte`
 *      (playground / api / installation) plus a `Docs.svelte` or
 *      `DocsCustom.svelte` (examples / accessibility). Reading only the route
 *      file reports half the sections as missing.
 *   2. Docs pages *quote* markup. `<Section id="examples">` inside a code
 *      sample is prose, not a section, and must not count. Anything inside a
 *      template literal or a `code={…}` prop is therefore blanked before the
 *      scan — the same "blank the prose, keep the code" idea `urbicon validate`
 *      uses, inverted.
 *
 * Exit 0 clean, 1 on findings.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES = join(APP, 'src/routes');

/**
 * Pages whose nav deliberately does not mirror their sections, with the reason.
 * Same contract as registry-lint's UNLISTED: a stale entry is an error too, so
 * the list cannot rot into a blanket exemption.
 */
const EXEMPT: Record<string, string> = {};

interface Finding {
  page: string;
  kind: 'dead-nav-entry' | 'unlisted-section' | 'duplicate-id' | 'stale-exemption';
  detail: string;
}

/**
 * Collapse demo stages. A `<Section id="demo">` inside a playground's children
 * snippet, or inside a CodeExample preview, is the *subject* of the page, not a
 * section of it — the TOC must not list it and it is not "unreachable" for
 * being absent. Real pages do this: the Section docs page renders a live
 * `<Section id="demo">`, and the TableOfContents page feeds its demo a nav of
 * `intro`/`setup`/`usage`.
 */
function blankDemoStages(src: string): string {
  return src
    .replace(/<PlaygroundConfigurator\b[\s\S]*?<\/PlaygroundConfigurator>/g, (m) =>
      ' '.repeat(m.length)
    )
    .replace(/<CodeExample\b[\s\S]*?<\/CodeExample>/g, (m) => ' '.repeat(m.length));
}

/** Collapse the parts of a Svelte file that only *quote* markup. */
function blankQuotedMarkup(src: string): string {
  return (
    src
      // template literals (the `code={`…`}` idiom and codeSetup consts)
      .replace(/`(?:[^`\\]|\\[\s\S])*`/g, (m) => ' '.repeat(m.length))
      // single/double-quoted code props that still carry markup
      .replace(/\bcode=\{?"(?:[^"\\]|\\[\s\S])*"\}?/g, (m) => ' '.repeat(m.length))
      .replace(/\bcode=\{?'(?:[^'\\]|\\[\s\S])*'\}?/g, (m) => ' '.repeat(m.length))
      // HTML comments
      .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
  );
}

/**
 * Two different questions need two different sets, and conflating them is how a
 * first version of this lint produced 30 false positives on `/customization/*`:
 *
 *   - "does this nav entry resolve?" is about ANCHORS. A `#ladder` link works
 *     whether the id sits on `<Section>` or on a bare `<h2 id="ladder">`, and
 *     several guide pages do the latter.
 *   - "is this section listed?" is about SECTIONS. Every `id` in the document
 *     is an anchor, but a form field's id is not a missing TOC entry.
 */

/**
 * Docs components that render their own anchor, so the id never appears in the
 * page source. Verified against the component markup:
 *   TypesReference.svelte → `<section id="types">`
 *   ApiReference.svelte   → `<section id="api-reference">`
 * Both accept restProps, so a page can override the id — the override is picked
 * up by the ordinary attribute scan and simply adds to this set.
 */
const COMPONENT_ANCHORS: Record<string, string> = {
  TypesReference: 'types',
  ApiReference: 'api-reference'
};

/** Every id a TOC link can legitimately target. */
function anchorIds(src: string): Set<string> {
  const clean = blankQuotedMarkup(src);
  const ids = new Set([...clean.matchAll(/\bid=["']([^"'{}]+)["']/g)].map((m) => m[1]));
  for (const [component, anchor] of Object.entries(COMPONENT_ANCHORS)) {
    if (new RegExp(`<${component}\\b`).test(clean)) ids.add(anchor);
  }
  return ids;
}

/** `id` values of rendered `<Section …>` / `<SectionComponent …>` elements. */
function sectionIds(src: string): string[] {
  const clean = blankQuotedMarkup(src);
  // Component name varies by import alias; every one of them ends in "Section".
  const tag = /<([A-Z][A-Za-z]*Section|Section)\b([^>]*)>/g;
  return [...clean.matchAll(tag)]
    .map((m) => m[2].match(/\bid=["']([^"']+)["']/)?.[1])
    .filter((id): id is string => id !== undefined);
}

/** `id` fields of the page's `navigation` array. */
function navIds(src: string): string[] | null {
  const clean = blankQuotedMarkup(src);
  const block = clean.match(/const navigation(?::[^=]+)?\s*=\s*\[([\s\S]*?)\n\s*\];/);
  if (!block) return null;
  return [...block[1].matchAll(/\bid:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/** Route dirs that hold a `+page.svelte`. */
function collectPages(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectPages(full, out);
    } else if (entry === '+page.svelte') {
      out.push(dir);
    }
  }
}

const pageDirs: string[] = [];
collectPages(ROUTES, pageDirs);

const findings: Finding[] = [];
const seenExemptions = new Set<string>();
let checked = 0;

for (const dir of pageDirs) {
  const rel = dir.slice(ROUTES.length + 1) || '/';
  if (rel.startsWith('test-fixtures')) continue;

  const pageSrc = readFileSync(join(dir, '+page.svelte'), 'utf8');
  const nav = navIds(pageSrc);
  // No navigation array → the page does not claim a TOC; nothing to compare.
  if (nav === null) continue;

  checked++;

  // Sections live in the route file plus its sibling docs components.
  let markup = pageSrc;
  for (const sibling of readdirSync(dir)) {
    if (sibling.endsWith('.svelte') && sibling !== '+page.svelte') {
      markup += `\n${readFileSync(join(dir, sibling), 'utf8')}`;
    }
  }
  const staged = blankDemoStages(markup);
  const ids = sectionIds(staged);
  // Anchors keep the full markup: a nav entry may legitimately point at an id
  // that lives inside a demo (a page documenting anchors would do exactly that).
  const anchors = anchorIds(markup);

  if (EXEMPT[rel]) {
    seenExemptions.add(rel);
    continue;
  }

  const idSet = new Set(ids);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const dup of new Set(duplicates)) {
    findings.push({
      page: rel,
      kind: 'duplicate-id',
      detail: `two sections share id "${dup}" — the TOC anchor is ambiguous`
    });
  }

  for (const id of nav) {
    if (!anchors.has(id)) {
      findings.push({
        page: rel,
        kind: 'dead-nav-entry',
        detail: `nav entry "${id}" matches no anchor on the page — the TOC link scrolls nowhere`
      });
    }
  }

  const navSet = new Set(nav);
  for (const id of idSet) {
    if (!navSet.has(id)) {
      findings.push({
        page: rel,
        kind: 'unlisted-section',
        detail: `section "${id}" is missing from the nav — unreachable from the TOC`
      });
    }
  }
}

for (const rel of Object.keys(EXEMPT)) {
  if (!seenExemptions.has(rel)) {
    findings.push({
      page: rel,
      kind: 'stale-exemption',
      detail: 'listed in EXEMPT but no longer a TOC page — remove the entry'
    });
  }
}

// A collapse here means the parser drifted, not that the docs got clean.
const MIN_PAGES = 90;
if (checked < MIN_PAGES) {
  console.error(
    `sections-lint: only ${checked} pages carried a navigation array (floor ${MIN_PAGES}). ` +
      `The parser likely drifted — refusing to report a clean run.`
  );
  process.exit(1);
}

console.log(
  `\x1b[1msections-lint\x1b[0m \x1b[90m· ${checked} pages with a table of contents\x1b[0m`
);

if (findings.length === 0) {
  console.log(
    '\x1b[32m✓ every nav entry resolves to a section and every section is listed.\x1b[0m'
  );
  process.exit(0);
}

const byPage = new Map<string, Finding[]>();
for (const f of findings) {
  const list = byPage.get(f.page) ?? [];
  list.push(f);
  byPage.set(f.page, list);
}

console.error(`\n\x1b[31m✗ ${findings.length} finding(s) on ${byPage.size} page(s):\x1b[0m\n`);
for (const [page, list] of [...byPage].sort()) {
  console.error(`  \x1b[1m/${page}\x1b[0m`);
  for (const f of list) console.error(`    [${f.kind}] ${f.detail}`);
}
process.exit(1);
