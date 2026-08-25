#!/usr/bin/env bun
/**
 * registry-lint — guards the hand-written registries a docs page has to be
 * entered into, against the routes and the generated catalogs.
 *
 * A new page is registered by hand in three places, and until this existed
 * nothing compared them:
 *
 *   1. `src/lib/navigation.ts`   — the sidebar tree (and, derived from it, the
 *      command palette, the prev/next reading chain and the `/blocks` register)
 *   2. `src/lib/component-links.ts` — `componentLinks`, name → route, the table
 *      `buildRelatedLinks` reads for the `@related` chips
 *   3. `src/routes/recipes/recipe-meta.ts` — `RECIPE_ORDER`, the cookbook contents
 *
 * Forgetting one is silent in every direction: the page exists and simply never
 * appears in the sidebar, and a `@related` pointing at it is dropped without a
 * word (`buildRelatedLinks` skips unknown names by design, so a typo does not
 * render a dead link). The first measured run found 23 catalogue components
 * whose page existed while their related-chips went nowhere, and three recipes
 * that were in the cookbook but in no sidebar.
 *
 * Deliberately NOT a generator. The sidebar's grouping and ordering are an
 * editorial decision the catalogue does not carry — the six-family taxonomy is
 * not a nav structure. So this compares, and leaves the writing to a human.
 *
 * What it checks:
 *   1. every catalogue entry with a `+page.svelte` is in `componentLinks`, and
 *      points at its own page
 *   1b. every catalogue entry WITHOUT one is in PAGELESS below with a reason.
 *      This used to be a bare `continue`, and that is how `NoteList` shipped
 *      exported, catalogued, with a generated api.ts in a route directory and
 *      no page — for a whole release, with this lint green.
 *   2. every `componentLinks` href resolves to an existing page
 *   3. every page under `src/routes` appears in the sidebar, unless it is in
 *      UNLISTED below with a reason
 *   4. every recipe page is in the cookbook index (drafts excepted — they are
 *      pruned from both by `DRAFT_ROUTES`)
 *   5. every component chip on a recipe card resolves through `componentLinks`,
 *      rather than rendering as an unlinked badge
 *
 * An unlisted page and a stale UNLISTED entry (one that matches no page, or
 * only pages that are in the nav anyway) are both errors — the stale check is
 * what keeps the exception list shrinking as pages get listed, the same
 * contract as the ALLOWLIST in blocks' imports-lint.
 *
 * Reads the generated catalogs, so run `bun run docs:gen:all` first.
 *
 * Run: `bun run registry:lint`
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { closingIndex } from './playgrounds-lint.rules';

/**
 * Pages that are deliberately absent from the sidebar, each with the reason.
 * A trailing `/**` matches a whole subtree; everything else is one exact route.
 */
const UNLISTED: ReadonlyArray<readonly [route: string, why: string]> = [
  [
    '/test-fixtures/**',
    'internal Playwright/VR fixtures — prerender: false, out of sitemap+search'
  ],
  [
    '/table/sticky-pinning/contained',
    'the live fit="viewport" demo — framed on /table/sticky-pinning and opened from it. A page ' +
      'of its own because the contained model caps against the top of the DOCUMENT, so it cannot ' +
      'be shown inside an article column'
  ],
  ['/imprint', 'legal page, reached from the footer'],
  ['/privacy', 'legal page, reached from the footer'],
  ['/hotel', 'landing-page exhibit — entered through the landing "visit the hotel" door'],
  ['/ai/chat', 'live playground, deep-linked from the Chat / ChatMessage / ChatMessageList pages'],
  ['/ai/streaming-markdown', 'renderer harness over the markdown fixture corpus, not a doc page']
];

/**
 * Catalogue entries that deliberately have no page of their own, each with the
 * reason. Same contract as UNLISTED: a page-less entry missing from here is an
 * error, and so is an entry here that has since gained a page or left the
 * catalogue.
 */
const PAGELESS: Record<string, string> = {
  InlineCode:
    'embedded rendering detail of CodeExample/ApiReference/PlaygroundConfigurator (backtick spans in generated descriptions become <code>) — aliased onto /docs/components/code-example, where its effect is on screen',
  GuideArticle: 'guide surface — documented as a family on /blocks/components/guide',
  GuideBeacon: 'guide surface — documented as a family on /blocks/components/guide',
  GuideHint: 'guide surface — documented as a family on /blocks/components/guide',
  GuideMarker: 'guide surface — documented as a family on /blocks/components/guide',
  GuideMention: 'guide surface — documented as a family on /blocks/components/guide',
  GuidePanel: 'guide surface — documented as a family on /blocks/components/guide',
  GuideProvider: 'guide surface — documented as a family on /blocks/components/guide',
  GuideRef: 'guide surface — documented as a family on /blocks/components/guide'
};

