/**
 * Example-budget lint — the 2–4 rule, enforced instead of merely written down.
 *
 * `docs/DocsPageGuide.md` has carried an Examples budget since the 2026-07
 * triage ("2–4 examples per page is the target… If you have five candidate
 * examples, two probably overlap"), and nothing ever checked it. A rule that
 * exists only as prose is a rule the next page does not inherit.
 *
 * Run against `main` at 2026-08-04, this script reports **17 pages over the
 * ceiling and 2 under the floor** across the 75 component pages — calendar at
 * nine. Those are not the numbers of the hand audit that opened the issue
 * (15 over / 4 under), and the difference is the point: counting a `mint`
 * section with `examples` moves Button from "under" to "over" and Toggle from
 * "under" to inside the budget, and matching the id as `/^mints?$/i` rather
 * than the literal adds segment-group. Quoting the audit's figures here as if
 * they were this script's output would be reporting a number nobody measured
 * with this rule.
 *
 * `examples:lint` in `packages/docs-gen` sounds like this check and is not: it
 * type-checks `@example` JSDoc blocks in `index.ts`. This one counts rendered
 * `<CodeExample>` on documentation pages.
 *
 * Three things the guide leaves open, decided here and not in a reader's head
 * (see `example-budget-lint.rules.ts` for the reasoning):
 *
 *   1. A `mint` section counts WITH `examples`. Guide rule 6 puts Mint patterns
 *      in Examples, so a separate Mint section must not buy extra budget.
 *   2. `installation` never counts, and neither do `customization` (rule 5),
 *      `api` or `types`.
 *   3. A page with no canonical `examples` section needs a `NO_EXAMPLES` entry
 *      with a reason. Same contract as `registry-lint`'s UNLISTED: a stale
 *      entry is an error too, so the list cannot rot into a blanket exemption.
 *
 * Exit 0 clean, 1 on findings.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  blankQuotedMarkup,
  countBySection,
  MAX_EXAMPLES,
  MIN_EXAMPLES,
  sectionTags,
  verdictFor
} from './example-budget-lint.rules';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOCKS = join(APP, 'src/routes/blocks');

/**
 * Pages that deliberately carry no `<Section id="examples">`, with the reason.
 * A stale entry is an error, exactly like `registry-lint`'s UNLISTED.
 */
const NO_EXAMPLES: Record<string, string> = {
  'components/guide':
    'Subsystem page, not a single-component page: the Guide ships a panel, hints, a tour, an ' +
    'analytics hook and the data-guide namespace, and the page is cut into eight topical ' +
    'sections (setup / panel / hint / tour / analytics / namespace / accessibility / ' +
    'customization). No single section exceeds the budget — panel holds 3, tour 2, the rest 1 ' +
    'each. Folding them into one "Examples" heading would bury the topic each reader came for, ' +
    'which is the opposite of what the budget is for.'
};

/**
 * Component-specific sections allowed past the per-section ceiling, keyed
 * `<page>#<section>`, with the reason. Same contract as `NO_EXAMPLES`: a stale
 * entry is an error.
 */
const OVERSIZE_OK: Record<string, string> = {
  'primitives/badge#patterns':
    "One demo per value of Badge's `purpose` axis, and the axis has five (status / tag / counter " +
    '/ dot / chip). The section is the taxonomy that stops the most common colour defect on the ' +
    'page — painting a category as a status — so capping it at four would mean documenting four ' +
    'fifths of an enum. The ceiling is right for a section that has drifted into a second ' +
    'Examples dump; this one is keyed to an API surface and grows only when that surface does.'
};

/**
 * A collapse here means the parser drifted, not that the docs got clean. The
 * corpus was 75 component pages on 2026-08-04; the floor leaves room for pages
 * to come and go without leaving room for half of them to vanish unnoticed.
 */
const MIN_PAGES = 60;

interface Finding {
  page: string;
  kind:
    | 'over-budget'
    | 'under-budget'
    | 'missing-examples'
    | 'oversized-section'
    | 'stale-exemption';
  detail: string;
}

/**
 * The page's markup with every sibling docs component substituted in at its call
 * site, so examples land in the section that renders them. A page renders
 * `<CustomDocs />` between its playground and its API section; appending the
 * sibling instead would attribute every one of its examples to `installation`.
 */
function splice(dir: string, pageSrc: string): { markup: string; tags: string[] } {
  let markup = blankQuotedMarkup(pageSrc);
  const tags = new Set(sectionTags(pageSrc));
  for (const sibling of readdirSync(dir)) {
    if (!sibling.endsWith('.svelte') || sibling === '+page.svelte') continue;
    const local = markup.match(
      new RegExp(`import\\s+(\\w+)\\s+from\\s+['"]\\./${sibling.replace('.', '\\.')}['"]`)
    )?.[1];
    if (!local) continue;
    const call = new RegExp(`<${local}\\b[^>]*/>`);
    if (!call.test(markup)) continue;
    const src = readFileSync(join(dir, sibling), 'utf8');
    for (const t of sectionTags(src)) tags.add(t);
    markup = markup.replace(call, blankQuotedMarkup(src));
  }
  return { markup, tags: [...tags] };
}

