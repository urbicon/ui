# Technical Debt

Small, non-blocking findings surfaced in passing that don't belong to the task
at hand and can't be fixed on the fly — they need a design decision or a broader
sweep. Logged here so they aren't lost. Actively planned work lives in the
internal TODO instead. Sections are ordered roughly by urgency.

> **Decision pass 2026-07-24:** the decision-blocked entries here were triaged and
> resolved — verdict + wave assignment per entry in
> [internal/DEBT-DECISIONS-2026-07-24.md](internal/DEBT-DECISIONS-2026-07-24.md)
> (7 waves W1–W7). Scheduled entries stay here until their wave lands (the wave
> then updates/removes them); entries decided **not to act on** carry an inline
> `Decision 2026-07-24` line below so they aren't re-litigated.

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
- **Decision 2026-07-24:** ⏸ Hold — ops decision in the Buny project, to be made
  with the hosting call; not resolvable in this repo.
- **Found:** 2026-07-20, v6.26.1/v6.26.2 publish verification.

## Bundle size

### The blocks Icon component grew ~4.8 KB min against the v6.31 baseline with no source change

- **Where:** `packages/blocks/bundle-size.baseline.json` (the `Icon` entry) vs.
  the measured bundle; no icon-source change since the baseline commit
  `973e535`.
- **What:** Re-baselining during the mint tree-shaking pass (debt-fix-wave-4)
  surfaced a pre-existing drift: `Icon` measures +4,762 B min / +2,110 B gz
  against the committed baseline, with no change to icon sources and no mint
  involvement in its graph — most plausibly the v6.33.0 `bun.lock` bump
  changed a transitive dependency's emitted code. The growth is now absorbed
  into the refreshed baseline, so the gate will catch *further* growth but the
  jump itself is unexplained.
- **Why deferred:** Root-causing needs a diff of the measured Icon bundle
  between the two lockfile states (the measurement tool supports `--breakdown`)
  — archaeology, not a fix, and nothing observably broke.
- **Decision 2026-07-24:** ⏸ Hold — archaeology, not a fix; the refreshed
  baseline gates further growth. Revisit only if it recurs.
- **Found:** 2026-07-23, mint tree-shaking re-baseline (debt-fix-wave-4).

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
- **Decision 2026-07-24:** ✕ Won't-do — conflicts with the "presets are
  consumer-defined" architecture; `pill` is already the default and `circle` a
  one-class consumer preset. Closed.
- **Found:** 2026-07-10, P2 Blocks feature-request pass.

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

### Field label/helper/error MARKUP is re-implemented per form component (part b)

- **Where:** the label/message scaffolding in `Input.svelte`, `PinInput.svelte`,
  `TimeInput.svelte` (label span + `aria-labelledby`, `role="alert"` message,
  required asterisk, `messageType` derivation).
- **What:** Part (a) — the duplicated tv() **class strings** for the field frame
  — is **resolved** (debt-fix-wave-5, 2026-07-24): the shared frame/focus-ring/
  variant/intent/state/label fragments now live in
  `packages/blocks/src/lib/internal/field-chrome.ts` and are composed back into
  `input`/`pin-input`/`time-input.variants.ts`, byte-identical to the old inline
  strings (proven by a 47 872-combination resolved-class matrix diff, 0 diff).
  What remains is part (b): the label/helper/error **markup** is still hand-
  re-implemented in each of the three `.svelte` files. Deliberate per-component
  divergences stay inline in the variants (Input's `xs`/`underline`, PinInput's
  cell-height scale + `focus-visible:z-10`, TimeInput's `focus-within` +
  cursor-free readonly) and are commented at each site.
- **Why deferred:** A shared markup cut (a `FieldShell` snippet/component or a
  `useFieldScaffold` helper) is a bigger, behaviour-touching change with its own
  a11y surface (id wiring, `aria-describedby`), and wants VR coverage — none of
  PinInput/TimeInput is in the VR fixture yet. Not a drive-by after the style
  fragments landed.
- **Found:** 2026-07-24, component-trio review; part (a) closed same day
  (debt-fix-wave-5).

## Component behaviour

### Mint demand-load path has no end-to-end coverage

- **Where:** `packages/blocks/src/lib/mint/registry.ts` (`loadBuiltinMints` /
  the unresolved branch of `apply()`); `e2e/`.