/** Where a catalogue entry's page lives, per package. */
const CATALOGS: ReadonlyArray<{
  readonly dir: string;
  readonly route: (e: CatalogEntry) => string;
}> = [
  { dir: 'blocks', route: (e) => `/blocks/${e.group}/${e.slug}` },
  // The table package documents one component at the root of its section.
  { dir: 'table', route: (e) => `/table/${e.slug}` },
  { dir: 'auth', route: (e) => `/auth/${e.group}/${e.slug}` },
  // The docs package's own components. Its catalogue was empty until the
  // internal-component filter moved to the MCP assembler, so these nine pages
  // were never checked against anything.
  { dir: 'docs', route: (e) => `/docs/components/${e.slug}` }
];

interface CatalogEntry {
  name: string;
  slug: string;
  group: string;
}

/**
 * Sanity floors — a collapse means glob or parser drift, not a clean run. A
 * regex that stops matching would otherwise report "everything consistent"
 * over an empty set, which is the one failure mode a comparison gate cannot
 * afford. Raise them as the site grows.
 */
const MIN_PAGES = 150;
const MIN_CATALOG = 90;
const MIN_LINKS = 90;
const MIN_NAV = 150;
const MIN_RECIPES = 20;
const MIN_CHIPS = 100;

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  gray: '\x1b[90m'
};

const APP = new URL('..', import.meta.url).pathname;
const ROUTES = join(APP, 'src/routes');
const STATIC = join(APP, 'static');

type Finding = { where: string; detail: string };
const errors: Finding[] = [];

// ── The routes that exist ────────────────────────────────────────────────────
// A page is a `+page.svelte`. A `+page.ts`-only route is a redirect (legacy
// slugs, breadcrumb levels) and documents nothing, so it is neither required in
// a registry nor a valid link target.
function collectPages(dir: string, prefix: string, out: Set<string>): void {
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      // Route groups `(name)` and param dirs contribute no literal segment we
      // could compare against a hand-written href, so this script cannot check
      // what is inside them. It used to say "skipped loudly" and then skip
      // silently — which means the first route group anyone adds takes its
      // whole subtree out of the guard without a word. Now it is loud: the app
      // has neither today, so this is a "teach me first" error, not a ban.
      if (entry.startsWith('(') || entry.startsWith('[')) {
        errors.push({
          where: `src/routes${prefix}/${entry}`,
          detail:
            `${entry} is a route group or param directory, and this script cannot derive the ` +
            `URLs inside it — everything below it would go unchecked. Teach collectPages how to ` +
            `resolve it (a group contributes no segment; a param needs the concrete values), or ` +
            `move the pages out.`
        });
        continue;
      }
      collectPages(p, `${prefix}/${entry}`, out);
    } else if (entry === '+page.svelte') {
      out.add(prefix === '' ? '/' : prefix);
    }
  }
}

const pages = new Set<string>();
collectPages(ROUTES, '', pages);

// ── The three hand-written registries ────────────────────────────────────────
// Parsed as text, not imported: both modules import `$app/paths` (and
// navigation.ts `$lib/i18n`), which only resolve inside Vite — a lint that
// needed `svelte-kit sync` to run would be a lint nobody runs.
const linksSrc = readFileSync(join(APP, 'src/lib/component-links.ts'), 'utf8');
/**
 * Blank out comments, keeping offsets, before any regex reads the file.
 *
 * Every list below is parsed out of raw source with a `'…'` pattern, and a
 * comment is source. So commenting an entry out — the everyday way to hide a
 * page for a while — left it counted as registered, and this script then
 * reported "every page is in the sidebar" about a page that was in none.
 * Measured 2026-08: with `{ name: 'Badge', href: '/blocks/primitives/badge' }`
 * commented out, the nav href count stayed at 163 and the run stayed green;
 * deleting the same line drops it to 162 and raises the error.
 */
function blankComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead: string) => lead + ' '.repeat(m.length - lead.length));
}

