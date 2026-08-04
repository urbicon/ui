#!/usr/bin/env bun
/**
 * typesref-lint — a docs page's Types section against the types its `api.ts`
 * actually carries.
 *
 * NOT `types:guard` (root `scripts/types-guard.ts`), which asserts that every
 * published module ships its `.d.ts`. This one is about the docs site: whether
 * the page a reader lands on documents the types its own API table names.
 *
 * The wiring a component page needs is two hand-written halves, and *both*
 * halves fail silently when they are missing:
 *
 *   1. `<TypesReference types={componentData.types} />` — the table that
 *      documents the types, and the `#type-<Name>` anchor every link targets.
 *   2. `types={componentData.types}` on `<ApiReference>` — the prop that makes
 *      those links exist at all. `ApiReference.svelte` derives `knownTypeNames`
 *      from it, and `tokenizeTypeExpression` returns the whole expression as
 *      one unlinked segment when the set is empty. So a page without it renders
 *      every type name in its Type column as dead text — no error, no styling
 *      difference a reviewer would notice, just a reference the reader cannot
 *      follow.
 *
 * Half-wired is worse than unwired, and four pages shipped that way:
 * command-palette, date-range-picker, number-input and theme-switcher pass
 * `types=` to `<ApiReference>` and render no `<TypesReference>`. Every link
 * they emit falls through `revealTableRow`'s `fallbackSectionId: 'types'` to a
 * section that does not exist, so the click does nothing at all.
 *
 * So the rule runs in both directions:
 *   a. a page whose `api.ts` carries a documentable type MUST render a
 *      `<TypesReference>` and MUST pass `types=` to its `<ApiReference>`;
 *   b. a page that passes `types=` MUST render a `<TypesReference>`.
 *
 * ── What counts as "documentable" ──────────────────────────────────────────
 * The same filter the pages themselves will apply (issue #114 stage 3):
 *
 *     t.exported && (!t.owner || t.owner === componentData.name)
 *
 * `exported` (added by docs-gen, resolved through `package.json#exports`) drops
 * the types a consumer cannot import; `owner` drops the ones whose canonical
 * home is another component's page. Measured 2026-08-04: 967 extracted type
 * entries across 108 `api.ts`, 661 of them documentable — and all 108 carry at
 * least one, so "has nothing to document" is not a live exemption today.
 *
 * ── The trap this has to survive ───────────────────────────────────────────
 * A page can satisfy the letter of the rule and still be dead. `types={[]}`,
 * `types={undefined}` or a hand-written demo array all put a `types=` on the
 * tag while feeding the component nothing the generator produced — the same
 * shape as the namespace import that used to walk through blocks' imports-lint.
 * So the attribute is not merely counted, it is *resolved*: the expression must
 * reach a `componentData` imported from an `api` module, directly or through
 * one local const (`typesForTypesReference`). Anything else is reported, and an
 * expression this script cannot resolve at all is reported too rather than
 * assumed good — see `resolveTypesExpression`.
 *
 * Demo instances are excluded before any of that, by the same blanking
 * `sections-lint` uses: a `<TypesReference types={sampleTypes}>` inside a
 * `<CodeExample>` is the *subject* of the TypesReference docs page, not its
 * Types section, and the types-reference page really does render one (plus a
 * `types={[]}` empty-state demo, verbatim the trap above).
 *
 * ── Relationship to sections-lint ──────────────────────────────────────────
 * None, deliberately. `sections-lint` counts `types` as a valid anchor as soon
 * as `<TypesReference` appears in the markup (`COMPONENT_ANCHORS`) and reads
 * only `<Section>` tags for the listed-sections side, so adding a
 * `<TypesReference>` neither requires nor forbids a `{ id: 'types' }` nav
 * entry. Nothing here changes that.
 *
 * Reads the generated `api.ts` files, so run `bun run docs:gen:all` first.
 *
 * Run: `bun run typesref:lint`
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closingIndex } from './playgrounds-lint.rules';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES = join(APP, 'src/routes');

/**
 * The pre-existing backlog, one entry per page, each pointing at the issue that
 * empties it. Introduced 2026-08-04 alongside the rule: 93 of the 100 pages
 * with an `api.ts` were never wired, so gating on the rule alone would have
 * meant a red CI with no fix in the same change.
 *
 * Same contract as blocks' imports-lint ALLOWLIST and variants-lint's
 * HAND_WRITTEN_CSS — **the list may only SHRINK, never grow**, and both stale
 * directions are errors: an entry whose page no longer exists, and an entry
 * whose page is conformant now (the exception buys nothing). Stage 3 of #114
 * wires the pages and deletes this map with them; `PENDING_AT_INTRODUCTION`
 * below is what stops it being topped up in the meantime.
 *
 * The reason is the same sentence on every entry on purpose. This is one
 * decision enumerated 93 times, not 93 decisions — enumerating it is what makes
 * the sweep auditable, because a page the sweep misses stays in the map and the
 * map is checked.
 */