- **What:** The jsdom suite (`registry.test.ts`, `compose.test.ts`) covers
  resolution order, override precedence and the demand-load *registration*,
  but the real path — dynamic `import()` over the network, effect applied
  after the chunk lands — never runs end-to-end anywhere. A recipe-page smoke
  (click a `mint="ripple"` element, assert the `blocks-mint-ripple` span
  appears) would cover the whole chain including the dist specifier rewrite.
- **Why deferred:** e2e additions ride with an e2e wave (full-suite run
  required per house practice), not with a review pass.
- **Found:** 2026-07-23, review of the mint tree-shaking commit (00922a8).

### Calendar day/agenda view region: three small a11y gaps on the focusable-region pattern

- **Where:** `packages/blocks/src/lib/components/Calendar/CalendarDayView.svelte:53`
  + `CalendarAgendaView.svelte:82` — the `role="region"` + `tabindex={0}` +
  `onkeydown` container both views share.
- **What:** Three facets of the same shipped pattern, surfaced while gating the
  keyboard navigation (debt-fix-wave-3). (a) svelte-check flags
  `a11y_no_noninteractive_tabindex` + `a11y_no_noninteractive_element_interactions`
  on both roots (4 of the 6 pre-existing blocks warnings; the other two are
  `Slider.svelte:416` and `CalendarMiniMonth.svelte:153`
  `a11y_interactive_supports_focus`) — the focusable-named-region pattern is
  deliberate, but the warnings want a deliberate verdict (suppress with
  `svelte-ignore` + comment, re-role, or restructure). (b) A **disabled**
  calendar's region keeps `tabindex={0}`: keyboard is inert (gated), but the
  region stays in the tab order while the header buttons are native-disabled.
  (c) The keydown handler doesn't check `e.target`: arrow keys pressed inside
  interactive children (event-item buttons, a consumer `eventItem` snippet with
  an input) bubble to the region, navigate the month/day and `preventDefault`
  the caret movement — pre-existing, not introduced by the gate.
- **Why deferred:** All three want one deliberate pass over the region pattern
  (with SR/keyboard testing), not drive-by attribute tweaks during a bounds-gate
  sweep.
- **Found:** 2026-07-22, Calendar keyboard bounds-gating + its review
  (debt-fix-wave-3). The bounds-gate entry itself is resolved: day/agenda arrow
  keys are `canGoBack`/`canGoForward`-gated like the swipe paths since this wave.

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

### PlaygroundConfigurator: the i18n/slot pass left three smaller gaps — and `i18n:check` never scans `packages/docs` at all

- **Where:** `packages/docs/src/lib/components/PlaygroundConfigurator/PlaygroundConfigurator.svelte`
  (Tooltip `label="Style variant (tailwind-variants)"`, the modified-dot's
  `title`/`aria-label` strings in the controlCaption snippet, the literal
  `default` badge in the Select customItem snippet; plus the internal-only
  `styles.variantBadge()`/`modifiedDot()`/`colorInput()` calls), and root
  `package.json:100` (`i18n:check` scan roots).
- **What:** The 2026-07-22 pass (debt-fix-wave-3) woke `slotClasses.helpToggle`
  (all three call sites via `slot()`, actionsBar precedent) and localized the
  two logged strings (`resetAll`/`hints`/`hintsOn`, EN/DE). Left deliberately:
  (a) the further hardcoded English strings above — same class, outside the
  logged scope; (b) `variantBadge`/`modifiedDot`/`colorInput` are internal-only
  styles never declared in the public slotClasses union — exposing them as
  slots is an open design call, unlike the dead-but-declared helpToggle.
  (c) Root cause of the "0 findings" mystery: `i18n:check` scans only
  `packages/blocks/src` and `packages/table/src` — `packages/docs/src`,
  `packages/auth/src` and `apps/docs/src` all ship translations but are never
  audited (extending the script also needs their `--translations` paths).
- **Why deferred:** (a)+(b) want one coherent localization/slot pass over the
  file; (c) is a script-surface decision (which packages the gate should own)
  with a real runtime cost per added root.
- **Found:** 2026-07-22, PlaygroundConfigurator helpToggle/dt() pass
  (debt-fix-wave-3).

### Table persistence cannot distinguish "stored empty" from "absent" — cleared state re-seeds

