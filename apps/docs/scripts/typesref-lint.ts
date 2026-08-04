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
 * `types={undefined}`, a hand-written demo array, `componentData?.props ?? []`
 * (right object, wrong field — the line beside it reads `props={…props}`) or
 * `componentData.types.slice(0, 0)` all put a `types=` on the tag while feeding
 * the component nothing useful — the same shape as the namespace import that
 * used to walk through blocks' imports-lint. So the attribute is not counted, it
 * is *resolved* against a canonical shape, and the generated module it reads is
 * remembered so the page's two halves can be required to agree. Anything
 * unrecognised is reported rather than assumed good — see `resolveTypesSource`.
 *
 * ── What this deliberately does NOT check ──────────────────────────────────
 *   - Reachability. A `<TypesReference>` inside `{#if false}` counts as
 *     rendered. Any conditional is an equal bypass, and deciding which branch
 *     runs is beyond a text lint; the honest statement is that this checks
 *     presence and wiring, not control flow.
 *   - Svelte's shorthand. `<TypesReference {types} />` reads as "no `types=`"
 *     and is reported as unwired. That is a false positive, but a loud one in
 *     the safe direction, and no page in the corpus writes it — the canonical
 *     form the error asks for is spelled out. Teach `typesExpression` the
 *     shorthand if a page ever wants it, rather than working around the error.
 *   - What ends up in the table. All 11 wired pages pass `componentData.types`
 *     UNFILTERED, and neither component filters internally, so the stage-3
 *     filter above decides only WHETHER a page needs a Types section, never
 *     what is in it. That direction is safe (the rule can only be too lax about
 *     content, never too strict), but it is why the `NO_PAGE` gap below is real:
 *     see #141.
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
 * The pre-existing backlog: the 93 pages that were unwired on 2026-08-04, when
 * this rule was written. Gating on the rule alone would have meant a red CI with
 * no fix in the same change, so the backlog is enumerated instead of counted.
 *
 * ── Why a frozen ROSTER and not a shrinking list ───────────────────────────
 * The first version of this was a `Record<route, reason>` that stage 3 would
 * empty, guarded by "the list may never exceed the 93 it started at". That
 * guard was a **fixed ceiling, not a ratchet**, and stage 3 is precisely the
 * sweep that frees slots under it: wire one page, delete its entry, and there
 * is now room for a different page to be broken and exempted with the count
 * unchanged. Measured 2026-08-04 on the first version: wiring `kbd` and
 * deleting its entry (92, green), then UN-wiring `toast` and adding it as a new
 * entry (93 again) — **green, no message**, a working page silently regressed.
 *
 * So the keys are frozen instead. Every route below is permanent for the life
 * of the map and its VALUE moves `PENDING` → `WIRED`; nothing is ever deleted
 * and nothing is ever added. A page that breaks after today is simply not in
 * the roster, so it is checked like any other page, and it cannot be added to
 * the roster because `ROSTER_SIZE` is checked for equality, not for a ceiling.
 *
 * The `WIRED` entries are not bookkeeping — they are regression guards for
 * exactly the pages the sweep has touched: flipping one back to broken is an
 * error naming the regression. Stage 3 deletes the whole map once every entry
 * is `WIRED`, which is also when `ROSTER_SIZE` and this comment go.
 *
 * The reason is the same sentence on every entry on purpose. This is one
 * decision enumerated 93 times, not 93 decisions — enumerating it is what makes
 * the sweep auditable, because a page the sweep misses keeps its `PENDING` and
 * the roster is checked.
 */
const PENDING = 'unwired on 2026-08-04 — #114 stage 3 wires the page and flips this to WIRED';
const WIRED = 'wired since 2026-08-04 — kept as a regression guard until the roster is deleted';