const STAGE_3 = 'never wired — #114 stage 3 adds the Types section and deletes this entry';

const PENDING_STAGE3: Record<string, string> = {
  '/auth/components/account-settings': STAGE_3,
  '/auth/components/forgot-password-page': STAGE_3,
  '/auth/components/invitation-manager': STAGE_3,
  '/auth/components/login-page': STAGE_3,
  '/auth/components/notification-badge': STAGE_3,
  '/auth/components/notification-center': STAGE_3,
  '/auth/components/notification-listener': STAGE_3,
  '/auth/components/passkey-manager': STAGE_3,
  '/auth/components/push-permission-prompt': STAGE_3,
  '/auth/components/register-page': STAGE_3,
  '/auth/components/reset-password-page': STAGE_3,
  '/auth/components/session-manager': STAGE_3,
  '/auth/components/two-factor-manager': STAGE_3,
  '/auth/components/verify-email-page': STAGE_3,
  '/blocks/components/a2-ui-view': STAGE_3,
  '/blocks/components/area-chart': STAGE_3,
  '/blocks/components/avatar-group': STAGE_3,
  '/blocks/components/bar-chart': STAGE_3,
  '/blocks/components/calendar': STAGE_3,
  '/blocks/components/chart-frame': STAGE_3,
  '/blocks/components/chat': STAGE_3,
  '/blocks/components/chat-message': STAGE_3,
  '/blocks/components/chat-message-list': STAGE_3,
  '/blocks/components/citation-chip': STAGE_3,
  '/blocks/components/code-block': STAGE_3,
  '/blocks/components/command-palette': STAGE_3,
  '/blocks/components/composition-bar': STAGE_3,
  '/blocks/components/copy-button': STAGE_3,
  '/blocks/components/currency-input': STAGE_3,
  '/blocks/components/date-picker': STAGE_3,
  '/blocks/components/date-range-picker': STAGE_3,
  '/blocks/components/donut-chart': STAGE_3,
  '/blocks/components/empty-state': STAGE_3,
  '/blocks/components/file-upload': STAGE_3,
  '/blocks/components/guide': STAGE_3,
  '/blocks/components/line-chart': STAGE_3,
  '/blocks/components/locale-switcher': STAGE_3,
  '/blocks/components/number-input': STAGE_3,
  '/blocks/components/pin-input': STAGE_3,
  '/blocks/components/planner': STAGE_3,
  '/blocks/components/prompt-input': STAGE_3,
  '/blocks/components/qr-code': STAGE_3,
  '/blocks/components/reasoning-disclosure': STAGE_3,
  '/blocks/components/sankey': STAGE_3,
  '/blocks/components/sidebar-layout': STAGE_3,
  '/blocks/components/sparkline': STAGE_3,
  '/blocks/components/streaming-markdown': STAGE_3,
  '/blocks/components/theme-switcher': STAGE_3,
  '/blocks/components/time-input': STAGE_3,
  '/blocks/components/tool-call-card': STAGE_3,
  '/blocks/primitives/accordion': STAGE_3,
  '/blocks/primitives/alert': STAGE_3,
  '/blocks/primitives/avatar': STAGE_3,
  '/blocks/primitives/badge': STAGE_3,
  '/blocks/primitives/breadcrumb': STAGE_3,
  '/blocks/primitives/button': STAGE_3,
  '/blocks/primitives/button-group': STAGE_3,
  '/blocks/primitives/card': STAGE_3,
  '/blocks/primitives/checkbox': STAGE_3,
  '/blocks/primitives/collapsible': STAGE_3,
  '/blocks/primitives/combobox': STAGE_3,
  '/blocks/primitives/confirm-dialog': STAGE_3,
  '/blocks/primitives/dialog': STAGE_3,
  '/blocks/primitives/drawer': STAGE_3,
  '/blocks/primitives/form-field': STAGE_3,
  '/blocks/primitives/input': STAGE_3,
  '/blocks/primitives/journey-timeline': STAGE_3,
  '/blocks/primitives/kbd': STAGE_3,
  '/blocks/primitives/menu': STAGE_3,
  '/blocks/primitives/pagination': STAGE_3,
  '/blocks/primitives/popover': STAGE_3,
  '/blocks/primitives/progress': STAGE_3,
  '/blocks/primitives/radio-group': STAGE_3,
  '/blocks/primitives/scroller': STAGE_3,
  '/blocks/primitives/segment-group': STAGE_3,
  '/blocks/primitives/select': STAGE_3,
  '/blocks/primitives/separator': STAGE_3,
  '/blocks/primitives/sidebar': STAGE_3,
  '/blocks/primitives/skeleton': STAGE_3,
  '/blocks/primitives/slider': STAGE_3,
  '/blocks/primitives/spinner': STAGE_3,
  '/blocks/primitives/split-pane': STAGE_3,
  '/blocks/primitives/stepper': STAGE_3,
  '/blocks/primitives/tab': STAGE_3,
  '/blocks/primitives/textarea': STAGE_3,
  '/blocks/primitives/toggle': STAGE_3,
  '/blocks/primitives/toolbar': STAGE_3,
  '/blocks/primitives/tooltip': STAGE_3,
  '/docs/components/code-panel': STAGE_3,
  '/docs/components/note-list': STAGE_3,
  '/docs/components/playground-configurator': STAGE_3,
  '/docs/components/types-reference': STAGE_3,
  '/table/table': STAGE_3
};