- **Where:** `packages/table/src/lib/stores/concerns/usePersistence.svelte.ts`
  (every hydration guard: `value.length > 0`, `value.column`, truthy checks)
  on top of `createPersistentState`
  (`packages/blocks/src/lib/utils/persistent-state.svelte.ts`).
- **What:** Hydration treats a stored *empty* value (`[]`, `''`,
  `{ column: '' }`) exactly like "nothing stored" and skips it. Combined with
  the `initial*` seeds — now the whole family (`initialSort` / `initialFilters`
  / `initialSelectedIds`, debt-fix-wave-4; plus `initialGroupBy` /
  `initialSummaryConfigs`, moved into the same constructor seed 2026-07-23) —
  this reanimates cleared state: the user clears the sort (asc→desc→none),
  removes all filter chips, ungroups, clears every summary, or deselects
  everything → the sync writes the empty value to storage → on reload nothing
  hydrates, the seed guard sees an empty axis and applies the seed again.
  Documented honestly in the props' JSDoc, `TableSeedState` and the
  sveltekit-utils README caveat. "empty" is simply not a first-class persisted
  state anywhere in the table's persistence.
- **Why deferred:** The fix is a stored-empty-vs-absent distinction in the
  persistence layer (presence marker or envelope per axis) — it affects every
  axis, every guard, and every consumer's existing storage keys, so it wants
  its own design decision plus a migration story for already-persisted state.
- **Found:** 2026-07-23, adversarial review of the `initial*` seed work
  (debt-fix-wave-4).

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
- **Decision 2026-07-24:** ⏸ Hold — cosmetic, only the `fluid`+`showEndPoint`
  combo; act only if it shows up in practice.
- **Found:** 2026-07-14, Sparkline `fluid` review (primitives-debt wave).

### Toast/FileUpload loading spinners are pinned `text-primary`, ignoring the intent/status colour scheme

- **Where:** `packages/blocks/src/lib/primitives/Toast/Toaster.svelte` (loading
  icon slot) and `packages/blocks/src/lib/components/FileUpload/FileUpload.svelte`
  (uploading status icon).
- **What:** Both loading glyphs render brand-primary regardless of context: the
  toast's other intent icons follow `toast.intent` (the variants file even says
  "the intent signal comes through the icon color"), and FileUpload's sibling
  status icons are `text-success`/`text-danger` — but a loading toast with
  `intent: 'success'` still shows a primary spinner. Inherited, not designed:
  the old embedded public `Spinner` simply defaulted to `intent="primary"`, and
  the CoreSpinner conversion pinned `class="text-primary"` to keep the rendered
  default byte-identical (the default promise-toast intent is `neutral`, so
  dropping the pin would have visibly re-coloured it to `text-text-secondary`).
- **Why deferred:** Whether the loading spinner should follow the intent (like
  every other status glyph) or stay brand-primary (the common "busy = brand"
  look) is a design decision with a visible outcome, not a mechanical fix —
  the conversion's contract was render-identity. Once decided, the fix is
  deleting/replacing one class at each of the two call-sites.
- **Found:** 2026-07-23, core-extraction wave (public→public edge removal),
  while proving render-identity of the Toaster/FileUpload spinner conversion.

## Accessibility

### Off-system dark-skin SegmentGroup demo trips axe (restyle-vs-exempt)

- **Where:** the deliberately off-system dark-skin SegmentGroup demo under
  `apps/docs/src/routes/blocks/**/Docs.svelte`, held by two exceptions in
  `e2e/a11y-baseline.json`.
- **What:** The near-black brutalist demo renders its selected label `#17150f`
  on `#062f26` = **1.25:1** and its inactive label `#635f58` (the Rooms
  `--docs-soft`) on `#070c10` = **3.09:1** — both below the floor. It exists to
  show off-system (unstyled) customisation, so it hardcodes raw palette colours
  and axe scans it because it sits inside `[data-docs-preview]`.
- **Why deferred:** Restyle-vs-exempt call on the off-system demo: restyle it to
  clear AA while still looking off-system, or keep the two documented
  node-level exceptions. Not an on-system token defect.
