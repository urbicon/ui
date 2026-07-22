# Technical Debt

Small, non-blocking findings surfaced in passing that don't belong to the task
at hand and can't be fixed on the fly — they need a design decision or a broader
sweep. Logged here so they aren't lost. Actively planned work lives in the
internal TODO instead. Sections are ordered roughly by urgency.

## Packaging / distribution

### The effective npm publisher is the Buny deploy, not `release.yml`

- **Where:** `.github/workflows/release.yml` (publish step + tarball gates),
  `scripts/publish.sh` — vs. the Buny server deploy
  (`buny/packages/deploy-runtime/src/build.ts`, `publishSinglePackage`).
- **What:** v6.26.1 and v6.26.2 appeared on npm ~2 min after their tag push —
  faster than the workflow's lint→build→test→e2e chain can possibly run — and
  without the LICENSE that the workflow's copy step and (since `45e8345`)
  hard assert guarantee. The tag-triggered Buny deploy is what actually
  publishes: bun-pm-pack → extract → npm publish, with no LICENSE copy and
  no tarball gates; a repo-side Actions run (if any) then sees "already
  published" and skips everything. The repo-side publish pipeline is
  effectively dead weight for publishing (still valuable as a CI gate).
- **Why deferred:** Wants an ops decision in the Buny project, not this
  repo: either Buny adopts the same tarball gates (LICENSE assert,
  specifier assert, `FAIL_ON_PUBLISH_ERROR` as default), or tag-publishing
  is consolidated on exactly one owner. The LICENSE itself is fixed
  publisher-independently since v6.26.3 (vendored into every package dir).
- **Update 2026-07-20 (v6.27.1):** the trigger can also silently not fire at
  all — the v6.27.1 tag produced **no** publish for any of the 12 packages
  (lost webhook event; v6.28.0 then shipped everything, verified complete).
  The gate list gains a third item for whoever ends up owning the publish: a
  post-tag verification — a pushed release tag without its npm version after
  a few minutes should alert, not pass unnoticed.
- **Found:** 2026-07-20, v6.26.1/v6.26.2 publish verification.

### `packages/docs` ships no README

- **Where:** `packages/docs/` (the only published package without a
  `README.md`).
- **What:** The package has no consumer-facing readme, so its new `shiki`
  peer-dependency requirement (and its `@sveltejs/kit`/`svelte`/`@urbicon-ui/*`
  peers) is documented nowhere a consumer would look. Minor, but it is the one
  published surface with no install guidance.
- **Why deferred:** Writing the readme is small, but it rides with the same
  packaging-hygiene / launch pass (and a call on whether `@urbicon-ui/docs` has
  any external consumer yet at all).
- **Found:** 2026-07-20, packaging-hygiene pass (sso-debt-wave).

## API design

### Button `preset="pill"`/`"circle"` convenience catalog — deferred by design (BTN-3)

- **Where:** `packages/blocks/src/lib/primitives/Button` + the preset resolution
  in `provider` (`resolveSlotClasses`).
- **What:** A backlog idea (BTN-3 Alt) proposed shipping built-in Button presets
  `pill` / `circle` as convenience defaults, on top of the consumer-registered
  preset system.
- **Why deferred:** It conflicts with the deliberate "presets are
  consumer-defined" architecture — these would be the first library-shipped
  presets, and consumers couldn't tell built-in from their own. The value is
  low: `pill` is already the default (`tier="commit"` → `rounded-commit`), and
  `circle` is a one-class consumer pattern (`class="aspect-square rounded-full
  p-0"` or a project preset). Registering `pill`/`circle` via `<BlocksProvider
  presets>` is the supported path and stays the recommendation. Revisit only if
  a broad consumer demand for a canonical shape catalog emerges.
- **Found:** 2026-07-10, P2 Blocks feature-request pass.

### `appearance` vs `variant`: the style-axis name is split three ways with no documented rule

- **Where:** `segmentGroup.variants.ts` (`appearance: default|text`),
  `toggle.variants.ts` (`appearance: default|dot`), `slider.variants.ts`
  (`appearance: default|rail`) vs. `variant` on every other primitive;
  `docs/COMPONENT-API-CONVENTIONS.md` (defines `variant`, never mentions
  `appearance`).
- **What:** Three primitives name their visual-style axis `appearance`, the
  other 30+ use `variant`. If the implicit rule is "variant = visual weight
  (filled/outlined/ghost), appearance = structural build of the control", it is
  documented nowhere — and Tab (`line|pills|enclosed|solid`, clearly structural)
  runs under `variant`, contradicting it.
- **Why deferred:** One vocabulary decision across the public API: either
  rename the three axes to `variant` (breaking — the pre-release window
  applies) or write the variant/appearance distinction into
  COMPONENT-API-CONVENTIONS and align Tab. Not a mechanical swap.
- **Found:** 2026-07-10, systematic primitives API analysis.

### Intent palettes drift across primitives — three different value sets, one undocumented

- **Where:** `alert.variants.ts` / `toast.variants.ts` (6 values: `+info`,
  **no `secondary`**), `tooltip.variants.ts` (7 values: both `secondary` and
  `info`), `input.variants.ts` / `textarea.variants.ts`
  (`default|success|warning|danger`), Select/Combobox (**no intent axis at
  all** — validation only via the `error` bool + `messageType`);
  `docs/COMPONENT-API-CONVENTIONS.md` §intent.
- **What:** The conventions define the standard 6-value palette and the
  feedback `+info` extension — but not the `−secondary` that Alert/Toast
  actually apply. Tooltip is the lone component carrying all 7 values although
  it is not a feedback component (the same conventions forbid `info` outside
  feedback). Within the form family, Input/Textarea signal validation through
  a private intent set while Select/Combobox signal it through `error` only —
  two mechanisms for one concept.
- **Why deferred:** Wants one palette decision per family (and a call on
  whether form validation goes through `intent` or `error`), then a
  conventions-doc update. Removing values is breaking.
- **Found:** 2026-07-10, systematic primitives API analysis.

### Accordion/Collapsible sibling variant vocabulary diverges

- **Where:** `accordion.variants.ts` (`variant: default|separated|ghost`) vs.
  `collapsible.variants.ts` (`variant: default|card|ghost`).
- **What:** The two disclosure siblings name what is visually the same
  boxed/card-like treatment differently (`separated` vs `card`). A consumer
  moving between them has to relearn the value.
- **Why deferred:** Tiny, but it's a rename (breaking) and wants the same
  vocabulary decision as the appearance/variant entry above — settle both in
  one pass.
- **Found:** 2026-07-10, systematic primitives API analysis.

## Component behaviour

### Three surfaces ingest their content in `$effect`, so the prerendered HTML carries placeholders — 91 API pages assert "No matching properties"

- **Where:** `packages/table/src/lib/core/TableProvider.svelte:87-97` (`setColumns`)
  + `:109-114` (`setItems`); `packages/docs/src/lib/components/CodePanel/CodePanel.svelte:58-75`;
  `packages/docs/src/lib/components/PlaygroundConfigurator/PlaygroundConfigurator.svelte:112-124`.
  Surfaces via `ApiReference.svelte:159-166` (81 pages) and
  `TypesReference.svelte:97-98` (10 pages).
- **What:** `$effect` is client-only, so during SSR `state.items` stays `[]` →
  `TableDesktop.svelte:450-455` renders `<EmptyState message={noDataText}>`.
  Because `ApiReference.svelte:166` sets `noDataText="No matching properties"`,
  **every prerendered API page affirmatively asserts that the component has no
  props.** Measured on the real `dist/blocks/primitives/checkbox.html`: 2 `<tr>`
  (TableHead 1 + EmptyState 1), 0 `<pre>`, and the `indeterminate` description
  absent. The 31× "Loading" on that page is **CodePanel's**, not the Table's —
  `Table.svelte:187` hardcodes `loading={false}`, so the Table's loading path is
  unreachable (see the dead-code entry below). Hydrated pages are correct; only
  the artifact on disk is thin.