/**
 * The size of PENDING_STAGE3 on the day it was introduced. The stale checks
 * force entries out as pages get fixed, but nothing stops a NEW violating page
 * being added to the map instead of being wired — which is exactly how an
 * exception list rots into a blanket exemption. So the list may shrink freely
 * and may never exceed the number it started at.
 */
const PENDING_AT_INTRODUCTION = 93;

/**
 * Route dirs that have a generated `api.ts` but no `+page.svelte`, each with
 * the reason. Their types are documented on a family page instead.
 *
 * Not a silent `continue`: registry-lint's header records what a bare skip
 * costs — `NoteList` shipped exported, catalogued, with a generated `api.ts`
 * in a route directory and no page, for a whole release, past a green lint.
 * Same contract as everything else here, both stale directions are errors.
 *
 * Caveat this script does NOT check, and should not be read as checking: that
 * the family page named below actually documents these types. Its own
 * `<TypesReference>` is fed from its own `componentData.types`, so the nine
 * Guide surfaces' types are not covered by it today. Verifying that claim needs
 * the family page to aggregate the sibling `api.ts` types, which is a content
 * decision, not a lint rule.
 */
const NO_PAGE: Record<string, string> = {
  '/blocks/components/guide-article':
    'guide surface — page-less, family page /blocks/components/guide',
  '/blocks/components/guide-beacon':
    'guide surface — page-less, family page /blocks/components/guide',
  '/blocks/components/guide-hint':
    'guide surface — page-less, family page /blocks/components/guide',
  '/blocks/components/guide-marker':
    'guide surface — page-less, family page /blocks/components/guide',
  '/blocks/components/guide-mention':
    'guide surface — page-less, family page /blocks/components/guide',
  '/blocks/components/guide-panel':
    'guide surface — page-less, family page /blocks/components/guide',
  '/blocks/components/guide-provider':
    'guide surface — page-less, family page /blocks/components/guide',
  '/blocks/components/guide-ref': 'guide surface — page-less, family page /blocks/components/guide'
};

/**
 * Sanity floors. A regex or a glob that stops matching would otherwise report
 * "everything consistent" over an empty set, which is the one failure mode a
 * comparison gate cannot afford — and this gate reads generated output, so a
 * missing `docs:gen:all` looks exactly like a clean tree. Measured 2026-08-04:
 * 108 api dirs, 100 of them with a page, 661 documentable types.
 */