const STAGE_3_ROSTER: Record<string, typeof PENDING | typeof WIRED> = {
  '/auth/components/account-settings': WIRED,
  '/auth/components/forgot-password-page': WIRED,
  '/auth/components/invitation-manager': WIRED,
  '/auth/components/login-page': WIRED,
  '/auth/components/notification-badge': WIRED,
  '/auth/components/notification-center': WIRED,
  '/auth/components/notification-listener': WIRED,
  '/auth/components/passkey-manager': WIRED,
  '/auth/components/push-permission-prompt': WIRED,
  '/auth/components/register-page': WIRED,
  '/auth/components/reset-password-page': WIRED,
  '/auth/components/session-manager': WIRED,
  '/auth/components/two-factor-manager': WIRED,
  '/auth/components/verify-email-page': WIRED,
  '/blocks/components/a2-ui-view': WIRED,
  '/blocks/components/area-chart': WIRED,
  '/blocks/components/avatar-group': WIRED,
  '/blocks/components/bar-chart': WIRED,
  '/blocks/components/calendar': WIRED,
  '/blocks/components/chart-frame': WIRED,
  '/blocks/components/chat': WIRED,
  '/blocks/components/chat-message': WIRED,
  '/blocks/components/chat-message-list': WIRED,
  '/blocks/components/citation-chip': WIRED,
  '/blocks/components/code-block': WIRED,
  '/blocks/components/command-palette': WIRED,
  '/blocks/components/composition-bar': WIRED,
  '/blocks/components/copy-button': WIRED,
  '/blocks/components/currency-input': WIRED,
  '/blocks/components/date-picker': WIRED,
  '/blocks/components/date-range-picker': WIRED,
  '/blocks/components/donut-chart': WIRED,
  '/blocks/components/empty-state': WIRED,
  '/blocks/components/file-upload': WIRED,
  '/blocks/components/guide': WIRED,
  '/blocks/components/line-chart': WIRED,
  '/blocks/components/locale-switcher': WIRED,
  '/blocks/components/number-input': WIRED,
  '/blocks/components/pin-input': WIRED,
  '/blocks/components/planner': WIRED,
  '/blocks/components/prompt-input': WIRED,
  '/blocks/components/qr-code': WIRED,
  '/blocks/components/reasoning-disclosure': WIRED,
  '/blocks/components/sankey': WIRED,
  '/blocks/components/sidebar-layout': WIRED,
  '/blocks/components/sparkline': WIRED,
  '/blocks/components/theme-switcher': WIRED,
  '/blocks/components/streaming-markdown': WIRED,
  '/blocks/components/time-input': WIRED,
  '/blocks/components/tool-call-card': WIRED,
  '/blocks/primitives/accordion': WIRED,
  '/blocks/primitives/alert': WIRED,
  '/blocks/primitives/avatar': WIRED,
  '/blocks/primitives/badge': WIRED,
  '/blocks/primitives/breadcrumb': WIRED,
  '/blocks/primitives/button': WIRED,
  '/blocks/primitives/button-group': WIRED,
  '/blocks/primitives/card': WIRED,
  '/blocks/primitives/checkbox': WIRED,
  '/blocks/primitives/collapsible': WIRED,
  '/blocks/primitives/combobox': WIRED,
  '/blocks/primitives/confirm-dialog': WIRED,
  '/blocks/primitives/dialog': WIRED,
  '/blocks/primitives/drawer': WIRED,
  '/blocks/primitives/form-field': WIRED,
  '/blocks/primitives/input': WIRED,
  '/blocks/primitives/journey-timeline': WIRED,
  '/blocks/primitives/kbd': WIRED,
  '/blocks/primitives/menu': WIRED,
  '/blocks/primitives/pagination': WIRED,
  '/blocks/primitives/popover': WIRED,
  '/blocks/primitives/progress': WIRED,
  '/blocks/primitives/radio-group': WIRED,
  '/blocks/primitives/scroller': WIRED,
  '/blocks/primitives/segment-group': WIRED,
  '/blocks/primitives/select': WIRED,
  '/blocks/primitives/separator': WIRED,
  '/blocks/primitives/sidebar': WIRED,
  '/blocks/primitives/skeleton': WIRED,
  '/blocks/primitives/slider': WIRED,
  '/blocks/primitives/spinner': WIRED,
  '/blocks/primitives/split-pane': WIRED,
  '/blocks/primitives/stepper': WIRED,
  '/blocks/primitives/tab': WIRED,
  '/blocks/primitives/textarea': WIRED,
  '/blocks/primitives/toggle': WIRED,
  '/blocks/primitives/toolbar': WIRED,
  '/blocks/primitives/tooltip': WIRED,
  '/docs/components/code-panel': WIRED,
  '/docs/components/note-list': WIRED,
  '/docs/components/playground-configurator': WIRED,
  '/docs/components/types-reference': WIRED,
  '/table/table': WIRED
};