- **Why deferred:** Decided (Felix, 2026-07-14) after an investigation:
  `$derived` ingestion is architecturally impossible — `state.items` has three
  writers (`TableStore.svelte.ts:192`, `useLiveUpdates.svelte.ts:103/113/136`,
  `useRemoteData.svelte.ts:42`); it is a mutable buffer the prop seeds and
  live-updates then own. The synchronous-init fix is not 4 lines: ~14 of
  TableProvider's 20 effects are prop→store syncs that would each need a
  mirrored init call (seeding only items+columns makes SSR render 10 rows vs the
  client's 999 — `TableStore.svelte.ts:126` vs `ApiReference.svelte:162`),
  creating 14 permanent drift points. **Today's bug is accidentally
  hydration-*safe*:** `usePersistence` reads localStorage synchronously at
  construction (`usePersistence.svelte.ts:38-80`), so seeding items would make
  SSR (unfiltered) disagree with the client (persisted filters/sort) for every
  `persistenceConfig` + SSR consumer. And `@urbicon-ui/table` has **zero
  component-render tests** (14 files, 254 tests, all node-env store/util/variant)
  — a fix would land with no coverage on the axis it changes. Needs SSR test
  infra first, as one deliberate piece of work.
- **CodePanel is the cheaper, separable half:** `codeToHtml` is *already*
  synchronous (only `createHighlighter` is async), and `createHighlighterCoreSync`
  + `createJavaScriptRegexEngine` exist in the installed shiki
  (`node_modules/shiki/dist/core.d.mts:100`, `index.d.mts:6`), so
  `highlightedCode` could become `$derived` in ~80 LoC with no API change. Gated
  on two unmeasured costs: sync needs statically-imported grammars (moving 9
  lazy-loaded langs into the eager client bundle — and the client highlighter
  cannot be dropped, since `PlaygroundConfigurator.svelte:160-162` generates code
  reactively), and the JS regex engine is documented as less accurate than
  oniguruma, shifting highlighting across 186 usages with no VR coverage of code
  panels.
- **Counter-argument, recorded deliberately:** the project's positioning is
  AI-native DX, and non-rendering crawlers (ClaudeBot/GPTBot/Bing) are the target
  audience — they currently ingest "No matching properties" as the authoritative
  API on 81 pages. The verdict rests on the Option B judgement that the `urbicon`
  CLI is the primary consumer surface and the docs site secondary; if that
  judgement is wrong, so is the deferral. **Cheap middle path if it ever bites:**
  the falsehood is one prop — an honest `noDataText` for the pre-hydration state
  costs nothing and touches no store.
- **Found:** 2026-07-14, building the docs search index (publish-m3-finale). The
  search indexer routes around this entirely by importing `api.ts` directly
  rather than parsing HTML — which is why a Pagefind-style approach would have
  silently shipped an index with zero props. PUBLISH-READINESS A.1's "126
  prerendered pages **mit vollem Inhalt**" is corrected there.

### PrevNextNav reaches only 79 of 136 pages — Table's 13-page learning path has no prev/next, and four links are one-way doors

- **Where:** `apps/docs/src/lib/PrevNextNav.svelte` imported **per-page** rather
  than from a layout; `packages/docs-gen/src/cli/CLI.ts:255,335` emits it into
  the `docs:scaffold` template.
- **What:** 136 pages sit in the nav chain and 22 group boundaries exist, but
  only 79 pages render the component, so **11 of the 22 boundaries are
  reachable**. Missing entirely: all 13 Table feature pages, all 19 Recipes, all
  7 Customization, all 8 Doc-Components, and 11 of the 13 top-level landings.
  The inconsistency is sharpest between siblings of identical shape: Table's 13
  feature pages are the most sequential reading chain in the docs and have no
  prev/next, while i18n's 7 — same shape, same narrative ordering — do. Plus
  **four one-way doors**, where the nav points at a page that renders no nav
  back: `checkbox` → prev → `/blocks`; `tooltip` → next → `/table/table`;
  `/auth` → prev → `/table/accessibility`; `/i18n/auditing` → next → `/icons`.
- **Why deferred:** The fix is to hoist PrevNextNav into a layout, which
  collides with docs-gen's scaffold template (another package emits the per-page
  tag) — a cross-package decision. `docs/DocsPageGuide.md:83,154` also scopes
  PrevNextNav to *component* doc pages, so the Recipes/Doc-Components omission is
  arguably intentional and Table's is arguably not; that call has to be made
  before the mechanics.
- **Found:** 2026-07-14, adding the prev/next section kicker (publish-m3-finale).
  The kicker fix is orthogonal and shipped; this is the larger finding underneath
  it.

### PlaygroundConfigurator: two hardcoded English strings, and `slotClasses.helpToggle` is dead

- **Where:** `packages/docs/src/lib/components/PlaygroundConfigurator/PlaygroundConfigurator.svelte`
  — `:292` (`Reset all ({modifiedCount})`), `:305`
  (`{helpVisible ? 'Hints on' : 'Hints'}`), and `:290`/`:303` calling
  `styles.helpToggle()` directly instead of `slot('helpToggle')`.
- **What:** Two defects in one place. (a) Every other string in this file goes
  through `dt()`, so the German docs locale silently shows English for both
  labels — and `bun run i18n:check` reports **0** hardcoded findings here, i.e.
  its scanner does not cover this file. (b) `slotClasses.helpToggle` is declared
  in the public override union (`index.ts:124`) but never applied, and `unstyled`
  does not strip those buttons, because the call sites bypass `slot()`.
- **Why deferred:** (b) changes public override behaviour for a declared-but-inert
  key, so it wants the same deliberate call as the `actionsBar` slot that was
  just woken (2026-07-14) — and fixing one of three toggle buttons would be worse
  than the uniform status quo. (a) rides along with it. The new share button
  deliberately uses `dt()` and does **not** follow the precedent.
- **Found:** 2026-07-14, adding playground share-links (publish-m3-finale).

### Table's `initial*` family is incomplete — no `initialSort`, no `initialSelectedIds`

- **Where:** `packages/table/src/lib/core/table/index.ts` (TableProps) /
  `TableProvider.svelte`.
- **What:** The table ships `initialPage`, `initialGroupBy` and
  `initialSummaryConfigs`, but there is no uncontrolled way to start sorted or
  with a selection. Starting sorted is impossible altogether; starting selected
  forces the fully **controlled** path (`selectedIds` + `onSelectionChange`
  write-back) even when the consumer only wants a starting value. The landing
  specimen works around both: rows pre-ordered by `p95` so the table *reads*
  sorted (no indicator), and controlled selection wired up just for a
  preselected row.
- **Why deferred:** New public API (`initialSort: { column, direction }`,
  `initialSelectedIds`) — wants the same semantics discussion as the existing
  `initial*` props (interaction with `persistenceConfig`, precedence over a
  controlled prop) rather than an ad-hoc addition.
- **Update 2026-07-13:** The new URL sync (`createTableQueryUrlSync`,
  `4b202c7`) raises the stakes: a shared URL can seed page/group/search but
  not sort/filters, and the table's first query emission then wipes those
  params again (documented in the sveltekit-utils README). `initialSort` (+
  ideally `initialFilters`) would close the gap with no URL-sync API change;
  back/forward re-hydration also waits on this.
- **Found:** 2026-07-09, building the landing-page table specimen.

### Table single-select: row click does not select — the checkbox is the only path

- **Where:** `packages/table/src/lib/core/TableRow.svelte` (`handleRowClick`
  only fires `onRowClick`/expansion; selection happens solely in the
  checkbox's `onCheckedChange`).
- **What:** In `selectionMode="single"`, clicking a row does not select it —
  users must hit the small checkbox. Most single-select tables treat the whole
  row as the click target (and often drop the checkbox column entirely in
  single mode). The landing caption originally promised "click a row to
  select" — corrected to "a checkbox" to match reality.
- **Why deferred:** Row-click selection is a behaviour change with real
  trade-offs (conflicts with `onRowClick` consumers, text selection, expansion
  rows), so it needs a deliberate API decision, not a drive-by change.
- **Found:** 2026-07-09, exercising the landing table specimen with Playwright.

### Table grouping silently disables virtualization — grouping a large virtualized table dumps every row into the DOM

- **Where:** `packages/table/src/lib/core/TableDesktop.svelte`
  (`virtualizedActive = virtualized && !tableState.groupByKey`) + the header
  menu, which still offers "group by" on a virtualized table.
- **What:** Setting a group key on a `virtualized` table doesn't group the
  virtual list — it deactivates virtualization entirely and falls back to the
  normal render path with the **full** item set. For exactly the datasets
  `virtualized` exists for, that means thousands of rows plus group headers
  hitting the DOM at once; observed on the landing departures specimen (8,640
  rows): grouping via the header menu visually broke the board. Sorting is
  fine (`virtualItems = tableContext.sortedItems`). The guard itself is
  deliberate — grouped virtualization isn't implemented — but the *silent*
  fallback is the worst of the available behaviours.
- **Why deferred:** Needs a product decision, either direction is real work:
  (a) implement grouped virtualization (group headers become virtual items
  with their own heights), or (b) suppress the grouping affordances (header-
  menu "group by", `initialGroupBy`) while `virtualized`, documented as a mode
  restriction. The landing specimen dropped `virtualized` meanwhile (2026-07-11)
  and demos the SmartFilterBar + grouping on a day-sized board instead.
- **Found:** 2026-07-11, exercising the landing departures specimen (Felix).

### Virtualized body renders in a second `<table>` — column widths drift from the header (and rows are fixed-height tall)

- **Where:** `packages/table/src/lib/core/TableDesktop.svelte`, virtualized
  branch: the header renders in its own `<table>` above the scroll container,
  the body in a separate `absolute top-0 left-0 w-full` `table-fixed`
  `<table>` inside it (plus a third one for the summary row); row heights come
  from the fixed `ROW_HEIGHTS` map in `utils/virtualizer.ts`.
- **What:** Header and body are two independent tables, so their column
  tracks are computed independently and nothing pins per-column widths across
  them — body columns end up visibly narrower/offset than their headers (on
  the landing specimen the STATUS header sat ~130px right of the status
  badges; screenshot 2026-07-11). The fixed virtualizer row height also
  renders rows noticeably taller than their content at `size="sm"`-ish
  densities.
- **Why deferred:** The real fix is a layout rework of the virtualized path —
  shared column sizing (explicit `<colgroup>`/track widths propagated to
  header, body and summary tables, or a single-table layout with a sticky
  `<thead>`), plus density-aware row heights — and wants a VR pass. Not a
  per-call-site patch.
- **Found:** 2026-07-11, exercising the landing departures specimen (Felix).

### Table live-update push methods are only reachable through a bridge component in a snippet

- **Where:** `packages/table/src/lib` — `pushInsert`/`pushUpdate`/`pushDelete`
  live on the table context (`getTableContext()`), which is only accessible
  from *inside* the `<Table>` component tree.
- **What:** A consumer wiring a WebSocket/SSE feed cannot reach the push
  methods from the page that renders `<Table>` — there is no `bind:` target or
  ready-callback exposing the context. The working pattern (used by the
  live-updates docs page, 2026-07-13) is a bridge component mounted in the
  `toolbar` snippet that captures `getTableContext()` and hands it upward.
  Functional, but non-obvious DX for the feature's primary use case.
- **Why deferred:** Wants an API decision — e.g. an `onReady(context)`
  callback, an exported imperative handle, or documenting the bridge as the
  blessed pattern — not a drive-by addition. Also interacts with what surface
  of the context should be public.
- **Update 2026-07-13, same pass:** `pushUpdate` on a still-pending inserted
  row is dropped on apply (updates merge before inserts; DEV-only orphan
  warn). Fix direction: merge updates into the pending-insert buffer. Assess
  together with the API decision.
- **Found:** 2026-07-13, building the live-updates docs demo.

### Table's structural `<td>` cells bypass `slotClasses.cell`

- **Where:** `packages/table/src/lib/core/TableRow.svelte` (selection/expand
  cells, ~`:116`/`:130`), `TableHead.svelte` (~`:160`), `GroupedRow.svelte`
  (~`:133`) — each renders `class="{rowStyles.cell()} w-12"` / `w-10` as a raw
  concat that never routes `styleConfig.slotClasses.cell`.
- **What:** A consumer's `slotClasses.cell` styles only the data cells (applied
  via `TableCell` / the `resolveSlotClass` path), not the structural
  checkbox/chevron/spacer cells. Harmless today (no bucket conflict with the
  `w-*` utilities on those cells), but an inconsistency if a consumer expects
  `slotClasses.cell` to reach every cell.