const MIN_API_DIRS = 90;
const MIN_PAGES_WITH_API = 85;
const MIN_DOCUMENTABLE_TYPES = 500;

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  gray: '\x1b[90m'
};

type Finding = { where: string; detail: string };
const errors: Finding[] = [];

// ── Source blanking ──────────────────────────────────────────────────────────

/**
 * Collapse the parts of a Svelte file that only *quote* markup. Lifted from
 * sections-lint, for the same reason: `code={`<ApiReference … />`}` is prose,
 * and the docs pages for ApiReference and TypesReference are full of it.
 */
function blankQuotedMarkup(src: string): string {
  return src
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, (m) => ' '.repeat(m.length))
    .replace(/\bcode=\{?"(?:[^"\\]|\\[\s\S])*"\}?/g, (m) => ' '.repeat(m.length))
    .replace(/\bcode=\{?'(?:[^'\\]|\\[\s\S])*'\}?/g, (m) => ' '.repeat(m.length))
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead: string) => lead + ' '.repeat(m.length - lead.length));
}

/**
 * Collapse demo stages — a rendered `<TypesReference>` inside a `<CodeExample>`
 * or a `<PlaygroundConfigurator>` is the subject of the page, not its Types
 * section. Both live cases are on the TypesReference docs page: two demos in
 * its `Docs.svelte` (one of them a `types={[]}` empty state) and one inside the
 * playground of `+page.svelte`. Counting any of them would report that page as
 * documenting its own types, which it does not.
 *
 * Self-closing first — `<CodeExample … />` has no closing tag, so the paired
 * pattern would otherwise run from it to the next `</CodeExample>` anywhere in
 * the file (sections-lint measured that hole at 93 sections on 80 pages).
 */
function blankDemoStages(src: string): string {
  const selfClosing = /<(?:CodeExample|PlaygroundConfigurator)\b(?:[^<>]|\{[^{}]*\})*?\/>/g;
  return src
    .replace(selfClosing, (m) => ' '.repeat(m.length))
    .replace(/<PlaygroundConfigurator\b[\s\S]*?<\/PlaygroundConfigurator>/g, (m) =>
      ' '.repeat(m.length)
    )
    .replace(/<CodeExample\b[\s\S]*?<\/CodeExample>/g, (m) => ' '.repeat(m.length));
}

/**
 * The page's markup with every sibling docs component substituted in at its
 * call site. A page is typically `+page.svelte` plus a `Docs.svelte`, and while
 * every page today puts its API and Types sections in the route file, nothing
 * enforces that — reading only `+page.svelte` would report a page that moved
 * them as unwired. Same substitution sections-lint does, minus the ordering it
 * needs the call site for.
 */
function splice(dir: string, pageSrc: string): string {
  let markup = blankQuotedMarkup(pageSrc);
  for (const sibling of readdirSync(dir)) {
    if (!sibling.endsWith('.svelte') || sibling === '+page.svelte') continue;
    const local = markup.match(
      new RegExp(`import\\s+(\\w+)\\s+from\\s+['"]\\./${sibling.replace('.', '\\.')}['"]`)
    )?.[1];
    if (!local) continue;
    const call = new RegExp(`<${local}\\b[^>]*/>`);
    if (!call.test(markup)) continue;
    markup = markup.replace(call, blankQuotedMarkup(readFileSync(join(dir, sibling), 'utf8')));
  }
  return markup;
}

// ── Tags and attributes ──────────────────────────────────────────────────────

/**
 * Every local name a `@urbicon-ui/docs` export is used under on this page.
 *
 * Read from the import rather than guessed from the tag name, the lesson
 * sections-lint records: it matched aliases by shape ("ends in Section") and
 * therefore missed `SectionComponent`, silently skipping the very page that
 * documents it. The ApiReference page is the same case here — it imports
 * `ApiReference as ApiReferenceComponent`, so a tag-name guess would report it
 * as having no API table at all.
 */