/**
 * The number of routes in STAGE_3_ROSTER, frozen on the day it was introduced
 * and checked for EQUALITY. Entries are never added or removed; only their
 * value moves PENDING → WIRED. See the roster's own comment for why a ceiling
 * was not enough.
 */
const ROSTER_SIZE = 93;

/**
 * Route dirs that have a generated `api.ts` but no `+page.svelte`, each with
 * the reason their types are not on a page.
 *
 * Not a silent `continue`: registry-lint's header records what a bare skip
 * costs — `NoteList` shipped exported, catalogued, with a generated `api.ts`
 * in a route directory and no page, for a whole release, past a green lint.
 * Same contract as everything else here, both stale directions are errors.
 *
 * ── The reason says "nowhere", not "on the family page" ────────────────────
 * These eight are `PAGELESS` in registry-lint as "documented as a family on
 * /blocks/components/guide", and for PROPS that is true — the family page
 * imports each sibling's `componentData` and renders a per-surface
 * `<ApiReference>`. For TYPES it is false, and the filter at the top of this
 * file is what makes it false: `guide/api.ts` does carry `GuidePanelProps` and
 * friends, but with `owner` naming the surface, so `t.owner === 'Guide'` drops
 * them. Measured 2026-08-04: 39 types on the family page, 14 survive, not one
 * of them a surface type — 8 `Guide*Props` + 7 `Guide*Variants` = 15 names on
 * no page at all.
 *
 * An exception with a false reason is still false with a footnote, so the
 * reason below names the gap and points at #141 rather than repeating a claim
 * this script cannot make. It deliberately does NOT verify where these types
 * are documented — closing the gap means aggregating sibling types into the
 * family page (or changing what `owner` means), which is a content decision.
 *
 * Kept separate from registry-lint's `PAGELESS` rather than imported: that map
 * is keyed by component NAME and answers a different question (is there a page
 * at all), and after the correction above the two no longer say the same thing.
 * `registry-lint` also runs its whole lint on import, so there is nothing to
 * import from it without splitting the map into a shared module first. Both
 * lists are stale-checked, so a ninth surface turns both red rather than one.
 */
const NO_PAGE: Record<string, string> = {
  '/blocks/components/guide-article': 'guide surface — its types land on no page, see #141',
  '/blocks/components/guide-beacon': 'guide surface — its types land on no page, see #141',
  '/blocks/components/guide-hint': 'guide surface — its types land on no page, see #141',
  '/blocks/components/guide-marker': 'guide surface — its types land on no page, see #141',
  '/blocks/components/guide-mention': 'guide surface — its types land on no page, see #141',
  '/blocks/components/guide-panel': 'guide surface — its types land on no page, see #141',
  '/blocks/components/guide-provider': 'guide surface — its types land on no page, see #141',
  '/blocks/components/guide-ref': 'guide surface — its types land on no page, see #141'
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
 * The local names bound to a generator-produced `componentData` on this page,
 * and which of them come from the page's OWN `./api`.
 *
 * The distinction is the whole point. "Generated" used to mean "the specifier
 * ends in `api`", which is a path ending, not a provenance — so a page could
 * document a NEIGHBOUR's types on both halves and satisfy the same-source rule
 * while its own types landed nowhere. Measured 2026-08-04: pointing the toast
 * page's import at `'../tooltip/api'` left the run green with Tooltip's types
 * documented under Toast's heading and Toast's own nine documented nowhere. A
 * wrong neighbour path is the same class of slip as `.props` for `.types`, and
 * stage 3 wires 89 pages by hand — this is exactly when it happens.
 *
 * `own` is therefore what a page may document, and `all` exists only so a
 * foreign binding can be RECOGNISED and named in the error rather than falling
 * through as an unresolvable expression.
 *
 * Corpus, measured 2026-08-04: 178 imports from `'./api'` and 9 from
 * `'../<guide-surface>/api'` — the latter only on the Guide family page (8 in
 * `+page.svelte`, 1 in its `Playground.svelte`), and used for `props=`, never
 * for `types=`. All 11 wired pages use `'./api'` for both halves, so requiring
 * it costs nothing today.
 */
interface GeneratedBindings {
  /** local name → import specifier, for every `componentData` binding. */
  readonly all: Map<string, string>;
  /** the subset bound from this route's own `./api`. */
  readonly own: Set<string>;
}

function generatedDataNames(src: string): GeneratedBindings {
  const all = new Map<string, string>();
  const own = new Set<string>();
  for (const imp of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const specifier = imp[2];
    if (!/(^|\/)api$/.test(specifier)) continue;
    for (const spec of imp[1].split(',')) {
      const t = spec.trim();
      const alias = t.match(/^componentData\s+as\s+([A-Za-z_$][\w$]*)$/);
      const local = alias ? alias[1] : t === 'componentData' ? 'componentData' : null;
      if (local === null) continue;
      all.set(local, specifier);
      if (specifier === './api') own.add(local);
    }
  }
  return { all, own };
}

/**
 * What a `types=` expression reads.
 *
 * `module` is the generated binding it reads `.types` off — `componentData`, or
 * a sibling alias like `panelData`. Carrying the NAME rather than a boolean is
 * what lets the two halves of a page be compared against each other; see the
 * `sameSource` check at the call site.
 */
type TypesSource =
  | { kind: 'live'; module: string }
  | { kind: 'dead'; why: string }
  | { kind: 'unresolved' };

/**
 * Blank out `as <Type>` casts, length-preserving, so the expression underneath
 * can be matched structurally. The one live shape is
 *   `(componentData as ComponentAPIInfo & { types?: unknown[] }).types ?? []`
 * on the six `docs/components/*` pages — the cast body carries `{`, `}` and `[`
 * `]`, so it is skipped to the bracket that closes the cast's own group.
 */
function blankCasts(expr: string): string {
  let out = expr;
  for (;;) {
    const at = out.search(/\bas\b/);
    if (at === -1) return out;
    let depth = 0;
    let end = out.length;
    for (let i = at; i < out.length; i++) {
      const ch = out[i];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') {
        if (depth === 0) {
          end = i;
          break;
        }
        depth--;
      }
    }
    out = out.slice(0, at) + ' '.repeat(end - at) + out.slice(end);
  }
}