const navSrc = blankComments(readFileSync(join(APP, 'src/lib/navigation.ts'), 'utf8'));

const linksAt = linksSrc.indexOf('export const componentLinks');
const linksOpen = linksSrc.indexOf('{', linksAt);
const linksBody =
  linksAt < 0 ? '' : linksSrc.slice(linksOpen + 1, closingIndex(linksSrc, linksOpen, '{', '}'));
/** component name → route, in source order. */
const componentLinks = new Map<string, string>(
  [...linksBody.matchAll(/^\s*(\w+):\s*'([^']+)'/gm)].map((m) => [m[1], m[2]])
);

/**
 * Every `href:` in navigation.ts — read from `allNavigationItems`, i.e. BEFORE
 * `pruneDrafts`, so a draft page still counts as registered. Being hidden from
 * the built site is what `DRAFT_ROUTES` says; being unregistered is not.
 */
const navHrefs = new Set([...navSrc.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]));

// The draft switch has to be read, not assumed: an empty fallback would make
// check 4 demand a cookbook entry for exactly the pages that are meant to have
// none.
const draftBlock = navSrc.match(/DRAFT_ROUTES[^=]*=\s*new Set<NavHref>\(\[([\s\S]*?)\]\)/);
if (!draftBlock) {
  errors.push({
    where: 'src/lib/navigation.ts',
    detail: 'cannot read DRAFT_ROUTES — the parser below drifted from the source, fix it here'
  });
}
const draftRoutes = new Set([...(draftBlock?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]));

/**
 * The cookbook's contents, read from `RECIPE_ORDER`.
 *
 * The index used to hold a literal card per recipe — title, description and
 * component list copied out of the recipe's own `meta.ts`. All 22 had drifted
 * from their source, so the cards are now derived and this list of slugs is all
 * that is hand-kept. A missing slug means the recipe appears nowhere, which is
 * what check 4 below is for.
 */