function localNames(src: string, exported: string): Set<string> {
  const names = new Set<string>([exported]);
  for (const imp of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@urbicon-ui\/docs['"]/g)) {
    for (const spec of imp[1].split(',')) {
      const alias = spec.trim().match(new RegExp(`^${exported}\\s+as\\s+([A-Za-z_$][\\w$]*)$`));
      if (alias) names.add(alias[1]);
    }
  }
  return names;
}

/**
 * The opening tags of `names`, as the text between `<` and the matching `>`.
 *
 * Scanned rather than regexed to the first `>`: an attribute expression may
 * contain one (`{a > b}`, a generic), and stopping there would cut the tag in
 * half and lose every attribute after it. Depth is tracked over `{}` only —
 * quoted markup is already blanked by the time this runs.
 */
function openingTags(src: string, names: Iterable<string>): string[] {
  const tags: string[] = [];
  for (const name of names) {
    const start = new RegExp(`<${name}\\b`, 'g');
    for (const m of src.matchAll(start)) {
      const from = (m.index ?? 0) + m[0].length;
      let depth = 0;
      for (let i = from; i < src.length; i++) {
        const ch = src[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        else if (ch === '>' && depth === 0) {
          tags.push(src.slice(from, i));
          break;
        }
      }
    }
  }
  return tags;
}

/** The expression a tag passes as `types=`, or `null` when it passes none. */
function typesExpression(tag: string): string | null {
  const at = tag.search(/\btypes\s*=/);
  if (at === -1) return null;
  const eq = tag.indexOf('=', at);
  let i = eq + 1;
  while (i < tag.length && /\s/.test(tag[i])) i++;
  if (tag[i] !== '{') return tag.slice(i); // `types="…"` — never live, reported as such
  const close = closingIndex(tag, i, '{', '}');
  return tag.slice(i + 1, close);
}

// ── Liveness ─────────────────────────────────────────────────────────────────

/**
 * The local names bound to a generator-produced `componentData` on this page —
 * `componentData` from `./api`, plus every alias of it from a sibling's
 * (`import { componentData as panelData } from '../guide-panel/api'`, which the
 * Guide family page does nine times).
 */
function generatedDataNames(src: string): Set<string> {
  const names = new Set<string>();
  for (const imp of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    if (!/(^|\/)api$/.test(imp[2])) continue;
    for (const spec of imp[1].split(',')) {
      const t = spec.trim();
      const alias = t.match(/^componentData\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (alias) names.add(alias[1]);
      else if (t === 'componentData') names.add('componentData');
    }
  }
  return names;
}

type Liveness = 'live' | 'dead' | 'unresolved';

/**
 * Whether a `types=` expression is actually fed from generated component data.
 *
 * `live` — it names a generated `componentData` (`componentData?.types ?? []`),
 * or one local const that does (`typesForTypesReference`, which six pages use).
 * `dead` — it resolves to something the generator never produced: `[]`,
 * `undefined`, a hand-written array. Formally an attribute, functionally
 * nothing; `knownTypeNames` stays empty and every type name stays dead text.
 * `unresolved` — a bare identifier with no declaration this script can find.
 * Reported rather than assumed good: a guard that silently accepts what it
 * cannot read is the shape this whole rule exists to stop.
 */
function resolveTypesExpression(expr: string, src: string, generated: Set<string>): Liveness {
  const mentionsGenerated = (text: string): boolean =>
    [...generated].some((n) => new RegExp(`\\b${n}\\b`).test(text));

  if (mentionsGenerated(expr)) return 'live';

  const identifiers = [...expr.matchAll(/[A-Za-z_$][\w$]*/g)]
    .map((m) => m[0])
    .filter((id) => !['undefined', 'null', 'as', 'const', 'satisfies'].includes(id));
  if (identifiers.length === 0) return 'dead'; // `{[]}`, `{''}` — nothing to resolve

  let sawDeclaration = false;
  for (const id of identifiers) {
    // `\s*` on BOTH sides of the optional type annotation. Without the second
    // one this matched nothing for the six pages that write
    //   const typesForTypesReference =
    //     (componentData as …).types ?? [];
    // (Prettier breaks after `=` at width 100), so the only shape in the app
    // that needs resolving at all came back `unresolved` and the six pages
    // already wired were reported as unwired. Caught by the first real run.
    const decl = src.match(
      new RegExp(`\\b(?:const|let|var)\\s+${id}\\b\\s*(?::[\\s\\S]*?)?\\s*=([\\s\\S]*?);`)
    );
    if (!decl) continue;
    sawDeclaration = true;
    if (mentionsGenerated(decl[1])) return 'live';
  }
  return sawDeclaration ? 'dead' : 'unresolved';
}

// ── The generated data ───────────────────────────────────────────────────────

interface TypeEntry {
  name: string;
  exported?: boolean;
  owner?: string;
}

/** Route dirs holding a generated `api.ts`. */
function collectApiDirs(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) collectApiDirs(p, out);
    else if (entry === 'api.ts') out.push(dir);
  }
}

const apiDirs: string[] = [];
collectApiDirs(ROUTES, apiDirs);

const route = (dir: string): string => dir.slice(ROUTES.length) || '/';

let documentableTotal = 0;
let pagesWithApi = 0;
let checked = 0;
const pendingSeen = new Set<string>();
const noPageSeen = new Set<string>();
const conformant: string[] = [];

for (const dir of apiDirs) {
  const r = route(dir);

  // Imported, not regexed. A generated `api.ts` is a self-contained module (no
  // imports at all — verified across all 108), so the real object is available
  // and the stage-3 filter can be applied verbatim instead of approximated. If
  // the generator ever gives it a dependency this throws, which is the correct
  // outcome: the parser would be reading something it no longer understands.
  let componentData: { name: string; types?: TypeEntry[] };
  try {
    componentData = (await import(join(dir, 'api.ts'))).componentData;
  } catch (e) {
    errors.push({
      where: `src/routes${r}/api.ts`,
      detail: `cannot be imported (${(e as Error).message}) — run \`bun run docs:gen:all\`, or teach this script how to read it.`
    });
    continue;
  }

  // The filter the pages themselves apply (#114 stage 3).
  const documentable = (componentData.types ?? []).filter(
    (t) => t.exported && (!t.owner || t.owner === componentData.name)
  );
  documentableTotal += documentable.length;

  const pageFile = join(dir, '+page.svelte');
  if (!existsSync(pageFile)) {
    if (documentable.length === 0) continue;
    if (r in NO_PAGE) {
      noPageSeen.add(r);
      continue;
    }
    errors.push({
      where: `src/routes${r}/api.ts`,
      detail:
        `carries ${documentable.length} documentable type(s) but the directory has no ` +
        `\`+page.svelte\`, so they are documented nowhere. Write the page, or add ${r} to ` +
        `NO_PAGE in this script naming the family page that covers it.`
    });
    continue;
  }
  pagesWithApi++;

  const src = readFileSync(pageFile, 'utf8');
  const markup = blankDemoStages(splice(dir, src));
  const generated = generatedDataNames(markup);

  const apiTags = openingTags(markup, localNames(markup, 'ApiReference'));
  const typesTags = openingTags(markup, localNames(markup, 'TypesReference'));

  // A page may render several `<ApiReference>` — the Guide family page renders
  // six, one per surface, and the demo instances a docs page renders are
  // already blanked above. So the question is whether ANY of them is wired, not
  // whether all are: a family page's per-surface tables legitimately share the
  // one Types section below them.
  let apiLive = false;
  for (const tag of apiTags) {
    const expr = typesExpression(tag);
    if (expr === null) continue;
    const liveness = resolveTypesExpression(expr, markup, generated);
    if (liveness === 'live') apiLive = true;
    else if (!(r in PENDING_STAGE3)) {
      errors.push({
        where: `src/routes${r}/+page.svelte`,
        detail: `<ApiReference types={${expr.trim()}}> is ${
          liveness === 'dead'
            ? 'not fed from the generated component data, so `knownTypeNames` stays empty and ' +
              'every type name in the Type column renders as dead text — the attribute is ' +
              'there and buys nothing'
            : 'an expression this script cannot resolve to a declaration; it may be dead. ' +
              'Feed it `componentData.types` directly, or teach `resolveTypesExpression` this shape'
        }.`
      });
    }
  }

  let typesLive = false;
  for (const tag of typesTags) {
    const expr = typesExpression(tag);
    if (expr === null) continue;
    if (resolveTypesExpression(expr, markup, generated) === 'live') typesLive = true;
  }

  if (r in PENDING_STAGE3) {
    pendingSeen.add(r);
    if (typesLive && apiLive) {
      errors.push({
        where: 'PENDING_STAGE3',
        detail: `${r} is wired now — remove the entry, the exception buys nothing.`
      });
    }
    continue;
  }

  checked++;

  if (documentable.length === 0) {
    // No live case today (all 108 carry at least one), so this is unreachable
    // rather than dead — kept because "nothing to document" is a legitimate
    // future state and silently skipping it is what the rest of this file argues
    // against.
    conformant.push(r);
    continue;
  }

  if (!typesLive) {
    errors.push({
      where: `src/routes${r}/+page.svelte`,
      detail: apiLive
        ? `passes \`types=\` to <ApiReference> but renders no <TypesReference> fed from ` +
          `\`componentData.types\` — so it emits \`#type-<Name>\` links whose target section ` +
          `does not exist. \`revealTableRow\` falls back to \`fallbackSectionId: 'types'\`, which ` +
          `resolves to nothing, and the click does nothing at all. Add the Types section.`
        : `has ${documentable.length} documentable type(s) and renders no <TypesReference> — ` +
          `they are documented nowhere. Add \`<TypesReference types={componentData?.types ?? []} />\` ` +
          `(inside a \`<Section id="types" title="Types">\` if the page lists one in its nav).`
    });
  }

  if (!apiLive) {
    errors.push({
      where: `src/routes${r}/+page.svelte`,
      detail:
        `<ApiReference> is not passed \`types=\`, so \`knownTypeNames\` is empty and ` +
        `\`tokenizeTypeExpression\` returns every Type-column cell as one unlinked segment — ` +
        `${documentable.length} documented type(s) that the table names and no reader can reach. ` +
        `Pass \`types={componentData?.types ?? []}\`.`
    });
  }

  if (typesLive && apiLive) conformant.push(r);
}

// ── Stale exceptions ─────────────────────────────────────────────────────────
for (const [r, why] of Object.entries(PENDING_STAGE3)) {
  if (!pendingSeen.has(r)) {
    errors.push({
      where: 'PENDING_STAGE3',
      detail: `stale entry '${r}' (${why}) — no such page has a generated api.ts any more, remove it.`
    });
  }
}
for (const [r, why] of Object.entries(NO_PAGE)) {
  if (!noPageSeen.has(r)) {
    errors.push({
      where: 'NO_PAGE',
      detail:
        `stale entry '${r}' (${why}) — it has a page now, or no documentable types, or no ` +
        `api.ts at all. Remove it.`
    });
  }
}
if (Object.keys(PENDING_STAGE3).length > PENDING_AT_INTRODUCTION) {
  errors.push({
    where: 'PENDING_STAGE3',
    detail:
      `${Object.keys(PENDING_STAGE3).length} entries, up from ${PENDING_AT_INTRODUCTION} at ` +
      `introduction — this list may only shrink. A new page is wired, not exempted.`
  });
}

// ── Sanity floors ────────────────────────────────────────────────────────────
if (
  apiDirs.length < MIN_API_DIRS ||
  pagesWithApi < MIN_PAGES_WITH_API ||
  documentableTotal < MIN_DOCUMENTABLE_TYPES
) {
  console.error(
    `${c.red}✖ typesref-lint read ${apiDirs.length} api dirs / ${pagesWithApi} pages with one / ` +
      `${documentableTotal} documentable types (floors: ${MIN_API_DIRS}/${MIN_PAGES_WITH_API}/` +
      `${MIN_DOCUMENTABLE_TYPES}) — route drift, or the generated api.ts are missing their ` +
      `\`exported\`/\`owner\` fields. Run \`bun run docs:gen:all\`; the guard would run blind.${c.reset}`
  );
  process.exit(1);
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log(
  `\n${c.bold}typesref-lint${c.reset} ${c.gray}· ${apiDirs.length} api.ts (${pagesWithApi} with a ` +
    `page), ${documentableTotal} documentable types, ${checked} pages checked, ` +
    `${Object.keys(PENDING_STAGE3).length} pending stage 3${c.reset}\n`
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
  `${c.green}✓ every page with documentable types renders a <TypesReference> and passes ` +
    `\`types=\` to its <ApiReference>, both fed from the generated component data ` +
    `(${conformant.length} pages wired, ${Object.keys(PENDING_STAGE3).length} pending stage 3, ` +
    `${Object.keys(NO_PAGE).length} page-less by decision).${c.reset}\n`
);