- **Resolved in W1 (2026-07-24):** the token half of the original entry is done.
  `text-tertiary` (library) clears AA on every reading surface (measured 6–8:1);
  the on-system SegmentGroup inactive label was the Rooms `--docs-soft`, darkened
  `#6e6b64` → `#635f58` (4.18 → 4.99:1 on the warm-neutral track). And the entry's
  wished-for guard shipped: `style/contrast.test.ts` now covers informative text
  on every reading surface × mode × theme. Only this off-system demo remains.
- **Found:** 2026-07-14, C.1/C.7 pass; narrowed to the off-system demo in W1.

### The axe gate scans only the PRIMITIVES route list — non-primitive routes are unscanned

- **Where:** `e2e/a11y.spec.ts` iterates only the `PRIMITIVES` route list, so
  `table/*`, recipes, auth, customization and every other non-primitive route
  (including the live `/table/remote-data` demo, which carries a
  `[data-docs-preview]` region) are never axe-scanned.
- **What:** The route dimension of the former "playground + routes" gate gap.
  Each new route may surface real violations to fix or absorb, so widening the
  list is a bounded a11y sweep, not a one-line change.
- **Why deferred:** A gate-scope decision plus the per-route fix/absorb work it
  uncovers — its own pass, cut deliberately from W2.
- **Resolved in W2 (2026-07-24):** the playground half shipped —
  `a11y.spec.ts` now runs a `playground` pass over `[data-docs-stage="playground"]`
  on every page that has one (all clean; the specimen Combobox gained an
  `aria-label`). The dark-mode and VR-tolerance sibling entries also shipped in W2.
- **Found:** 2026-07-22, debt-fix-wave-3 review; narrowed to the route dimension in W2.

### Rooms skin pins `--color-primary` to the raw accent in both modes — dark-mode accent-as-foreground misses the floor

- **Where:** `apps/docs/src/lib/style/rooms-docs.css` — `--color-primary:
  var(--_a)` and `--color-interactive-focus: var(--_a)` (the raw room accent, in
  BOTH modes, unlike the library's mode-aware `light-dark(primary-600,
  primary-500)`). Consumed as a *foreground* by `SidebarNavigation.svelte`
  (active nav `text-primary`, the `before:bg-primary` active-marker) + focus rings.
- **What:** In dark mode the dark accent renders as foreground on the dark Rooms
  paper (`#232220`): green `#006c4a` = **2.46:1**, below the 3:1 UI floor. W1
  (green `#00845c` → `#006c4a`, for the light-mode on-fill AA) deepened it from
  3.37:1 (which just cleared the UI floor); the active nav-link **text** was
  already under AA (3.37 < 4.5) before W1. Light mode is fine — the dark accent
  is legible as foreground on cream and clears AA as a fill under cream text. The
  axe gate is light-only (see the dark-mode entry above), so nothing catches it.
- **Why deferred:** The fill role wants the accent *dark* (cream-on-fill AA); the
  foreground role wants it *light* (on dark paper). No single value satisfies both
  in dark mode — the same reason the library made `text-on-primary` mode-aware
  (2026-07-14). The real fix is that Material-3 split for the Rooms skin:
  mode-aware `--color-primary` (a lighter stop in dark) + mode-aware on-primary
  (ink in dark). That flips the Rooms dark-mode button look — "raw accent in both
  modes" is a deliberate skin decision — and wants a VR pass across the four
  rooms. Not a token tweak. Pairs with the dark-axe gate entry above (a dark
  Playwright project would catch this class).