const orderSrc = blankComments(readFileSync(join(ROUTES, 'recipes/recipe-meta.ts'), 'utf8'));
const orderBlock = orderSrc.match(/RECIPE_ORDER\s*=\s*\[([\s\S]*?)\]\s*as const;/);
if (!orderBlock) {
  errors.push({
    where: 'src/routes/recipes/recipe-meta.ts',
    detail: 'cannot read RECIPE_ORDER — the parser here drifted from the source, fix it here'
  });
}
const cookbookHrefs = new Set(
  [...(orderBlock?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => `/recipes/${m[1]}`)
);

// ── 1. catalogue → componentLinks ────────────────────────────────────────────
let catalogEntries = 0;
let documented = 0;
const pagelessSeen = new Set<string>();

for (const { dir, route } of CATALOGS) {
  const file = join(STATIC, dir, '_catalog.json');
  if (!existsSync(file)) {
    errors.push({
      where: `static/${dir}/_catalog.json`,
      detail: 'catalog is missing — run `bun run docs:gen:all` first'
    });
    continue;
  }
  for (const entry of JSON.parse(readFileSync(file, 'utf8')) as CatalogEntry[]) {
    catalogEntries++;
    const href = route(entry);
    if (!pages.has(href)) {
      // Aliasing onto a family page is legitimate, but it is a decision, not a
      // default — an entry that lands here without one is a component nobody
      // wrote a page for.
      if (entry.name in PAGELESS) {
        pagelessSeen.add(entry.name);
        // The exemption says the component "documents elsewhere". That claim
        // was never checked: the `continue` below skipped the componentLinks
        // check, so the second damage this script exists to prevent — an
        // `@related` chip silently dropped because `buildRelatedLinks` cannot
        // resolve the name — was unguarded for exactly the exempted names.
        // Measured 2026-08: removing `GuideArticle` from component-links.ts
        // left the run green, while doing the same to any name WITH a page was
        // loud. So a page-less name must point somewhere too.
        if (!componentLinks.has(entry.name)) {
          errors.push({
            where: 'src/lib/component-links.ts',
            detail:
              `${entry.name} is exempted in PAGELESS as "${PAGELESS[entry.name]}", but has no ` +
              `\`componentLinks\` entry — so every \`@related\` chip pointing at it is dropped ` +
              `without a word. The exemption says it documents elsewhere; name that page here.`
          });
        }
      } else
        errors.push({
          where: `static/${dir}/_catalog.json`,
          detail:
            `${entry.name} is in the catalogue but has no page at ${href}. Either write one, ` +
            `or add it to PAGELESS in this script with the reason it documents elsewhere.`
        });
      continue;
    }
    if (entry.name in PAGELESS) {
      errors.push({
        where: 'PAGELESS',
        detail: `${entry.name} now has a page at ${href} — remove the PAGELESS entry.`
      });
    }
    documented++;
    const linked = componentLinks.get(entry.name);
    if (!linked) {
      errors.push({
        where: `static/${dir}/_catalog.json`,
        detail:
          `${entry.name} has a page at ${href} but no \`componentLinks\` entry — every ` +
          `\`@related\` chip pointing at ${entry.name} is silently dropped. Add ` +
          `\`${entry.name}: '${href}'\` to src/lib/component-links.ts.`
      });
    } else if (linked !== href) {
      errors.push({
        where: 'src/lib/component-links.ts',
        detail:
          `${entry.name} links to ${linked}, but its own page is ${href} — a component with a ` +
          `page of its own must link to it (only a page-less name may alias onto a family page).`
      });
    }
  }
}

// A PAGELESS name that no catalogue entry carries is stale — the component was
// renamed or removed and the exemption outlived it.
for (const name of Object.keys(PAGELESS)) {
  if (!pagelessSeen.has(name)) {
    errors.push({
      where: 'PAGELESS',
      detail: `${name} is not in any catalogue — remove the entry.`
    });
  }
}

// ── 2. componentLinks → routes ───────────────────────────────────────────────
for (const [name, href] of componentLinks) {
  if (!pages.has(href)) {
    errors.push({
      where: 'src/lib/component-links.ts',
      detail: `${name} links to ${href}, which has no \`+page.svelte\` — dead related-chip.`
    });
  }
}

// ── 3. pages → sidebar ───────────────────────────────────────────────────────
const exact = new Map(UNLISTED.filter(([r]) => !r.endsWith('/**')));
const prefixes = UNLISTED.filter(([r]) => r.endsWith('/**')).map(
  ([r]) => [r, r.slice(0, -'/**'.length)] as const
);
/** The UNLISTED entry covering a route, or undefined. */
const exemptionFor = (route: string): string | undefined =>
  exact.has(route) ? route : prefixes.find(([, p]) => route.startsWith(`${p}/`))?.[0];

/** UNLISTED key → the routes it covered, for the stale check below. */
const exemptionUse = new Map<string, string[]>();

for (const route of [...pages].sort()) {
  const exemption = exemptionFor(route);
  if (exemption) {
    exemptionUse.set(exemption, [...(exemptionUse.get(exemption) ?? []), route]);
    continue;
  }
  if (!navHrefs.has(route)) {
    errors.push({
      where: `src/routes${route === '/' ? '' : route}/+page.svelte`,
      detail:
        `${route} is a page that appears in no navigation surface — add it to ` +
        `\`allNavigationItems\` in src/lib/navigation.ts, or, if it is deliberately ` +
        `unlisted, to UNLISTED in this script with the reason.`
    });
  }
}

for (const [key, why] of UNLISTED) {
  const covered = exemptionUse.get(key) ?? [];
  if (covered.length === 0) {
    errors.push({
      where: 'UNLISTED',
      detail: `stale entry '${key}' (${why}) — no such page exists any more, remove it.`
    });
  } else if (covered.every((route) => navHrefs.has(route))) {
    errors.push({
      where: 'UNLISTED',
      detail:
        `stale entry '${key}' (${why}) — ${covered.join(', ')} ${covered.length > 1 ? 'are' : 'is'} ` +
        `in the sidebar now, so the exception buys nothing. Remove it.`
    });
  }
}

// ── 3b. sidebar → routes ─────────────────────────────────────────────────────
// The `NavHref` type already rejects an unknown route at check time; this is
// the same statement without a `svelte-kit sync` + full type-check in front of
// it, so a rename shows up in the gate that runs in a second.
for (const href of navHrefs) {
  if (!pages.has(href)) {
    errors.push({
      where: 'src/lib/navigation.ts',
      detail: `nav entry points at ${href}, which has no \`+page.svelte\`.`
    });
  }
}

// ── 4. recipes → cookbook index ──────────────────────────────────────────────
const recipePages = [...pages].filter((r) => r.startsWith('/recipes/')).sort();
for (const route of recipePages) {
  if (draftRoutes.has(route)) {
    if (cookbookHrefs.has(route)) {
      errors.push({
        where: 'src/routes/recipes/+page.svelte',
        detail:
          `${route} is a DRAFT_ROUTE but RECIPE_ORDER still lists it — a draft is hidden ` +
          `everywhere or nowhere.`
      });
    }
    continue;
  }
  if (!cookbookHrefs.has(route)) {
    errors.push({
      where: `src/routes${route}/+page.svelte`,
      detail:
        `${route} is missing from the cookbook index — add its slug to RECIPE_ORDER in ` +
        `src/routes/recipes/recipe-meta.ts, or mark the page a draft via DRAFT_ROUTES.`
    });
  }
}
for (const href of cookbookHrefs) {
  if (!pages.has(href)) {
    errors.push({
      where: 'src/routes/recipes/recipe-meta.ts',
      detail: `RECIPE_ORDER lists ${href}, which has no \`+page.svelte\`.`
    });
  }
}

// ── 5. component chips → componentLinks ──────────────────────────────────────
// The `components: [...]` list on a recipe is rendered as linked chips through
// `componentLinks[name]`. A name with no entry renders as an unlinked badge —
// legible, but silently missing the link the reader expects, which is what this
// check is for. Only the hand-written metadata is read: a `components:` key
// also appears inside A2UI payload literals on the demo pages, where the names
// are node ids and mean nothing here.
const chipSources = [
  'src/routes/recipes/+page.svelte',
  ...recipePages.map((r) => `src/routes${r}/meta.ts`)
].filter((f) => existsSync(join(APP, f)));

let chips = 0;
for (const file of chipSources) {
  const src = readFileSync(join(APP, file), 'utf8');
  for (const block of src.matchAll(/components:\s*\[([^\]]*)\]/g)) {
    for (const m of block[1].matchAll(/'([A-Za-z][\w]*)'/g)) {
      chips++;
      if (!componentLinks.has(m[1])) {
        errors.push({
          where: file,
          detail:
            `the component chip "${m[1]}" has no \`componentLinks\` entry, so it renders as an ` +
            `unlinked badge. Add it to src/lib/component-links.ts (a sub-component aliases onto ` +
            `the page that documents it, e.g. RadioItem → the RadioGroup page).`
        });
      }
    }
  }
}