/**
 * The canonical way to hand a component the generated types. Anything else is
 * refused rather than pattern-matched loosely — see `resolveTypesSource`.
 */
const CANONICAL_TYPES_EXPR =
  /^([A-Za-z_$][\w$]*)\s*\??\.\s*types\s*(?:(?:\?\?|\|\|)\s*\[\s*\]\s*)?$/;

/**
 * What a `types=` expression actually feeds the component.
 *
 * The first version of this asked only "does the expression MENTION a generated
 * binding", which is blind to the value and let three real shapes through green
 * (all measured 2026-08-04 on the wired `toast` page):
 *
 *   - `types={componentData?.props ?? []}` — right object, wrong field. The
 *     line beside it reads `props={componentData?.props ?? []}`, so a
 *     copy-paste slip is the single most likely way to get this wiring wrong,
 *     and it produces EXACTLY the defect this lint exists to catch:
 *     `knownTypeNames` fills with prop names, ApiReference emits
 *     `#type-<propName>`, and `revealTableRow` finds nothing.
 *   - `types={componentData.types.slice(0, 0)}` — right field, emptied.
 *   - `types={demo.typesForTypesReference}` — a property access that merely
 *     contains a generated-looking identifier.
 *
 * So the expression is now matched against `CANONICAL_TYPES_EXPR` — `X.types`,
 * `X?.types`, optionally `?? []` / `|| []` — after casts and parentheses are
 * removed, and `X` must be a generated binding. A bare identifier is resolved
 * one hop through its `const` declaration and the same test is applied to the
 * initializer. Everything else is `dead` or `unresolved` and reported: refusing
 * an unrecognised shape is the point, because the set of ways to write "nothing
 * useful" is open-ended while the set of correct ways is two lines long.
 */