- **Found:** 2026-07-24, W1 adversarial review (deepened by W1's green nudge).

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

### Toast's Customization section holds API-reference material ("Toaster Store API")

- **Where:** `apps/docs/src/routes/blocks/primitives/toast/Docs.svelte` — the
  "Toaster Store API" block inside the Customization section.
- **What:** The XC-6 taxonomy sweep (debt-fix-wave-4, 2026-07-23) moved all
  misfiled *usage* demos to Examples across 9 pages (the 8 logged ones plus
  pagination) and closed four ToC omissions (menu, drawer, popover, sidebar).
  Toast's remainder is a different class: store-API reference prose sitting
  under Customization — not a usage demo, so the sweep left it. It arguably
  belongs in the API section or its own section.
- **Why deferred:** Wants a per-page taxonomy call (and possibly a docs-gen
  section for imperative store APIs — Toast is not the only store-driven
  surface), not a mechanical move.
- **Found:** 2026-07-23, XC-6 taxonomy sweep (debt-fix-wave-4).

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
- **Decision 2026-07-24:** ⏸ Hold — wait for Kit's #15992 answer, then mirror
  `Sec-Fetch-Site`-first; don't diverge from upstream on the primary CSRF gate.
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
- **Decision 2026-07-24:** ⏸ Hold — status quo (`doubleSubmit:false`,
  documented); the `isRemoteRequest` skip is only half a fix (no-JS fallback
  still 403s) and touches security semantics.
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
- **Decision 2026-07-24:** ⏸ Hold — accepted trade-off; act only if Edge/Workers
  becomes a target.
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

### docs-gen `@see` extraction stores bare type names as `seeAlso`, which ApiReference can't link

- **Where:** `packages/docs-gen/src/core/extraction/PropsExtractor.ts` (~`:535`,
  raw `@see` tag text → `seeAlso`) surfacing in
  `packages/docs/src/lib/components/ApiReference/ApiReference.svelte`.
- **What:** The non-`http` `seeAlso` render drop is **resolved** (debt-fix-wave-5,
  2026-07-24): route-relative (`/…#…`) and fragment (`#…`) values now render as
  internal links wrapping the type code. But `@see` extraction blindly stores the
  raw tag text, so hand-written prose cross-refs like `@see HTMLButtonAttributes.value`
  (Button) / `@see CartesianDatum` (BarChart) land in `seeAlso` as bare dotted/type
  names — neither `http` nor `/`|`#`, so they now (correctly) fall through to the
  plain type-segment branch and render as text, i.e. the `@see` is silently ignored.
  One field is doing two jobs — "a link destination" and "a prose reference".
- **Why deferred:** The fix is a docs-gen design call — resolve bare type names to
  their doc anchors, or keep prose `@see` out of `seeAlso` (a separate field),
  cross-checked against the extractor. Not a render tweak.
- **Found:** 2026-07-24, debt-fix-wave-5 (ApiReference seeAlso fix). The
  `typeAnchor`/`typePreview` half of the original entry was closed in qa-polish-wave
  (`510a410`/`a9609c0`); the seeAlso render drop in this wave.

### The `@urbicon-ui/docs` package has no component / DOM test coverage

- **Where:** `packages/docs/src` — `vitest.config.ts` runs `environment: 'node'`
  only; every test targets plain `.ts` modules or `*.variants.ts` configs.
- **What:** All `.svelte` rendering logic in the docs package (ApiReference branch
  selection, TypesReference, DocsLayout, PlaygroundConfigurator, …) is untested —
  e.g. the debt-fix-wave-5 ApiReference `seeAlso` branch shipped with no mount
  test because there is no jsdom + `mount` harness in the package. The blocks
  package's DOM-test stack (jsdom docblock + native `mount` + `@testing-library/dom`)
  would need porting.
- **Why deferred:** Standing up DOM-test infra for a package (jsdom setup, mount
  harness, Table/Badge deps) is its own decision, not a drive-by while fixing one
  render branch.
- **Found:** 2026-07-24, debt-fix-wave-5 (ApiReference seeAlso fix).

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
- **Update 2026-07-24 (W2):** the suite's other blockers are cleared — fixtures
  are deterministic (`transition: none` killed the circular-Progress mount frame),
  the tolerance is calibrated and verified stable (`maxDiffPixelRatio: 0.002` +
  `threshold: 0.15`, two identical runs), and the darwin baselines are freshly
  re-generated and drift-free (12 unchanged shots proved the local env matches
  the baseline env). All that remains is generating the `-chromium-linux`
  baselines in the CI env itself — option (c), a one-off bootstrap job; a local
  Docker run is not trusted to match the GitHub-Actions font rendering
  byte-for-byte, which is the whole point of per-platform baselines.
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
- **Decision 2026-07-24:** ⏸ Hold — no consumer has hit the false-positive
  classes; revisit on demand (strict mode stays unbuilt).
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
- **Decision 2026-07-24:** ⏸ Hold — latent; no consumer uses lazy loading yet.
  Add the CI parity test when one does.
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

### `toSlug` mis-kebabs component names with consecutive capitals (`QRCode` → `qrcode`)

- **Where:** `packages/docs-gen/src/core/enrichment/APIDataGenerator.ts:412`
  (`toSlug`: `input.replace(/([a-z0-9])(\p{Lu})/gu, '$1-$2')…`).
- **What:** The kebab rule only inserts a hyphen at a lowercase/digit→uppercase
  boundary. A name with consecutive capitals has no such boundary inside the run,
  so `QRCode` slugifies to `qrcode` (not `qr-code`) — the route, `api.ts`,
  `_catalog.json` slug, `llm.txt` path and MCP-catalog entry all land under
  `qrcode`. Handled for QRCode by making the route + nav + `llm.txt` asset link
  match the tooling slug (`/blocks/components/qrcode`), but it is a latent trap
  for any future name with a capital run: `OTPInput` → `otpinput`, `APIKey` →
  `apikey`, `PDFViewer` → `pdfviewer`. Worse, docs-gen silently creates the
  `<slug>/api.ts` route dir from its own derivation, so a hand-authored
  `otp-input/+page.svelte` would import a `./api` that was written to
  `otpinput/api.ts` instead — a broken page with no error until check runs.
- **Why deferred:** The correct kebab also has to split `[A-Z]+` runs before a
  trailing capitalized word (`QRCode` → `qr-code`, but `IOStream` → `io-stream`,
  `HTTPSProxy` → `https-proxy`) — a deliberate slug-rule change that reslugs
  nothing today but would change URLs the moment such a component ships, so it
  wants one decision plus a redirect story if any existing slug moves. No such
  component exists yet besides QRCode (handled).
- **Found:** 2026-07-23, adding the QRCode component (component-trio wave).

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

### Popover inside phrasing content breaks SSR paragraphs (CitationChip in `<p>`)

- **Where:** `packages/blocks/src/lib/primitives/Popover/Popover.svelte`
  (trigger wrapper + panel are `<div>`s) as consumed by `CitationChip` inside
  `StreamingMarkdown` paragraphs (`MdBlock` renders `<p>` — phrasing content
  only).
- **What:** On SSR-prerendered pages that render citation chips in flowing
  text (e.g. `/blocks/components/chat-message`), the browser's HTML parser
  closes the `<p>` at the first `<div>`, so the prerendered DOM differs from
  the component tree until hydration repairs it (dev console:
  `node_invalid_placement_ssr`; prod: a brief structural flash). Client-side
  streamed chat is unaffected — chips mount after hydration.
- **Why deferred:** Not fixable locally in CitationChip: even span wrappers
  don't help while any descendant is a `<div>` (a `<div>` token closes an open
  `<p>` regardless of nesting), so the real fix is a Popover-level decision —
  a phrasing-safe rendering mode (span chain incl. panel content) or moving
  the panel out of the flow — with VR + floating.spec coverage across all
  Popover consumers (Menu, DatePicker, Calendar, CitationChip). Deserves its
  own small wave rather than an end-of-P3 quickfix.