// ── Sanity floors ────────────────────────────────────────────────────────────
if (
  pages.size < MIN_PAGES ||
  catalogEntries < MIN_CATALOG ||
  componentLinks.size < MIN_LINKS ||
  navHrefs.size < MIN_NAV ||
  recipePages.length < MIN_RECIPES ||
  chips < MIN_CHIPS
) {
  console.error(
    `${c.red}✖ registry-lint read ${pages.size} pages / ${catalogEntries} catalog entries / ` +
      `${componentLinks.size} componentLinks / ${navHrefs.size} nav hrefs / ${recipePages.length} recipes / ` +
      `${chips} chips (floors: ${MIN_PAGES}/${MIN_CATALOG}/${MIN_LINKS}/${MIN_NAV}/${MIN_RECIPES}/` +
      `${MIN_CHIPS}) — route or parser drift, the guard would run blind.${c.reset}`
  );
  process.exit(1);
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log(
  `\n${c.bold}registry-lint${c.reset} ${c.gray}· ${pages.size} pages, ${catalogEntries} catalog ` +
    `entries (${documented} with a page), ${componentLinks.size} componentLinks, ` +
    `${navHrefs.size} nav hrefs, ${recipePages.length} recipes, ${chips} component chips${c.reset}\n`
);

if (errors.length) {
  console.error(
    `${c.red}${c.bold}Errors (${errors.length})${c.reset} ${c.gray}— must fix${c.reset}`
  );
  for (const f of errors) {
    console.error(`  ${c.red}${f.where}${c.reset}`);
    console.error(`    ${f.detail}`);
  }
  console.error(`\n${c.red}✖ ${errors.length} error(s)${c.reset}\n`);
  process.exit(1);
}

console.log(
  `${c.green}✓ every documented component is in componentLinks, every link and every recipe chip ` +
    `resolves; every page is in the sidebar (${UNLISTED.length} justified exceptions) and every ` +
    `recipe in the cookbook; every catalogue entry has a page or a reason ` +
    `(${Object.keys(PAGELESS).length} justified).${c.reset}\n`
);