function resolveTypesSource(
  expr: string,
  src: string,
  generated: ReadonlyMap<string, string>
): TypesSource {
  const normalize = (text: string): string =>
    blankCasts(text).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();

  const direct = normalize(expr).match(CANONICAL_TYPES_EXPR);
  if (direct) {
    if (generated.has(direct[1])) return { kind: 'live', module: direct[1] };
    return {
      kind: 'dead',
      why: `\`${direct[1]}\` is not a \`componentData\` imported from an \`api\` module`
    };
  }

  // A bare identifier — resolve one hop and test the initializer the same way.
  const bare = normalize(expr).match(/^([A-Za-z_$][\w$]*)$/);
  if (bare) {
    // `\s*` on BOTH sides of the optional type annotation. Without the second
    // one this matched nothing for the six pages that write
    //   const typesForTypesReference =
    //     (componentData as …).types ?? [];
    // (Prettier breaks after `=` at width 100), so the only shape in the app
    // that needs resolving at all came back `unresolved` and the six pages
    // already wired were reported as unwired. Caught by the first real run.
    const decl = src.match(
      new RegExp(`\\b(?:const|let|var)\\s+${bare[1]}\\b\\s*(?::[\\s\\S]*?)?\\s*=([\\s\\S]*?);`)
    );
    if (!decl) return { kind: 'unresolved' };
    const hop = normalize(decl[1]).match(CANONICAL_TYPES_EXPR);
    if (hop && generated.has(hop[1])) return { kind: 'live', module: hop[1] };
    return {
      kind: 'dead',
      why: `\`${bare[1]}\` resolves to \`${normalize(decl[1])}\`, which does not read \`.types\` off a generated \`componentData\``
    };
  }

  return {
    kind: 'dead',
    why: 'not of the form `componentData.types` / `componentData?.types ?? []`'
  };
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
const rosterSeen = new Set<string>();
const noPageSeen = new Set<string>();
const conformant: string[] = [];

for (const dir of apiDirs) {
  const r = route(dir);

  // Imported, not regexed, so the stage-3 filter runs against the real object
  // instead of an approximation of it. The premise is that a generated `api.ts`
  // is self-contained — measured 2026-08-04: zero `import` statements across all
  // 108 — and it is a premise, not something enforced here. An earlier version
  // of this comment claimed a new dependency would throw; it does not. Measured:
  // prepending `import { existsSync } from 'node:fs'` to one api.ts left the run
  // green, because only an UNRESOLVABLE specifier throws. Note also that
  // `await import()` executes module code, which is safe only because this file
  // is generated by docs-gen from the repo's own sources.
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
  // Bindings come from `+page.svelte` ALONE, never from the spliced markup, and
  // that is load-bearing: splicing concatenates files, which merges import
  // scopes that the module system keeps apart. `toast/Playground.svelte` imports
  // `componentData` from `'./api'` while `+page.svelte` has its own binding of
  // the same name — so reading the concatenation let the sibling's legitimate
  // own-import launder a foreign one on the page. Measured 2026-08-04: with the
  // page importing `'../tooltip/api'`, the first version of this very check
  // still passed, because `own` had picked up `componentData` from the
  // Playground. The tags are still collected from the spliced markup (a Types
  // section may live in a sibling), and a tag there is resolved against the
  // page's imports — a sibling that binds the name differently is pathological
  // and comes out as an error, which is the right direction.
  const generated = generatedDataNames(src);

  const apiTags = openingTags(markup, localNames(markup, 'ApiReference'));
  const typesTags = openingTags(markup, localNames(markup, 'TypesReference'));

  const exempt = STAGE_3_ROSTER[r] === PENDING;

  // A page may render several `<ApiReference>` — the Guide family page renders
  // six, one per surface, and the demo instances a docs page renders are
  // already blanked above. So the question is whether ANY of them is wired, not
  // whether all are: a family page's per-surface tables legitimately share the
  // one Types section below them.
  const apiSources = new Set<string>();
  const typesSources = new Set<string>();

  for (const [label, tags, sink] of [
    ['ApiReference', apiTags, apiSources],
    ['TypesReference', typesTags, typesSources]
  ] as const) {
    for (const tag of tags) {
      const expr = typesExpression(tag);
      if (expr === null) continue;
      const source = resolveTypesSource(expr, markup, generated.all);
      if (source.kind === 'live') {
        sink.add(source.module);
        continue;
      }
      if (exempt) continue;
      errors.push({
        where: `src/routes${r}/+page.svelte`,
        detail:
          source.kind === 'dead'
            ? `<${label} types={${expr.trim()}}> feeds nothing the generator produced — ` +
              `${source.why}. The attribute is there and buys nothing: ` +
              `\`knownTypeNames\` stays empty and every type name stays dead text. ` +
              `Pass \`componentData?.types ?? []\`.`
            : `<${label} types={${expr.trim()}}> is an expression this script cannot resolve ` +
              `to a declaration, so it may be dead. Pass \`componentData?.types ?? []\` ` +
              `directly, or teach \`resolveTypesSource\` this shape.`
      });
    }
  }

  // A `<TypesReference id="...">` overrides the component's own `id="types"`
  // (it takes `{...restProps}`), which is the anchor `revealTableRow` falls back
  // to when it cannot find the row itself — reachable in normal use, because
  // TypesReference's own "only referenced" filter can remove the row. So an
  // override is fine only while some other element supplies `id="types"`, which
  // on the one page that does this is the wrapping `<Section id="types">`.
  const typesIdOverride = typesTags.some((t) => /\bid\s*=/.test(t));
  const hasTypesAnchor = /\bid=["']types["']/.test(markup);
  if (!exempt && typesSources.size > 0 && typesIdOverride && !hasTypesAnchor) {
    errors.push({
      where: `src/routes${r}/+page.svelte`,
      detail:
        `<TypesReference> overrides its \`id\`, and nothing else on the page carries ` +
        `\`id="types"\` — so \`revealTableRow\`'s \`fallbackSectionId: 'types'\` resolves to ` +
        `nothing whenever the row itself is not on screen. Wrap it in a ` +
        `\`<Section id="types">\` or drop the override.`
    });
  }

  // A page documents its OWN types. Same source is not enough when the source is
  // a neighbour: both halves reading `'../tooltip/api'` agree with each other
  // and document the wrong component, while this page's own types land nowhere.
  // Measured 2026-08-04 — that exact edit on the toast page left the run green.
  // Reported per binding, so the error can name the specifier that is wrong.
  const foreign = [...new Set([...apiSources, ...typesSources])].filter(
    (m) => !generated.own.has(m)
  );
  if (!exempt) {
    for (const module of foreign) {
      errors.push({
        where: `src/routes${r}/+page.svelte`,
        detail:
          `documents types from \`${module}\`, imported from ` +
          `'${generated.all.get(module)}' — that is another component's generated data, so ` +
          `this page's own ${documentable.length} documentable type(s) appear nowhere and the ` +
          `table under its heading belongs to something else. Feed both halves the ` +
          `\`componentData\` from './api'.`
      });
    }
  }

  const wired =
    apiSources.size > 0 &&
    typesSources.size > 0 &&
    foreign.length === 0 &&
    // Both halves live is not enough: they must read the SAME generated module.
    // Measured 2026-08-04 — the Guide family page feeding its per-surface table
    // from `panelData.types` and its `<TypesReference>` from
    // `componentData.types` passed the earlier boolean check while not one
    // `#type-GuidePanelProps` link had a target.
    [...apiSources].every((m) => typesSources.has(m));

  if (r in STAGE_3_ROSTER) {
    rosterSeen.add(r);
    if (exempt && wired) {
      errors.push({
        where: 'STAGE_3_ROSTER',
        detail: `${r} is wired now — flip its entry from PENDING to WIRED.`
      });
    }
    if (!exempt && !wired) {
      errors.push({
        where: `src/routes${r}/+page.svelte`,
        detail:
          `is marked WIRED in STAGE_3_ROSTER but is not wired any more — a page this sweep ` +
          `already fixed has regressed. Restore its Types section rather than flipping the ` +
          `entry back.`
      });
    }
    if (exempt) continue;
  }

  checked++;

  if (documentable.length === 0) {
    // Reported, not waved through. This branch is unreachable today (all 108
    // api.ts carry at least one documentable type), and the earlier version
    // booked it as conformant on that basis — which made it a silent hole
    // exactly where the generated input is what broke. Measured 2026-08-04:
    // flipping every `exported` in `toast/api.ts` to false and stripping the
    // page's Types section left the run GREEN and still counted toast among the
    // "wired" pages, because the only guard was a GLOBAL floor (661 → 652,
    // against a floor of 500) while the damage is per page.
    errors.push({
      where: `src/routes${r}/api.ts`,
      detail:
        `has ${(componentData.types ?? []).length} extracted type(s) but none survive ` +
        `\`exported && (!owner || owner === '${componentData.name}')\`, so this page is exempt ` +
        `from the rule for a reason nobody chose. Either the generator regressed (run ` +
        `\`bun run docs:gen:all\`) or this component genuinely exposes no importable type of ` +
        `its own — in which case say so here.`
    });
    continue;
  }

  if (typesSources.size === 0) {
    errors.push({
      where: `src/routes${r}/+page.svelte`,
      detail:
        apiSources.size > 0
          ? `passes \`types=\` to <ApiReference> but renders no <TypesReference> fed from ` +
            `\`componentData.types\` — so it emits \`#type-<Name>\` links whose target section ` +
            `does not exist. \`revealTableRow\` falls back to \`fallbackSectionId: 'types'\`, which ` +
            `resolves to nothing, and the click does nothing at all. Add the Types section.`
          : `has ${documentable.length} documentable type(s) and renders no <TypesReference> — ` +
            `they are documented nowhere. Add \`<TypesReference types={componentData?.types ?? []} />\` ` +
            `(inside a \`<Section id="types" title="Types">\` if the page lists one in its nav).`
    });
  }

  if (apiSources.size === 0) {
    errors.push({
      where: `src/routes${r}/+page.svelte`,
      detail:
        `<ApiReference> is not passed \`types=\`, so \`knownTypeNames\` is empty and ` +
        `\`tokenizeTypeExpression\` returns every Type-column cell as one unlinked segment — ` +
        `${documentable.length} documented type(s) that the table names and no reader can reach. ` +
        `Pass \`types={componentData?.types ?? []}\`.`
    });
  }

  // Keyed on an actual set difference, not on `!wired`. A foreign-but-matching
  // source (both halves on '../tooltip/api') already has its own error above,
  // and reporting it here too produced the nonsense line "reads types from
  // {componentData} while <TypesReference> documents {componentData} — they are
  // disjoint" about two identical sets.
  const mismatched = [...apiSources].filter((m) => !typesSources.has(m));
  if (apiSources.size > 0 && typesSources.size > 0 && mismatched.length > 0) {
    errors.push({
      where: `src/routes${r}/+page.svelte`,
      detail:
        `<ApiReference> reads types from {${[...apiSources].join(', ')}} while <TypesReference> ` +
        `documents {${[...typesSources].join(', ')}} — both halves are live and they do not ` +
        `agree, so the \`#type-<Name>\` links the first emits have no target in the second. ` +
        `Feed them the same \`componentData\`.`
    });
  }

  if (wired) conformant.push(r);
}

// ── Stale exceptions ─────────────────────────────────────────────────────────
for (const [r, why] of Object.entries(STAGE_3_ROSTER)) {
  if (!rosterSeen.has(r)) {
    errors.push({
      where: 'STAGE_3_ROSTER',
      detail:
        `stale entry '${r}' (${why}) — no such page has a generated api.ts any more. The roster ` +
        `is frozen, so removing the route means also lowering ROSTER_SIZE, deliberately.`
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
// Membership, not size. A ceiling (`length > N`) is not a ratchet: every page
// stage 3 wires would free a slot under it, so after 50 fixes there would be 50
// openings and 93 would stay the bar forever. Equality plus permanent keys means
// a page that breaks after today cannot be exempted at all — it is not in the
// roster, and putting it in changes the size.
if (Object.keys(STAGE_3_ROSTER).length !== ROSTER_SIZE) {
  errors.push({
    where: 'STAGE_3_ROSTER',
    detail:
      `${Object.keys(STAGE_3_ROSTER).length} entries, but the roster was frozen at ` +
      `${ROSTER_SIZE} on 2026-08-04. Entries are never added or removed — a fixed page flips ` +
      `PENDING → WIRED, and a page broken after today is wired, not exempted.`
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
const rosterValues = Object.values(STAGE_3_ROSTER);
const pendingCount = rosterValues.filter((v) => v === PENDING).length;
const wiredCount = rosterValues.filter((v) => v === WIRED).length;

console.log(
  `\n${c.bold}typesref-lint${c.reset} ${c.gray}· ${apiDirs.length} api.ts (${pagesWithApi} with a ` +
    `page), ${documentableTotal} documentable types, ${checked} pages checked, ` +
    `roster ${wiredCount}/${ROSTER_SIZE} wired (${pendingCount} pending stage 3)${c.reset}\n`
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
    `(${conformant.length} pages wired, ${pendingCount} pending stage 3, ` +
    `${Object.keys(NO_PAGE).length} page-less by decision).${c.reset}\n`
);