- **Found:** 2026-07-23, AI-Kit P3 live check of the new chat-message docs
  page.

### A2UI catalog gap: Tabs not mapped (DateTimeInput shipped in v6.40.0)

- **Where:** `packages/blocks/src/lib/components/Chat/A2UIView/a2ui-registry.ts`
  (`UNSUPPORTED_A2UI_COMPONENTS`: Modal, Tabs, Video, AudioPlayer,
  DateTimeInput).
- **What:** ~~DateTimeInput~~ shipped in v6.40.0 (DatePicker/TimeInput mapping,
  spec-checked against a2ui-project/a2ui, adversarially reviewed). Remaining:
  Tabs would map onto Tab the same way ({ title, child } items, client-local
  selection state per the implementation guide). Modal/Video/AudioPlayer stay
  excluded deliberately (agent-driven overlays and media embeds are a
  UX/security decision, not a missing mapping).
- **Why deferred:** Each new mapping extends the untrusted-payload surface
  (registry spec + prompt text + A2UINode render path + never-throws render
  tests + value normalization for the data model), so it deserves its own
  small wave — and it overlaps with the planned Urbicon custom catalog
  (`docs/internal/A2UI-POC-BEFUNDE-2026-07.md` §4.2), which may supersede
  piecemeal basic-catalog additions.
- **Found:** 2026-07-24, first live chat-demo run (haircut booking form).