- **Why deferred:** Pre-existing; surfaced during the tv()-fold sweep
  (`dd67420`) but out of its scope. Wants a deliberate call on whether the
  structural cells are part of the `cell` slot contract, then routing them
  through `resolveSlotClass` too.
- **Found:** 2026-07-14, table tv()-fold sweep (Opus debt-sweep).

### Table date filters: `greaterThan`/`lessThan` are dead for string/Date values

- **Where:** `packages/table/src/lib/stores/concerns/useFiltering.svelte.ts:55-58`
  (compares via `Number(String(raw).toLowerCase())`) vs.
  `features/SmartFilterBar/FilterMenu.svelte:49-52,301` (offers "after"/
  "before" with a date input for `dataType: 'date'`).
- **What:** For ISO strings (`'2021-03-15'`) or `Date` objects the `Number()`
  coercion yields `NaN`, so the comparison is always false — the date
  operators the UI actively offers only work when the accessor returns
  numeric timestamps. The filtering docs (2026-07-13) deliberately describe
  only the real `Number()` semantics and make no date claim.
- **Why deferred:** Needs a design decision: date-aware parsing in the
  comparator (what formats?) vs. documenting a timestamp-accessor requirement
  vs. dropping the operators for non-numeric date columns. Touches filter
  semantics consumers may depend on.
- **Found:** 2026-07-13, table docs API catch-up.

### Calendar `bind:value` from an empty initial never writes back — controlled-detection keys on `value !== undefined`

- **Where:** `packages/blocks/src/lib/components/Calendar/Calendar.svelte` —
  `handleSelect` (`if (value !== undefined) { value = next; } else {
  internalValue = next; }`).
- **What:** The JSDoc promises "Supports bind:value", but the write-back is
  gated on the prop already being non-undefined. A consumer who starts with
  the only *type-correct* empty selection —
  `let sel = $state<CalendarSelection | undefined>()` + `bind:value={sel}` —
  therefore never receives a selection: the component routes every pick into
  its private `internalValue`. Binding an initial `null` happens to work at
  runtime but is rejected by the prop type (`CalendarSelection | undefined`),
  so the typed path and the working path contradict each other. Found when the
  e2e calendar fixture's day-select probe silently stayed empty; the fixture
  now probes via `onValueChange` instead.
- **Why deferred:** The clean fix is an API decision, not a drive-by: likely
  dropping the `internalValue` split and always assigning the `$bindable`
  prop (Svelte 5 keeps writes to an unbound bindable local, so uncontrolled
  usage still works), or admitting `null` into the value type as the explicit
  empty. Either changes controlled/uncontrolled semantics consumers may
  observe and wants DOM tests over bound-empty, bound-preset and unbound
  arms, plus a look at whether DatePicker shares the pattern.
- **Found:** 2026-07-21, building the Calendar interaction e2e fixture
  (debt-fix-wave continuation).

### Calendar view swipes call `ctx.navigate` ungated — a swipe at the bound fires a no-op emit

- **Where:** `packages/blocks/src/lib/components/Calendar` —
  `CalendarGrid`/`CalendarWeekGrid`/`CalendarDayView`/`CalendarAgendaView`/
  `CalendarYearGrid` swipe handlers (`ctx.navigate(±1)` without a
  `canGoBack`/`canGoForward` gate).
- **What:** The engine clamps month/week/day navigation (no bounds escape),
  but a swipe at the bound still emits a no-op (`onMonthChange`/`onNavigate`
  with an unchanged value) — existing, tested behaviour. The range view got
  the direction-gated treatment in `DateGridScaffold` (2026-07-14); the other
  views were deliberately left as-is.
- **Why deferred:** Aligning them with the DateGridScaffold direction-gate
  changes an emitted-callback contract consumers may observe — wants one
  deliberate sweep with tests, not a per-view drive-by.
- **Found:** 2026-07-14, date-grid range-clamp pass (Fable debt wave).

### Guide cross-route: same-route re-navigation compares paths exactly

- **Where:** `packages/blocks/src/lib/utils/guide.svelte.ts` —
  `#maybeNavigate`'s `route === current()` short-circuit.
- **What:** The post-#41 async/re-entrant false-stops and the `#knownPath`
  targetless-clear skip are fixed (normalized-landing heuristic +
  superseded-navigation epochs + early-return clear; tests in
  `guide.svelte.test.ts`). Remaining sliver: with a normalizing router, a
  step whose `route` equals the current *logical* route still re-navigates
  (exact compare), and a router that no-op's such a `goto` without emitting
  any report leaves a targetless expectation armed until the next step
  (DEV-only symptom).
- **Why deferred:** Normalizing the pre-navigation compare is a behaviour
  decision (skip vs. re-navigate), not a bug fix; no consumer has hit it.
