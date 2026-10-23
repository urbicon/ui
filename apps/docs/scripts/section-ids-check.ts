#!/usr/bin/env bun
/**
 * section-ids-check — no two `<section>` elements of a built page share an id.
 *
 * A docs page writes its section ids by hand, and a repeat breaks nothing
 * visible: the table of contents lists the id once, under the first section;
 * `#id` reaches only that one; and the second section's `aria-labelledby`
 * (`{id}-title`) names it after the first section's heading. In the browser
 * the section registry warns about it, in development only.
 *
 * This asks the prerendered site, the HTML the deploy ships: every page the
 * static build wrote, every `<section id>` in it, read by Bun's HTML parser.
 * Demo stages count like any other part of the page — two `CodeExample`
 * stages that each render `<Section id="demo">` put one id on two elements,
 * whichever table of contents lists them.
 *
 * Only sections. Other elements do repeat ids on built pages — the Guide page's
 * prop rows across its several prop tables, `id="main-content"` in two
 * SidebarLayout demos — so widening this to every id means deciding about
 * those first.
 *
 * Run: `bun run section-ids:check` after `bun run build` (it reads
 * `apps/docs/dist`). `--dist <dir>` reads another build; its positive controls
 * (`section-ids-check.test.ts`) point it at a fixture.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const APP_DIST = join(import.meta.dirname, '../dist');

function htmlFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) htmlFiles(path, out);
    else if (entry.endsWith('.html')) out.push(path);
  }
  return out;
}

/** The id of every `<section id>` in a document, in document order. */
function sectionIds(html: string): string[] {
  const ids: string[] = [];
  new HTMLRewriter()
    .on('section[id]', {
      element(el) {
        ids.push(el.getAttribute('id') ?? '');
      }
    })
    .transform(html);
  return ids;
}

function check(dist: string): number {
  let files: string[];
  try {
    files = htmlFiles(dist);
  } catch (error) {
    const { code, path } = error as { code?: string; path?: string };
    if (code !== 'ENOENT' || path !== dist) throw error;
    console.error(`section-ids-check: no build to check — ${dist} does not exist.`);
    return 1;
  }

  const repeats: string[] = [];
  let sections = 0;
  for (const file of files) {
    const counts = new Map<string, number>();
    for (const id of sectionIds(readFileSync(file, 'utf8'))) {
      sections++;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const [id, n] of counts) {
      if (n > 1) repeats.push(`${relative(dist, file)}: ${n} sections share the id "${id}"`);
    }
  }

  // Reading nothing looks exactly like reading a clean site. A static build of
  // this app always writes pages, and its pages are made of sections.
  if (files.length === 0 || sections === 0) {
    console.error(
      `section-ids-check: read ${files.length} page(s) and ${sections} <section id> under ` +
        `${dist} — the check saw nothing to compare.`
    );
    return 1;
  }

  if (repeats.length > 0) {
    console.error(`\n\x1b[31m✗ section-ids-check: ${repeats.length} repeated id(s)\x1b[0m`);
    for (const r of repeats) console.error(`  ${r}`);
    console.error(
      '  Give each section its own id: the table of contents lists only the first, and ' +
        '#id reaches only that one.'
    );
    return 1;
  }

  console.log(
    `\x1b[32m✓ section-ids-check: ${sections} <section id> on ${files.length} pages, ` +
      `none repeated within a page.\x1b[0m`
  );
  return 0;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf('--dist');
  const given = at === -1 ? null : argv[at + 1];
  // `--dist` with nothing behind it would otherwise read the app's own build
  // and report it clean for a build the caller never named.
  if (at !== -1 && (!given || given.startsWith('--'))) {
    console.error('section-ids-check: --dist needs a directory');
    process.exit(2);
  }
  process.exit(check(given ? resolve(given) : APP_DIST));
}