/** Component page dirs: `blocks/<group>/<slug>` holding a `+page.svelte`. */
function collectPages(): string[] {
  const out: string[] = [];
  for (const group of ['primitives', 'components']) {
    const groupDir = join(BLOCKS, group);
    for (const slug of readdirSync(groupDir)) {
      const dir = join(groupDir, slug);
      if (!statSync(dir).isDirectory()) continue;
      try {
        statSync(join(dir, '+page.svelte'));
      } catch {
        continue;
      }
      out.push(`${group}/${slug}`);
    }
  }
  return out.sort();
}

const findings: Finding[] = [];
const seenExemptions = new Set<string>();
const seenOversizeOk = new Set<string>();
const rows: { page: string; total: number; detail: string }[] = [];

for (const rel of collectPages()) {
  const dir = join(BLOCKS, rel);
  const pageSrc = readFileSync(join(dir, '+page.svelte'), 'utf8');
  const { markup, tags } = splice(dir, pageSrc);
  const counts = countBySection(markup, tags);
  const { total, counted, oversized, verdict } = verdictFor(counts);

  const detail = counted.map((c) => `${c.id}:${c.examples}`).join(' ') || '—';
  rows.push({ page: rel, total, detail });

  // The per-section ceiling applies to EVERY page, including the ones excused
  // from the page total. `NO_EXAMPLES` excuses a page from having one canonical
  // Examples section — it does not excuse a topical section from growing into
  // an unread wall. The `components/guide` entry justifies itself with exactly
  // this property ("no single section exceeds the budget"), so the check has to
  // be the one the reason claims; otherwise the written reason and the executed
  // test are two different statements, and only one of them is enforced.
  for (const s of oversized) {
    const key = `${rel}#${s.id}`;
    if (OVERSIZE_OK[key]) {
      seenOversizeOk.add(key);
      continue;
    }
    findings.push({
      page: rel,
      kind: 'oversized-section',
      detail: `section "${s.id}" holds ${s.examples} examples — more than the ${MAX_EXAMPLES} the whole page is allowed. A topical section is fine; a second Examples section under another name is not. If it is keyed to an API surface rather than drift, record it in OVERSIZE_OK with the reason.`
    });
  }

  if (verdict === 'missing') {
    if (NO_EXAMPLES[rel]) {
      seenExemptions.add(rel);
      continue;
    }
    findings.push({
      page: rel,
      kind: 'missing-examples',
      detail:
        'no `<Section id="examples">` — the guide lists Examples as a required section. ' +
        'Add one, or record the page in NO_EXAMPLES with a reason.'
    });
    continue;
  }

  if (NO_EXAMPLES[rel]) {
    seenExemptions.add(rel);
    findings.push({
      page: rel,
      kind: 'stale-exemption',
      detail: 'listed in NO_EXAMPLES but the page now has an examples section — remove the entry'
    });
    continue;
  }

  if (verdict === 'over') {
    findings.push({
      page: rel,
      kind: 'over-budget',
      detail: `${total} examples (${detail}) — budget is ${MAX_EXAMPLES}. Merge the two that answer the same question, or drop the prop permutations the Playground already covers.`
    });
  } else if (verdict === 'under') {
    findings.push({
      page: rel,
      kind: 'under-budget',
      detail: `${total} example(s) (${detail}) — the floor is ${MIN_EXAMPLES}. Usually the material is on the page already, sitting in a section a reader browsing for examples never reaches.`
    });
  }
}

for (const rel of Object.keys(NO_EXAMPLES)) {
  if (!seenExemptions.has(rel)) {
    findings.push({
      page: rel,
      kind: 'stale-exemption',
      detail: 'listed in NO_EXAMPLES but is no longer a component page — remove the entry'
    });
  }
}

for (const key of Object.keys(OVERSIZE_OK)) {
  if (!seenOversizeOk.has(key)) {
    findings.push({
      page: key,
      kind: 'stale-exemption',
      detail:
        'listed in OVERSIZE_OK but the section is no longer over the per-section ceiling — ' +
        'remove the entry'
    });
  }
}

if (rows.length < MIN_PAGES) {
  console.error(
    `example-budget-lint: only ${rows.length} component pages found (floor ${MIN_PAGES}). ` +
      'The parser likely drifted — refusing to report a clean run.'
  );
  process.exit(1);
}

console.log(
  `\x1b[1mexample-budget-lint\x1b[0m \x1b[90m· ${rows.length} component pages · budget ${MIN_EXAMPLES}–${MAX_EXAMPLES}\x1b[0m`
);

if (findings.length === 0) {
  console.log(
    `\x1b[32m✓ every component page carries ${MIN_EXAMPLES}–${MAX_EXAMPLES} examples.\x1b[0m`
  );
  process.exit(0);
}

console.error(`\n\x1b[31m✗ ${findings.length} finding(s):\x1b[0m\n`);
for (const f of findings) {
  console.error(`  \x1b[1m/blocks/${f.page}\x1b[0m`);
  console.error(`    [${f.kind}] ${f.detail}`);
}
process.exit(1);