- **Found:** 2026-07-14, async false-stop hardening (Fable debt wave,
  follow-up to #41 / CR-guide-cross-route-followups).

### Checkbox now carries a press cue + intent interaction layer its form siblings lack

- **Where:** `packages/blocks/src/lib/primitives/Checkbox/checkbox.variants.ts`
  (`group-active:scale-95`, `group-hover:bg-<intent>-hover` /
  `group-active:bg-<intent>-active` on the checked/indeterminate box) vs.
  Toggle / RadioGroup, whose controls have neither.
- **What:** The CHK-10 polish (`d6dcf2c`) gave Checkbox the small-element
  press cue and the Button hover/active token ladder. That is the right
  target state, but it makes Checkbox the only form primitive with a full
  interaction layer — Toggle's track and RadioGroup's radios stay static
  under hover/press.
- **Why deferred:** Rolling the same vocabulary across the form family is a
  deliberate sweep (per-control decision what hover/active mean on a track vs
  a radio dot, plus VR review), not a per-component drive-by.
- **Found:** 2026-07-13, CHK-10 checkbox polish.

### Combobox `queryFn` failure has no in-component error-row slot

- **Where:** `packages/blocks/src/lib/primitives/Combobox/Combobox.svelte` — the
  async runner's `.catch`.
- **What:** A genuine `queryFn` rejection can now be surfaced by the consumer:
  `onError(error)` shipped 2026-07-20 (`14d2854`, ConfirmDialog vocabulary),
  so the failure no longer vanishes — the consumer can toast/inline it, and
  without a handler it still warns DEV-only. The remaining gap is purely the
  *in-component* affordance: there is no error-row slot mirroring
  `loadingText`/`noResultsText`, so the listbox itself shows stale results (or
  the "no results" row) on failure unless the consumer renders something.
- **Why deferred:** An error-row slot is a deliberate a11y/design increment
  (live-region semantics, retry affordance, interaction with the stale-options
  decision), not a drive-by. `onError` covers the load-bearing case meanwhile.
- **Found:** 2026-07-10 (CMB-3); narrowed 2026-07-20 once `onError` landed
  (qa-polish-wave).

### Sparkline `fluid` scales the `showEndPoint` dot into an ellipse

- **Where:** `packages/blocks/src/lib/components/Sparkline/Sparkline.svelte`
  (the `showEndPoint` `<circle>` under `fluid` + `preserveAspectRatio="none"`).
- **What:** The `fluid` prop (added `fb46a3c`) stretches the svg to its
  container width via `preserveAspectRatio="none"`. The line strokes stay crisp
  through `vector-effect="non-scaling-stroke"`, but the end-point marker is a
  fill-only `<circle>` living in the stretched user space — `non-scaling-stroke`
  can't reach a fill — so at a non-1:1 container ratio the dot renders as an
  ellipse. Cosmetic, and only on the uncommon `fluid` + `showEndPoint` combo.
- **Why deferred:** The clean fix renders the marker outside the stretched
  coordinate space (a fixed-size overlay, or a second non-scaling layer) — a
  small rework of the marker path, not a drive-by, and only worth it if the
  combo shows up in practice.
- **Found:** 2026-07-14, Sparkline `fluid` review (primitives-debt wave).

## Accessibility

### Badge docs demo hardcodes `text-white` on `bg-warning`

- **Where:** `apps/docs/src/routes/blocks/primitives/badge/Docs.svelte:79`
  (avatar-circle demo, initials "AB").
- **What:** White on the light amber fill measures under AA in both modes —
  the only label-on-a-warning-fill left in the repo after `00d046d` gave
  filled warning surfaces `text-on-warning`, and a hardcoded colour besides.
  `text-on-warning` is the drop-in fix if the demo is meant to be on-system.
- **Why deferred:** Rides with the off-system-demo restyle decision recorded
  in the `text-tertiary` entry below (restyle vs. exempt); if that call lands
  on "restyle", this is a one-liner in the same sweep.
- **Found:** 2026-07-20, v6.26.0 release audit (contrast package).

### `text-tertiary` on subtle surfaces measures 4.18:1 — and the off-system demos trip axe

- **Where:** `packages/blocks/src/lib/style/semantic.css:54`
  (`--color-text-tertiary: light-dark(neutral-600, neutral-300)`), used for
  inactive controls such as `segmentgroup.variants.ts:46`; plus the
  deliberately off-system demos under `apps/docs/src/routes/blocks/**/Docs.svelte`
  (e.g. `text-orange-950/80` in SegmentGroup's "Unstyled warm").
- **What:** `#6e6b64` on `#e8e3e1` = **4.18:1**, under the 4.5:1 AA floor for
  normal text — so every inactive SegmentGroup label, and any tertiary text on
  a subtle surface, misses AA. Unchanged since the initial commit (not a
  regression). Separately, the unstyled/brutalist/glass demos hardcode raw
  palette colours on purpose, and axe scans them because they sit inside
  `[data-docs-preview]`.
- **Why deferred:** Two different calls. Darkening `text-tertiary` is a
  system-wide visual change (it is the muted-metadata token everywhere) and
  wants the same pass as the `text-on-primary` entry above — ideally
  extending `contrast.test.ts` from intent×variant to text-on-surface, which
  it does not yet cover. The demos are a separate question: they exist to
  show off-system customisation, so either they get axe exemptions, or the
  a11y baseline absorbs them, or they are restyled to clear AA while still
  looking off-system.
- **Update 2026-07-14 (Opus quality wave):** the baseline question is settled
  for now — the demos are absorbed as **documented, node-level exceptions** in
  `e2e/a11y-baseline.json` (each names the exact colour pair, so a *different*
  bad pair still fails), which restores the gate's signal without pre-empting
  the restyle-vs-exempt call. The token half is untouched and still wants the
  pass above. Two further demo defects were measured in the same run and belong
  to the same restyle decision: SegmentGroup's dark-skin demo renders `#17150f`
  on `#062f26` = **1.25:1** (a near-invisible selected label), and the badge
  demo hardcodes `text-white` on `bg-warning` = 2.6:1 — the latter against the
  house rule on hardcoded colours, so a demo bug rather than an off-system
  choice.
- **Found:** 2026-07-14, C.1/C.7 pass (reported) + independently confirmed by
  the orchestrator (own calculation: 4.18:1); demo facets extended by the
  widened axe pass (Opus quality wave).

### `text-text-quaternary` measures 1.96:1, and the Combobox demos have no accessible name

- **Where:** the quaternary text token (`packages/blocks/src/lib/style`), seen
  on `/blocks/primitives/journey-timeline`; plus
  `apps/docs/src/routes/blocks/primitives/combobox/Docs.svelte`
  (`:89,103,142,157,187,213,240`).
- **What:** Two findings the widened axe pass turned up that the entries above
  don't cover. (a) `text-text-quaternary` `#b8b5ad` on `#fbfaf6` = **1.96:1** —
  far below AA, and the same ramp stop the Shiki comment token was deliberately
  raised *away from* in `572b738`; if it is a text token it is unusable, so the
  real question is whether it is one. (b) Seven Combobox demos pass neither
  `label` nor `aria-label`, so the input has no accessible name (`label` rule,
  not contrast). `Combobox.svelte:902` is correct — naming is the consumer's
  job — which makes this a demo bug that also models the wrong thing to anyone
  copying it.
- **Why deferred:** (a) rides the same ramp decision as the `text-tertiary` /
  `text-on-primary` entries — settle the ramp once rather than per token. (b)
  is a small local fix, but `apps/docs/src/routes/**` belonged to a parallel
  session's working set at the time. Both are held meanwhile by documented
  exceptions in `e2e/a11y-baseline.json`.
- **Found:** 2026-07-14, widening the e2e axe harness to the code panel (Opus
  quality wave).

### The docs Rooms skin remaps `--color-primary` to an accent that misses AA against `text-on-primary`

- **Where:** `apps/docs/src/lib/style/rooms-docs.css:77` (`--room-accent:
  #00845c`, remapped onto `--color-primary`) vs.
  `packages/blocks/src/lib/style/semantic.css:58` (`--color-text-on-primary:
  var(--color-neutral-0)`).
- **What:** On the docs site, every filled primary control renders white
  `#f6f3ec` on the room green `#00845c` = **4.25:1**, just under the 4.5:1 AA
  floor — measured by axe across 9 primitive pages (accordion, badge, button,
  card, popover, tab, toast, toolbar, tooltip). **This is not the library
  token:** blocks' `--color-primary` is `oklch(0.52 0.15 240)` (blue) and its
  `contrast.test.ts` passes for the library pairs. The skin is what puts the
  pair below AA — so the site that demonstrates the design system shows it in
  a state the system's own contrast test would reject. Distinct from the
  `text-on-primary` entry above (that one is the library's dark-mode problem)
  and from the Rooms-skin entry below (that one is *secondary* text at 74%
  opacity, this one is the solid on-colour).
- **Why deferred:** It is a skin design call, not a fix: nudge `--room-accent`
  darker (it is the docs' brand green — every room field, hero and header
  carries it), or give the skin its own on-colour. Either way wants a VR pass
  across the four rooms. Held meanwhile by a documented exception in
  `e2e/a11y-baseline.json`.
- **Found:** 2026-07-14, widening the e2e axe harness (Opus quality wave); the
  library/skin split was traced during the merge, when the measurement appeared
  to contradict the publish-m3 wave's "light mode is fine" finding — both are
  correct, they measure different layers.

### Rooms-skin secondary text on accent fields misses WCAG AA contrast

- **Where:** `apps/docs/src/lib/style/rooms-docs.css` — the shared
  `[data-docs-sticky-bar] / [data-docs-header] / [data-room-hero]` block (~`:405`)
  remaps `--color-text-secondary` (and `--docs-soft`, which `meta-marker`/
  `font-meta` read) to `color-mix(in oklab, var(--room-accent-fg) 74%,
  transparent)`; the same 74% remap recurs for `[data-room-register]` (~`:477`),
  so a skin-wide fix has to cover both blocks.
- **What:** On the blocks-green field the resolved lede/kicker colour measures
  a 3.01 contrast ratio against `#00845c` (axe `color-contrast`, needs 4.5:1
  for normal-size text). This hits every hero lede, kicker and prerequisites
  line on every room field across the skin — all section landings and every
  component-page header — not any single page.
- **Why deferred:** The 74%-translucent foreground is a deliberate Rooms
  design decision (the quiet-on-field hierarchy). Fixing it is a skin-wide
  design call: raise the mix toward ~88%+, keep the hierarchy via size/weight
  instead of opacity, or consciously accept AA-large only for the lede. Wants
  one decision applied to the whole remap block, with a VR pass over the four
  rooms.
- **Found:** 2026-07-10, axe over the rebuilt `/getting-started` build guide.

### docs `CodePanel` Shiki punctuation token is below WCAG AA in both themes

- **Where:** `packages/docs/src/lib/utils/shiki-editorial-themes.ts` — the
  `punctuation` / `meta.brace` / `punctuation.separator|terminator` /
  `meta.tag.start|end` scopes (light `#9a968e`, dark `#7a776e`).
- **What:** The comment token was raised to AA (`572b738`), but a full-token
  audit shows the mid-gray punctuation still fails on the panel grounds: light
  `#9a968e` = 2.82:1 on `#fbfaf6`, dark `#7a776e` = 3.55:1 on `#232220` (AA
  needs 4.5:1), so `{ } < > ; .` nodes trip axe `color-contrast` on a full-page
  scan. Every other token (string/number/keyword/tag/attribute/variable/
  function/type) clears AA in both themes.
- **Why deferred:** Comments already sit at the ramp's light limit, so
  darkening the frequently-used punctuation is a coordinated ramp/aesthetic
  decision (light needs L≤0.173, dark needs L≥0.247), not a drive-by recolour.
  The reported debt value (1.96) was uniquely the comment token, now fixed.
- **Found:** 2026-07-14, CodePanel a11y pass (Opus debt-sweep).

### docs-app hardcodes `lang="en"` while its chrome is bilingual

- **Where:** `apps/docs/src/app.html:2` (`<html lang="en" class="docs-rooms">`)
  vs. the chrome running through `ta`/`dt` (`+layout.svelte`,
  `PrevNextNav.svelte`, `TableOfContents.svelte`).
- **What:** The locale switcher can put the navigation, prev/next labels and TOC
  into German, but the document language stays `en` — so a screen reader
  pronounces the German chrome with English phonetics (WCAG 3.1.1 Language of
  Page). The page *content* is hardcoded English, so `lang="en"` is right for the
  body text; only the switchable chrome is mislabelled.
- **Why deferred:** It is the a11y facet of the open O1 decision ("chrome stays
  bilingual, content stays English", PUBLISH-READINESS). Three defensible fixes —
  drive `lang` from the active locale (then the English content is mislabelled
  instead), mark only the chrome subtree with its own `lang`, or drop the
  bilingual chrome — and picking one settles O1 rather than patching around it.
  Tracked with the De-Slop rest G.2 in the TODO.
- **Found:** 2026-07-14, verifying the design-authenticity audit before archiving it.

### Combobox multi-select `maxItems` cap has no screen-reader announcement

- **Where:** `packages/blocks/src/lib/primitives/Combobox/Combobox.svelte`
  (`atCap` / `isOptionDisabled`).
- **What:** Once `maxItems` is reached, non-selected options quietly become
  `aria-disabled` and are skipped by keyboard nav — but there is no announcement
  of *why* nothing more can be added. A screen-reader user hits a wall with no
  explanation. Visual users get the same silence (greyed rows, no message).
- **Why deferred:** Wants a deliberate a11y pattern — a live-region hint ("Maximum
  N reached") and/or a visible cap message — designed and SR-tested, not a blind
  attribute. Low frequency (only when a consumer sets `maxItems`).
- **Found:** 2026-07-10, blocks feature-request review (CMB-2 multi-select).

### Toast live region nests `role="alert"` children inside an `aria-live="polite"` region

- **Where:** `packages/blocks/src/lib/primitives/Toast/Toaster.svelte` — the
  container is `aria-live="polite"` `aria-relevant="additions removals"` (drops
  the default `text` token), while each toast child carries `role="alert"`
  (implicitly `aria-live="assertive"`).
- **What:** The nested live regions plus the dropped `text` relevance token are
  why an in-place content change (a promise toast flipping loading→success on
  the same node) is announced inconsistently across screen readers. The
  2026-07-14 `aria-atomic="true"` fix mitigates the in-place flip pragmatically,
  but the deeper structure — two competing live regions, one polite and one
  assertive over the same content — is unresolved.
- **Why deferred:** A proper fix is an a11y-architecture decision (make the
  outer region the sole live region and drop `role="alert"` on children, or
  align politeness, and reconsider whether `aria-relevant` needs `text`),
  validated against real screen readers — not a blind attribute tweak.
- **Found:** 2026-07-14, Toast promise-settle SR review (primitives-debt wave).

## Docs coverage

### ~9 primitive pages use their Customization section as a second Examples bucket (XC-6)

- **Where:** `apps/docs/src/routes/blocks/primitives/*/Docs.svelte` — drawer
  ("Settings Panel"/"Navigation Menu"), progress ("Upload"/"Dashboard Stats"),
  radio-group ("Pricing"/"Theme"), select ("Form Integration"), slider
  ("Volume"/"Price Filter"), segment-group, spinner, textarea; plus the
  menu page's existing "when-to-use" section is missing from its
  `+page.svelte` navigation ToC.
- **What:** Surfaced closing the XC-4 customization-coverage gap (all 36 pages
  now cover unstyled/slotClasses/preset, 2026-07-20). These ~9 sections hold
  realistic *usage* contexts with no Customization API — by DocsPageGuide XC-6
  they are Examples material sitting under the wrong heading. The XC-4 pass
  added genuine customization content to each rather than reorganising, so the
  misfiled usage demos remain.
- **Why deferred:** Moving demos between sections (and renumbering markers) is a
  deliberate section-taxonomy sweep with its own review, not a drive-by during a
  coverage pass; the menu ToC omission wants the same look at that page's nav.
- **Found:** 2026-07-20, XC-4 customization sectioning (qa-polish-wave).

### Table server-mode (`mode="server"`) has no live docs demo, and `/table/live-updates` has a broken import

- **Where:** `apps/docs/src/routes/.../table/remote-data` (both examples render
  with `preview={false}` — code-only) and `.../table/live-updates` (a dev-server
  `[UNRESOLVED_IMPORT] ./LiveFeed.svelte` warning).
- **What:** Two adjacent gaps found while adding table e2e coverage. (a)
  Server-mode is demonstrated only as code — there is no live preview a reader
  (or an e2e) can drive, which is why the new `table-core` remote test had to
  build its own deterministic server-mode fixture with a request counter. (b)
  `/table/live-updates` references `./LiveFeed.svelte`, which the dev server
  fails to resolve — a non-fatal warning today, but a broken reference on a
  shipped route.
- **Why deferred:** (a) wants a real server-mode demo design (mock latency,
  loading/empty states, a visible request indicator) — the same demo-fetcher
  class as the Combobox `queryFn` gap, not a drive-by. (b) is small but wants a
  look at whether `LiveFeed.svelte` should exist or the import should go.
- **Found:** 2026-07-20, e2e table remote/grouping coverage (qa-polish-wave).

### The docs search index is English-only, capped at 2000 chars per record, and indexes playground control names

- **Where:** `apps/docs/scripts/harvest.ts` (`MAX_BODY` ~`:26`, the
  `#playground` section records) + the single prerendered build.
- **What:** Three bounded limits of the search shipped 2026-07-14, each a
  judgement call rather than a bug. (a) **English-only:** the site's chrome is
  EN/DE but content is hardcoded English and there is one prerendered build with
  no per-locale routing, so a German reader searching German prose gets nothing
  from content search (nav titles still match). (b) **`MAX_BODY` = 2000 chars:**
  45 of 650 records hit the cap (`/changelog`, `/ai`, `/recipes`, `/privacy`,
  `/customization/theme-builder`, `/table/column-config`); content past it is
  unsearchable. (c) **`#playground` records** contribute ~30 KB whose text is
  control labels and variant names ("Variant V Style variant outlined filled
  ghost"), near-duplicating the API record on the same page — excluding them
  would cut ~6 % of the index for almost no recall loss.
- **Why deferred:** (a) is a site-architecture decision (per-locale prerendering)
  far beyond search, and it is downstream of the open O1 call on bilingual
  chrome vs English content. (b) wants chunking those pages, i.e. a content
  decision, not a bigger constant. (c) needs a judgement on whether playground
  control names should be findable at all. All three are logged rather than
  silently accepted — the index reports its real size (650 records, 534 KB raw /
  146 KB gzipped, lazily fetched) rather than hiding it.
- **Found:** 2026-07-14, building the docs search index (publish-m3-finale).

### Combobox async search (`queryFn`) has no docs-site demo

- **Where:** `apps/docs/src/routes/blocks/primitives/combobox/Docs.svelte` — no
  mention of `queryFn`/`debounce`/`loadingText`; the only reference is the
  `queryFn` JSDoc in `packages/blocks/src/lib/primitives/Combobox/index.ts`.
- **What:** The async-search mode (CMB-3, shipped `3d256a4`+`f51eee8`) is
  invisible on the docs site — consumers discover it only through the API
  reference or `llm.txt`. A live demo needs a mock-server fetcher pattern
  (the same gap class as the Auth-Demo-Fetcher item in the docs triage §5).
- **Why deferred:** Wants a real demo design (fake latency, abort behaviour,
  loading/empty states), not a drive-by code block. Surfaced while anchoring
  the XC-7 decision matrix, whose async row now points at the JSDoc instead.
- **Found:** 2026-07-14, XC-7 disambiguation work.

## Auth — accepted trade-offs

### `validateCsrf` hard-rejects Origin-less browsers — `Sec-Fetch-Site` is the emerging upstream answer

- **Where:** `packages/auth/src/lib/server/csrf.ts` (Layer 1,
  `if (!origin) return false`).
- **What:** Privacy-hardened browsers (Tor Browser, Firefox in
  resist-fingerprinting mode) send **no `Origin` header** on a top-level form
  POST, so Layer 1 fail-closed-blocks their legitimate logins/mutations — the
  same edge case that drove sveltejs/kit#15992. Upstream is converging on
  checking `Sec-Fetch-Site: same-origin` instead (Rich Harris, 2026-06-18):
  those browsers do send it, it is a forbidden header name (not settable from
  JS), and a `Sec-Fetch-Site`-first check with Origin as legacy fallback
  would admit them without weakening the gate.
- **Why deferred:** Changes the semantics of the package's primary CSRF gate —
  wants its own review + tests (incl. the absent-header analysis: non-browser
  callers send neither header, and a request without ambient browser
  credentials is structurally not CSRF-able), and ideally waits to mirror
  whatever Kit ships for #15992 so consumer expectations stay aligned.
- **Found:** 2026-07-20, follow-up research on sveltejs/kit#15992 / #16313.

### `doubleSubmit` is structurally off for remote-function-first consumers — an `isRemoteRequest` skip could re-enable it

- **Where:** `packages/auth/src/lib/server/csrf.ts` (Layer 2) +
  `packages/auth/src/lib/server/handle.ts` (step 1).
- **What:** Layer 2 requires the `x-csrf-token` header on every mutation;
  SvelteKit's remote-function transport sends only `x-sveltekit-pathname` /
  `-search` and cannot be extended, so any consumer whose mutations are remote
  functions (all current first-party consumers) must keep
  `doubleSubmit: false` — documented in the production checklist since
  2026-07-21. The handle already knows `event.isRemoteRequest` (issue-#43
  guard); skipping Layer 2 for remote requests would be defensible because
  Kit's kernel runs a non-configurable strict same-origin gate for
  `/_app/remote/…` non-GET requests (`respond.js`), independent of
  `kit.csrf.*`. That would let such consumers enable `doubleSubmit` for their
  classic fetch/form surface.
- **Why deferred:** Changes the semantics of a security layer → wants its own
  adversarial review + tests; and it is only half a fix — the no-JS
  `?/remote=` fallback has `isRemoteRequest === false` and native form posts
  still send no header, so those surfaces would still 403. Needs a deliberate
  design decision (skip vs. token-in-form-field support vs. selective
  per-surface enablement — the package's own fetch-based auth endpoints are
  header-capable even in remote-first apps — vs. status quo). Hard
  constraint from the 2026-07-21 adversarial review: any skip must key on the
  real `event.isRemoteRequest`, never on the handle's `isRemoteFormPost` —
  the no-JS fallback runs through the page pipeline and is *not* behind
  Kit's remote gate, so skipping Layer 2 there would drop it to
  origin-only with no kernel backstop.
- **Found:** 2026-07-21, consumer-digestion analysis (cookery/utilio/buny
  CSRF sessions).

### `passkey.updateCounter`: delete-race is misclassified as `counter_regression`

- **Where:** `packages/auth` — `passkey/handlers.ts:370` (caller of
  `updateCounter`).
- **What:** Since the TOCTOU fix (1a40207), a counterless passkey deleted
  mid-login makes `updateCounter` return `false` → the caller logs audit
  reason `counter_regression` and reports "possible cloned authenticator".
  Outcome (reject, fail-closed) is correct, but the diagnosis is wrong — a SOC
  alarms on a benign delete-race as a clone attack.
- **Why deferred:** Judgment call: the race is extremely rare, and the only
  fix (re-query `findByCredentialId` on `false` → `credential_deleted`) costs
  an extra query on the genuine clone-attack path too. Pure observability, no
  security impact.
- **Found:** 2026-07-05, silent-failure-hunter pass on the auth review
  package 6.

### auth `Buffer` usage binds to Node/Bun (not edge-portable)

- **Where:** `packages/auth` — `password.ts` (PBKDF2 hex) + `totp.ts` (secret
  base64) use Node's `Buffer` instead of the Web-API-only `encoding.ts`
  helpers.
- **What:** Deliberate trade-off (the Prisma adapter needs Node/Bun anyway),
  documented in AUTH.md. **If** Edge/Workers ever becomes a target: replace
  `Buffer.from(x).toString('hex'|'base64')` with hex + base64 helpers in
  `encoding.ts` (base64 ≠ base64url — a new helper is needed). The zero-dep
  maxim is **not** violated (Buffer is a runtime global, not a dependency).
- **Found:** 2026-07-05, runtime-constraint documentation work.

## Dead code / decorative config

### `Table.svelte` hardcodes `loading={false}` — the whole loading-state path is dead for client-mode consumers

- **Where:** `packages/table/src/lib/core/table/Table.svelte:187`
  (`loading={false}` passed to `<TableProvider>`).
- **What:** `TableProvider` accepts a `loading?: boolean`
  (`TableProvider.svelte:21`) and syncs it via `$effect` at `:199-201`, but the
  public `<Table>` never forwards a boolean — it hardcodes `false`.
  (`Table.svelte:66`'s `loading` prop is the *snippet*, a different thing.) So
  `tableState.loading` can only become true through server mode
  (`setServerLoading`, `useRemoteData.svelte.ts:59`), and for every client-mode
  table `loadingText` (`Table.svelte:57`), `LoadingState.svelte` and the `{#if
  tableState.loading}` branches at `TableDesktop.svelte:403-407` are unreachable.
- **Why deferred:** Needs an API call — should `<Table>` expose a `loading`
  boolean at all, or should the dead path be removed? Found while tracing where
  the prerendered "Loading" strings came from (they were CodePanel's, *precisely
  because* this path is dead).
- **Found:** 2026-07-14, SSR-gap investigation (publish-m3-finale).

### docs-theme.css ships four intent families nothing consumes — and `--docs-surface-*` resolves to invalid

- **Where:** `packages/docs/src/lib/style/docs-theme.css` — the
  `--color-code` / `--color-example` / `--color-playground` / `--color-api`
  intents (each with `-hover`/`-active`/`-subtle`/`-emphasis`) plus
  `--docs-surface-code|-example|-api|-glass` and
  `--docs-shadow-card|-elevated|-float`. ~27 tokens.
- **What:** Grep finds **zero consumers** — no `bg-code`, `text-example`,
  `var(--docs-shadow-card)` anywhere; the only non-definition hit is prose
  ("color-coded events"). Independently confirmed by measurement: Tailwind 4
  prunes unused `@theme` vars, so `--color-code` read `(unset)` in 3 of 4
  theme states. Additionally `--docs-surface-code|-example|-api` reference
  `--color-*-950`, a step the scales never define (they run 50–900), so those
  three resolve to invalid in **all** states. The families were converted to
  `light-dark()` on 2026-07-14 (they were the repo's only `:root.dark`
  token-duplication block, contradicting semantic.css's own contract) — that
  removed the latent trap and ~35 lines of dead CSS, but the honest end state
  is deleting the four intents outright (~70 lines).
- **Why deferred:** Deleting a whole public-looking token surface from the
  docs package is a deliberate call (are these a planned palette for
  doc-page accents, or leftovers?), not a drive-by after a selector fix. If
  they stay, the `-950` refs are a 4-line alias fix.
- **Found:** 2026-07-14, C.6 system-dark follow-up.

### `ApiReference.svelte` silently drops non-`http` `seeAlso` values

- **Where:** `packages/docs/src/lib/components/ApiReference/ApiReference.svelte`
  (the `seeAlso` render branch).
- **What:** `ApiReference` renders a `seeAlso` value as an external link only
  when it is an `http(s)` URL; a route-relative `seeAlso` (the shape docs-gen
  emits for local type/variant anchors, e.g. `…#variants`) is silently
  dropped rather than rendered as an in-page link.
- **Why deferred:** A small render fix, but it wants a deliberate call on the
  in-page-anchor UX (same-page scroll vs. cross-page nav) rather than a blind
  branch. Surfaced alongside the now-removed `typeAnchor`/`typePreview` dead
  emission.
- **Update 2026-07-20 (qa-polish-wave):** the `typeAnchor`/`typePreview` half of
  this entry is **done** — docs-gen stopped emitting both fields (`510a410`) and
  the dead `ApiProp.typeAnchor`/`typePreview` declarations were removed from
  `packages/docs` (`a9609c0`). Only the `seeAlso` render drop above remains.
- **Found:** 2026-07-14, C.6 API type-link pass.

### docs-app still depends on two fonts it no longer loads

- **Where:** `apps/docs/package.json:18-19` —
  `@fontsource-variable/newsreader` + `@fontsource-variable/public-sans`.
- **What:** Leftovers from the editorial serif/sans pairing that Color Rooms
  replaced: the app loads only `@fontsource-variable/schibsted-grotesk` and
  `@fontsource/jetbrains-mono` (`+layout.svelte:22-28`). Neither dead package is
  imported anywhere in `apps/docs/src` — the only trace is a prose mention in
  `rooms.css:40`. They cost install time, not bundle size (never imported, so
  never bundled).
- **Why deferred:** Removing them is a one-line `bun remove` plus a lockfile
  churn — trivial, but it should ride along with a deliberate check of whether
  the Rooms skin ever wants a serif display voice back (the audit's original
  Cluster A direction) rather than being dropped silently mid-cleanup.
- **Found:** 2026-07-14, verifying the design-authenticity audit before archiving it.

### Route-level `docsConfig` exports are decorative — nothing consumes them

- **Where:** the `docsConfig` exports in all 59 route-level `Docs.svelte` /
  `DocsCustom.svelte` files (apps/docs), plus the config surface behind them:
  `ApiConfig.showInheritance`/`showDeprecated`, `VariantsConfig.groupBy` (and
  its `'variant'` default), `CrossReferenceConfig.knownTypes` + the remaining
  `KnownTypeConfig` interface, and the `DocumentationSection`/`SectionContent`
  apparatus in `shared-types/documentation-core.ts` (incl. two
  `groupByCategory` fields, zero consumers outside its own file).
- **What:** docs-gen only parses `docsConfig` from package-internal
  `docs.svelte` files (`SvelteDocsParser` via `loadDocsConfig`) — and none
  exist. The route-level exports are never imported at build or runtime; the
  config fields listed above are set but never read. The dead
  `api.groupBy`/`KnownTypeConfig.category`/single-file-TS slice was removed
  2026-07-13 (`8b522c5`); this entry is the remainder.
- **Why deferred:** Removing the whole `docsConfig` surface is its own sweep
  (59 files + shared-types + docs-gen types) and wants a deliberate check of
  what the scaffold template should emit instead — not a drive-by after the
  category cleanup already landed.
- **Found:** 2026-07-13, while removing the dead prop-category scaffolding
  (docs-gen cleanup agent).

## Testing / CI gates

### docs-gen: `failFast` is coupled to parallelism being off — enabling it silently downgrades errors to exit 0

- **Where:** `packages/docs-gen/src/.../PipelineOrchestrator.ts:29` —
  `failFast: !config.processing?.parallel?.enabled`.
- **What:** `ErrorHandler.reportError` only rethrows a `PipelineException` when
  `failFast` is on; that rethrow is what makes a generation error reach
  `success: false` and the CLI's non-zero exit. Parallelism is off today, so
  the gate works (verified end-to-end: a broken `docsConfig` exits 1). Turn
  `processing.parallel` on and the rethrow disappears: the error is still
  logged, the artifact is still missing, and the run exits **0**. A performance
  switch silently changing error strictness is a trap for whoever flips it.
- **Why deferred:** Wants a deliberate decision on what the coupling was for
  (presumably: don't abort sibling tasks mid-flight) and how to keep strictness
  without it — e.g. collect failures and fail at the barrier. Not a drive-by:
  it changes what a parallel run does on error.
- **Found:** 2026-07-14, closing the docsConfig error channel (Opus quality
  wave).


### `urbicon validate` matches rule patterns in text content — pages that *quote* an anti-pattern fail the gate

- **Where:** `packages/design-engine` linter rules (string/regex matching over
  the file), observed via `bunx urbicon validate src/routes/+page.svelte` in
  `apps/docs`.
- **What:** The landing's For-machines specimen renders example linter output
  as prose (`✗ [raw-tailwind-color] \`bg-green-500\``, `focus:ring-2` inside
  `<p>` text). `validate` flags those **text nodes** as real
  `raw-tailwind-color` / `focus-not-visible` errors — the rules don't
  distinguish class-attribute values from content that merely quotes an
  anti-pattern. Consequence: any docs/marketing page that *shows* a violation
  (docs about the linter itself, migration guides with before/after snippets)
  is permanently FAIL and would block the `urbicon hook` / CI gate. The
  landing additionally collects poster-scope false positives
  (`--room-accent-fg` → `token-hallucination`, intentional fixed poster
  colours) — expected for a page that is deliberately outside the token
  system, but there is no documented exempt/ignore mechanism (per-file
  pragma, manifest exclude list) to encode that intent.
- **Why deferred:** Two design decisions, not a quick patch: (a) scope the
  deterministic rules to class-attribute values (attribute extraction instead
  of whole-file regex) while keeping stdin/fragment linting working; (b) an
  explicit exemption mechanism (file pragma or manifest `## Exempt` section)
  for deliberate off-system surfaces like the landing. Both live in
  design-engine with their own tests.
- **Found:** 2026-07-11, dogfooding the `urbicon` CLI against the landing
  page (session review of the AI-DX claims).

### The axe gate never scans dark mode — and the docs skin overrides the token it would catch

- **Where:** `e2e/a11y.spec.ts` (no `colorScheme: 'dark'` context, so every scan
  runs light) + the docs Rooms skin, which remaps `--color-text-on-primary` to
  its own `var(--_afg)`.
- **What:** Two independent blind spots that compound. The 2026-07-14
  `text-on-primary` bug spanned 125 dark-mode combinations down to 1.51:1 and
  axe never saw a single one: the harness only emulates light, and even if it
  emulated dark, the docs pages it scans override that very token. So the
  entire surface where the worst contrast bug in the system lived is invisible
  to the a11y gate by construction — `style/contrast.test.ts` is its only
  guard, and that test reads the CSS rather than the rendered page.
- **Why deferred:** Adding a dark pass is cheap (a second Playwright project
  with `colorScheme: 'dark'`), but it doubles the a11y matrix and the baseline
  ratchet (`42b7fc5`) has to absorb the dark-mode violations deliberately, not
  by snapshot. The skin-override half is really a question about what the
  fixtures should be: axe scanning the *docs site* measures the skin, not the
  library — the token-level truth needs a library-only fixture (the VR suite
  already has one: `test-fixtures/primitives`).
- **Found:** 2026-07-14, landing the `text-on-primary` remedy.

### VR tolerance hides colour-only regressions — `maxDiffPixelRatio: 0.01` let a full label inversion pass

- **Where:** `playwright.config.ts:14` (`maxDiffPixelRatio: 0.01`) + the
  `--update-snapshots` default (updates only what it considers changed).
- **What:** On small fixtures the ratio is large enough to swallow a *complete
  colour inversion*: when `text-on-primary` flipped white→dark (2026-07-14),
  the `badge-dark-library` baseline **passed unchanged** — its label pixels are
  under 1 % of the shot — so a plain `--update-snapshots` refreshed only
  `button`, leaving badge's baseline asserting the old, wrong render. Found by
  running `--update-snapshots=all` and diffing the true blast radius. The same
  blind spot had already left **8 stale baselines** in the tree
  (`input-{dark,light}-{library,rooms}`, `checkbox-{dark-rooms,light-library,
  light-rooms}`), most likely since the Input `id`/label fix (`c8753a4`)
  without rebaselining; they were reverted rather than swept along, and remain
  stale. Separately, `progress-light-rooms` is **non-deterministic** — it
  differs between identical runs.
- **Why deferred:** Three coupled calls: lowering/removing the tolerance (which
  demands the flaky `progress` fixture be fixed first, or it goes permanently
  red), deciding whether `--update-snapshots=all` becomes the documented
  default, and re-baselining the 8 stale shots deliberately (each needs looking
  at — that is the point of the suite). Interacts with the darwin-only entry
  below.
- **Found:** 2026-07-14, landing the `text-on-primary` remedy.

### e2e visual snapshots are `chromium-darwin`-only — Linux CI can't verify them

- **Where:** `e2e/snapshots/**` (all committed PNGs, incl. the
  `visual-regression.spec.ts-snapshots/**`) and `.github/workflows/ci.yml` (the
  `e2e` job, `runs-on: ubuntu-latest`).
- **What:** Every committed Playwright screenshot is stamped `-chromium-darwin`.
  Playwright resolves snapshots per platform, so on Linux (CI) it looks for
  `-chromium-linux.png`, finds nothing, and hard-fails. The whole e2e-visual layer —
  `floating.spec.ts`, `guide.spec.ts`, and `visual-regression.spec.ts` (the
  10-primitive × light/dark × library/editorial matrix) — is therefore darwin-only.
  The visual-regression suite is explicitly `test.skip`-gated to darwin so it adds
  no red to the CI e2e job; the pre-existing floating/guide specs are NOT gated
  (they already fail on Linux). **Local caveat:** baselines must be produced with
  the full `channel: 'chromium'` build — `headless_shell` renders fonts ~1px
  differently and flips text-heavy snapshots (seen on `guide.spec.ts` hint
  shots).
- **Why deferred:** Making the visual layer CI-green needs per-platform baselines,
  which can't be produced on a macOS box: either (a) generate `-chromium-linux`
  baselines via the official `mcr.microsoft.com/playwright` Docker image and commit
  both platforms, (b) add a macOS runner for the e2e job, or (c) a one-off CI bootstrap
  that runs `--update-snapshots` on Linux and commits the result. Each is an infra
  decision spanning all three specs, not a change to the suite in flight.
- **Found:** 2026-07-08, adding the primitive visual-regression suite.

### i18n source scanner: documented analysis limits (strict mode not built)

- **Where:** `@urbicon-ui/i18n/audit` unused-key scanner (WP2 of the i18n
  audit plan).
- **What:** The scanner is intra-file + heuristic (no cross-file data flow).
  Three known false-positive classes usually downgrade to `suspect` via the
  global opaque-site rule but can reach `confirmed` in opaque-free codebases:
  (a) alias-of-alias / translate functions passed as callbacks, (b) cross-file
  wrapper exports, (c) opaque `t(variable)` render sites in a different file
  than the key definition. Mitigated by loose-literal harvest + template-prefix
  harvest + the `dynamicKeys` allowlist. Additionally, inline `i18n-used:`
  comment markers (plan §B3 layer 4) were deferred — the config allowlist has
  the same effect.
- **Why deferred:** A real fix needs type-checker-backed resolution (plan §B1
  approach 4) — documented as an optional future "strict mode", deliberately
  not built. Revisit only if consumers hit the false-positive classes in
  practice.
- **Found:** 2026-06-25 ff., i18n-audit implementation + adversarial review
  (commit `fe38878`).

### i18n WP4: lazy-bundle key parity is advisory only

- **Where:** `createPackageI18n(name, { en }, { loaders })` /
  `validatePackageTranslations`.
- **What:** Key parity of lazy-loaded locales isn't checked at compile time
  (loaders return the wide `Translations`), and `validatePackageTranslations`
  isn't automatically coupled to registered loaders — parity is enforced only
  by a manual test the docs point to.
- **Why deferred:** No consumer uses lazy loading yet, so the gap is latent.
  When one does: add a CI test that resolves the loaders and validates against
  the `en` bundle (possibly a library helper that builds the parity check from
  registered loaders).
- **Found:** 2026-06-15, WP4 review.

### prettier-plugin-svelte corrupts single-quoted attributes containing double quotes

- **Where:** docs-app `.svelte` sources run through Prettier (lefthook
  pre-commit); observed on `code='<X a="b">'`-style attribute values.
- **What:** Prettier rewrites the outer single quotes to double quotes without
  escaping the inner ones — `code="<X a="b">"` — which no longer parses
  ("Expected token ="). Verified 2026-07-13 on the info-card page; worked
  around by using `isolate` extraction instead of inline code attributes.
- **Why deferred:** Upstream prettier-plugin-svelte behaviour; needs a minimal
  repro + upstream issue (or a repo convention: code snippets always via
  template-literal props / `isolate`, never single-quoted attributes).
- **Found:** 2026-07-13, docs-package section polish.

## docs-gen

### docs-gen config surface carries ~12 never-consumed interfaces/fields

- **Where:** `packages/docs-gen/src/types/configuration.ts` + related — e.g.
  `LLMFilterConfig`, `APIInclusionConfig`, `SharedOutputConfig`/`BackupConfig`,
  `WatchConfig`, `ProfilingConfig`, `ParallelConfig.strategy`,
  `PackageConfig.priority`/`metadata`,
  `TypeScriptConfig.compilerOptions`/`include`/`exclude`.
- **What:** The 2026-07-20 JSDoc inventory (which closed the coverage gap on
  this surface) made visible that ~12 config interfaces/fields are declared and
  type-checked but never read by the current pipeline. They are now honestly
  labelled "Not consumed by the current pipeline" / "Reserved" rather than
  described with invented behaviour, but the honest end state is a prune-or-
  implement decision.
- **Why deferred:** Deleting a whole public-looking config surface (and deciding
  which fields are planned vs. leftover — `WatchConfig`/`enableWatch` in
  particular pair with the still-caller-less `updateConfig` watch path) is its
  own deliberate sweep, not a drive-by after a documentation pass.
- **Found:** 2026-07-20, docs-gen JSDoc coverage pass (qa-polish-wave). The
  earlier `generateGlobalLlmsTxt` silent-catch and watch-path `configPath` drop
  entries were resolved in the same wave (`c269849`/`c13781e`).

## Toolchain / dependencies

### TypeScript 7 (native Go compiler) upgrade blocked on Svelte type-checking support

- **Where:** the single `typescript` catalog pin
  (`package.json` → `workspaces.catalog`, currently `^6.0.3`), consumed by
  every package via `"typescript": "catalog:"`; plus the three in-repo
  consumers of the classic compiler API — `svelte-check` (the `check` script
  of every package), `packages/docs-gen/src/extractors/**` (7 files,
  `import * as ts from 'typescript'`) and `packages/i18n/src/lib/audit/scan/ts-walker.ts`
  (`await import('typescript')`).
- **What:** TS 7.0.2 (npm `typescript@latest`) is the native Go compiler
  (Project Corsa) — ESM-only, shipped as platform Go binaries
  (`@typescript/typescript-<os>-<arch>` optional deps). Its main entry exports
  **only** `./lib/version.cjs`; the classic ("Strada") synchronous compiler API
  (`createProgram`, `getTypeChecker`, `createSourceFile`, `forEachChild`,
  `SyntaxKind`, `ts.sys`, `getJSDocTags`, …) is gone, replaced by a redesigned,
  partly-async API under `./unstable/ast` · `./unstable/sync` · `./unstable/async`.
  Verified empirically in a throwaway worktree bumping the catalog to `^7.0.2`
  (2026-07-13): `bun install` and native `tsc --version` / `tsc --noEmit` on
  pure-TS packages work (`design-engine`: 0 errors), **but** `svelte-check`
  crashes on load — `TypeError: Cannot read properties of undefined (reading
  'useCaseSensitiveFileNames')`, because it does `require('typescript').sys.…`
  at construction. That kills the type gate for **every** package. Official
  Svelte (and Vue/Astro/Angular/MDX) template type-checking is not supported on
  TS 7 yet — tracked upstream at `sveltejs/language-tools#3063` ("TypeScript 7
  RC crashes svelte2tsx and svelte-check"); `svelte2tsx`'s peer range is still
  `^4.9.4 || ^5.0.0 || ^6.0.0`, explicitly excluding 7.
- **Why deferred:** A *clean* whole-monorepo TS 7 with all gates green is
  **upstream-blocked** — no in-repo change fixes svelte-check; svelte-check /
  svelte2tsx must ship native-TS7 support first. Two non-clean paths were
  assessed and rejected: (a) **side-by-side** — native `tsc` for pure-TS
  packages + the ≤6 JS API kept for svelte-check/docs-gen/i18n (Microsoft's own
  transition recipe, but two toolchains in one repo, not "the whole app on
  TS7"); (b) **force it now** — swap official svelte-check for an experimental
  community checker (`svelte-fast-check` / `svelte-check-native`, both
  svelte2tsx + tsgo) and rewrite docs-gen + i18n against the literally-`unstable`
  AST API. Decision (Felix, 2026-07-13): **stay on TS 6.0.3**, ship nothing,
  revisit.
- **Revisit trigger:** when svelte-check / svelte2tsx declare native-TS7 support
  (watch `sveltejs/language-tools#3063` and the svelte2tsx peer range). At that
  point the upgrade is expected to be the one-line catalog bump plus migrating
  the docs-gen extractors and the i18n `ts-walker` to `typescript/unstable/ast`
  (+ `unstable/sync` for program/checker). TS 7.1, expected ~3–4 months after
  7.0, widens the public API and may unblock the tooling.
- **Found:** 2026-07-13, on the requested "upgrade the whole app to TypeScript
  7" task — resolved to an empirical worktree spike + this deferral.

## Design tokens

### Two `description` slots render body copy at 10–11px, below every legibility floor

- **Where:** `packages/blocks/src/lib/primitives/RadioGroup/radioGroup.variants.ts:71`
  and `packages/blocks/src/lib/primitives/Stepper/stepper.variants.ts:72` (the
  `description` slot).
- **What:** Both render `description` — full sentences — at `text-3xs`/`text-2xs`
  (10–11px), below every practical legibility floor. The tokens page states the
  rule (2xs/3xs are for marks, hints and dense grids, **never** for body copy);
  these two contradict it. Tokenising the sub-xs floor merely made them
  greppable — the underlying size was already `text-[10px]`/`text-[11px]`.
- **Why deferred:** A deliberate size decision with a VR pass, not a token swap
  or find/replace — bumping `description` to a legible step changes the visual
  rhythm of both controls.
- **Update 2026-07-20 (qa-polish-wave):** the *mechanical* half of the original
  entry — 54 exact-pixel `text-[11px]`→`text-2xs` / `text-[10px]`→`text-3xs`
  swaps across `table`, `packages/docs` and `apps/docs` — is **done**
  (`e714ce2`); `rg` confirms no `text-[10px]`/`text-[11px]` remain outside
  `blocks`. These two `description` sites (the a11y design call, always the real
  remainder) are what is left.
- **Found:** 2026-07-14, tokenising the sub-xs type floor (publish-m3-finale).

### `themes/index.css` claims hue-only shifts preserve contrast — they don't

- **Where:** `packages/blocks/src/lib/style/themes/index.css:24-27` ("Only the
  hue shifts; lightness and chroma match the foundation ramp, so WCAG contrast
  is preserved").
- **What:** False as a general rule: OKLCH lightness is perceptual, but
  luminance still moves with hue at constant L/C — ocean's `secondary-500`
  measured 4.39:1 where the default ramp's measured 4.99:1, which is exactly
  how it slipped under AA (fixed 2026-07-14). For the *chassis* neutral ramp
  the sentence actually refers to, it holds empirically (5.95–6.05 across all
  themes) — but only because chroma there is ≈ 0.01.
- **Why deferred:** A doc-wording call ("holds at near-zero chroma") that
  should be made together with whoever owns the theming guide, and it is now
  guarded either way: `contrast.test.ts` measures every theme, so a
  hue-shifted theme that breaks AA fails the suite rather than relying on a
  comment.
- **Found:** 2026-07-14, PUBLISH-READINESS D.1 contrast audit.
