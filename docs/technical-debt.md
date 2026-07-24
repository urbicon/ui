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
  a11y surface (id wiring, `aria-describedby`). **Its stated blocker is gone**
  (W5, 2026-07-24): PinInput and TimeInput are now in the VR fixture and the
  dark-axe matrix, so a markup extraction can be proven pixel-identical the way
  the style extraction was. What remains is the extraction itself.
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
  audience — they used to ingest "No matching properties" as the authoritative
  API on 81 pages. The verdict rests on the Option B judgement that the `urbicon`
  CLI is the primary consumer surface and the docs site secondary; if that
  judgement is wrong, so is the deferral.
- **Cheap middle path — shipped for ApiReference (W7, 2026-07-24):** the
  affirmative *falsehood* is closed. `ApiReference.svelte` now keys `noDataText`
  on a local `hydrated` flag, so the prerendered/crawler artifact reads "Loading
  properties…" (props are on their way in) instead of the false "No matching
  properties"; post-hydration it reverts to the correct filter-empty copy. One
  prop, no store touched. This does NOT fix the underlying $effect-ingestion —
  the prerendered table body is still empty (no prop rows), the deep fix below
  (SSR-seed the Table) is unchanged, and the two other surfaces (CodePanel,
  PlaygroundConfigurator) still carry placeholders.
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

### Table filter operators: three residual sharp edges around dates and empty values

- **Where:** `packages/table/src/lib/stores/concerns/useFiltering.svelte.ts`
  (the `equals` branch + the numeric path of `greaterThan`/`lessThan`) and
  `packages/table/src/lib/features/SmartFilterBar/FilterMenu.svelte:~99`
  (`selectedOperator: 'contains'` default) vs. `:43-60` (`OPERATORS_BY_TYPE`).
- **What:** Three neighbours of the date-comparator fix (W4, 2026-07-24), each
  deliberately out of its scope. (a) `equals` — which the UI labels "on date"
  for `dataType: 'date'` columns — compares lowercased strings, so it only ever
  matches columns whose accessor returns the exact `YYYY-MM-DD` string; a `Date`
  instance or a timestamped ISO string never matches. (b) An empty/blank filter
  value on a numeric column stays on the numeric path (`Number('') === 0`), so
  `greaterThan ''` silently means "> 0" instead of being inert — reachable via
  `initialFilters`, restored persistence or programmatic `addFilter` (the menu
  itself guards on `.trim()`). The date path returns `false` for empty values,
  so the two paths now disagree. (c) The menu seeds every column's operator with
  `contains`, which `number`/`date` columns don't even offer — pick a date, press
  Enter without touching the operator select, and you get a substring match.
- **Why deferred:** (a) would make the generic text operator type-aware, which
  changes string behaviour for every column — wants its own decision (dedicated
  `onDate` operator vs. day-bucket equality gated on `dataType`). (b) is
  pre-existing numeric semantics that the fix deliberately kept
  backward-compatible; changing it is a call about seeded/restored filters.
  (c) is a UI default in a different file, plus a `Select` question (bound value
  outside the option list).
- **Found:** 2026-07-24, W4 date-filter fix.

### Table keyboard row navigation is dead inside groups

- **Where:** `packages/table/src/lib/core/TableDesktop.svelte:124`
  (`querySelectorAll('tbody tr[data-row-index]')`) vs.
  `packages/table/src/lib/core/GroupedRow.svelte` (its item rows carry neither
  `data-row-index` nor `tabindex`, unlike `TableRow.svelte:126`).
- **What:** The roving-tabindex navigation (arrows, Home/End, PageUp/PageDown,
  `Space` to select, `Enter` to expand) only ever sees flat rows. In a grouped
  table the row collection is empty, so the whole keyboard path is inert —
  a keyboard user can still reach the checkboxes via Tab, but not navigate or
  select rows. Pre-existing; surfaced while wiring row-click selection (W4),
  which gave the mouse a path the keyboard still lacks in groups.
- **Why deferred:** Making grouped rows part of the roving sequence means one
  index space across group headers and item rows (are collapsed groups skipped?
  is the group header itself a stop?), plus the aria-rowindex bookkeeping —
  an a11y design pass with SR testing, not an attribute addition.
- **Found:** 2026-07-24, W4 row-click selection.

### Mobile renders the `emptyState` snippet — which is table-row markup — inside a `<div>` card list

- **Where:** `packages/table/src/lib/core/TableMobile.svelte` (the `emptyState`
  branch) vs. its documented shape (`apps/docs/src/routes/table/customization/+page.svelte`,
  where the example snippet is `<tr><td colspan="99">…`).
- **What:** The same `emptyState` snippet feeds the desktop `<tbody>` and the
  mobile card container. Consumers write row markup (as the docs example does),
  so on mobile a `<tr>`/`<td>` lands inside a `<div>` — the parser drops the
  tags and the content renders unstyled at best. W4 dodged the trap for the new
  loading/error states (mobile renders plain text for those, commented at the
  site) but left the pre-existing `emptyState` path as is.
- **Why deferred:** The fix is an API decision: either a second snippet for the
  card list (`emptyStateMobile`), or a documented "must be phrasing content"
  contract with a wrapper on the desktop side — both change the public snippet
  surface, and neither is a drive-by while shipping the state props.
- **Found:** 2026-07-24, W4 mobile loading/error states.

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

### `createPersistentState` has no migration or GC path, and Input builds it inside an `$effect`

- **Where:** `packages/blocks/src/lib/utils/persistent-state.svelte.ts:~71`
  (`urbicon_${key}_v${version}`) and
  `packages/blocks/src/lib/primitives/Input/Input.svelte:~59-90`.
- **What:** Two neighbours of the stored-empty fix (W4, 2026-07-24). (a) The
  `version` only namespaces the key: a bump orphans the old entry silently, with
  neither read-across nor cleanup, so it stays in the user's `localStorage`
  forever. That matters now — the honest fallback for pre-fix consumers whose
  storage holds mount-written defaults would be exactly such a key bump.
  (b) `Input` constructs the persistent state *inside* an `$effect`, so every
  change of `persistKey`/`persistNamespace`/`persistStorage`/`persistVersion`
  creates a new instance (with its own inner effect) and never tears the old one
  down; its hydration also guesses via truthiness (`value` falsy → write), which
  the new `hasStoredValue` could now answer exactly.
- **Why deferred:** (a) needs a migration/GC strategy across all consumers
  (table's 8 axes + Input) plus a call on read-old-versions vs. delete.
  (b) turns on Input semantics — should a stored empty string override a
  consumer-provided default value? — an API decision of its own.
- **Found:** 2026-07-24, W4 persistence work.

### `TableContext` exposes the whole store surface as public API

- **Where:** `packages/table/src/lib/core/table/index.ts` (`export type
  TableContext = ReturnType<typeof createTableState>`), re-exported from the
  package root; same object `getTableContext()` returns.
- **What:** Naming the context type for `onReady` (W4) made the store's entire
  inside part of the published contract — `setColumns`, `setItems`,
  `showAllColumns`, `initColumnOrder`, `resetFocus`, `setServerResult/-Error`,
  `clearAllPersistentData` and everything else. Any restructuring of the store
  is now a breaking change, although only a handful of members
  (`state`, the push/apply family, the documented getters) are meant for
  consumers. The exposure predates the type alias — `getTableContext()` already
  returned the same object — but the alias makes it explicit and easy to depend on.
- **Why deferred:** The fix is a hand-written, narrow `TableContext` interface
  that `createTableState` is typed against, which means deciding member by
  member what is public — and checking the in-tree consumers (SmartFilterBar,
  HeaderMenu, cells) that legitimately use the wider surface from *inside*.
- **Found:** 2026-07-24, W4 adversarial review.

### Persistence: three residual limits after the stored-empty fix

- **Where:** `packages/blocks/src/lib/utils/persistent-state.svelte.ts` (debounce
  + `touched` write rule) and `packages/table/src/lib/stores/concerns/usePersistence.svelte.ts`.
- **What:** (a) **Legacy entries.** Consumers who ran a persisted table *before*
  the fix have empty defaults in `localStorage` from the old mount-write. If an
  `initial*` seed is added afterwards, that stale entry reads as "the user
  cleared this" and suppresses the seed until the user sets the axis once or
  calls `clearAllPersistentData()`. (b) **Debounce window.** Setting an axis and
  clearing it again inside one debounce window, before anything was ever stored,
  leaves no entry — the intermediate state never reached storage. Consumers can
  widen that window via `persistenceConfig.debounceMs`. (c) **SSR divergence.**
  `hasStoredValue` is always false without storage, so a client hydrating a
  stored-*empty* axis now differs from the server-rendered seeded one, where it
  previously matched (same class as the pre-existing stored-non-empty case).
- **Why deferred:** (a) is only fixable with a storage key bump plus the
  migration/GC story the key scheme does not have (see the entry above).
  (b) is inherent to debouncing. (c) is the general SSR/persistence tension —
  it wants the documented answer for all axes at once, not a per-case patch.
- **Found:** 2026-07-24, W4 persistence review.

### Table persists a *controlled* `searchTerm`, unlike controlled selection

- **Where:** `packages/table/src/lib/stores/concerns/usePersistence.svelte.ts`
  (`syncSearch`) vs. `syncSelection`, which checks `state.selectionControlled`;
  driven by `TableProvider.svelte`'s controlled-search effect.
- **What:** With a controlled `searchTerm` prop every keystroke is still
  mirrored into storage, although the prop is the source of truth. Switching
  that table back to uncontrolled later revives the old term — the exact bug
  class `selectionControlled` already prevents for selection.
- **Why deferred:** Wants a `searchControlled` flag in `TableState` mirroring
  the selection one, plus a test — small, but a behaviour change of its own
  outside the stored-empty scope.
- **Found:** 2026-07-24, W4 persistence work.

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

### docs-app `lang`: the ⌘K command palette is the one bilingual chrome surface still inheriting `lang="en"`

- **Where:** `apps/docs/src/lib/CommandSearch.svelte` → `<CommandPalette>`
  (`packages/blocks/.../CommandPalette/CommandPalette.svelte`).
- **What:** W3 (2026-07-24) settled the O1 a11y facet — every switchable chrome
  subtree now carries its own `lang` following the active locale, content stays
  `en`: the skip-link + all four sidebar snippets in `+layout.svelte`,
  `PrevNextNav.svelte`'s reading `<nav>`, and the `dt`-sourced kicker spans in
  `TableOfContents.svelte` (the TOC's nav-link labels are English section titles,
  so only the kickers are tagged, never the whole aside). The lone remainder is
  the ⌘K palette: its placeholder (`chrome.searchPlaceholder`) and the "Pages"
  category kicker (`chrome.pages`) localize, but it renders in a native
  `<dialog>` under the layout root and inherits `lang="en"`. It is a *mixed*
  surface — the dominant, persistent content is English page-title results
  (correctly `en`); only those two transient affordance strings are mislabelled
  when the chrome is German.
- **Why deferred:** A wholesale `lang` wrapper would mislabel the English result
  titles (the TOC lesson), so the correct fix is per-affordance: `lang` on the
  palette's `<input>` placeholder host and the category kicker — which needs
  `CommandPalette` (a published blocks component) to accept/forward `lang`, a
  cross-package API decision, not a docs-app drive-by. Low value: a transient
  overlay, two words.
- **Found:** 2026-07-24, W3 docs-lang adversarial review (narrowed from the
  original "docs-app hardcodes lang=en" entry, 2026-07-14; the three enumerated
  chrome surfaces are resolved).

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

## Testing / CI gates

### docs-gen strictness: the barrier only fails on *collected* errors — discovery partial-failures aren't collected, and there's no orchestrator-level test

- **Where:** `packages/docs-gen/src/core/pipeline/PipelineOrchestrator.ts`
  (`discoveryPhase` per-package `catch`) + the absence of a
  `PipelineOrchestrator.execute()` test.
- **What:** The original coupling — `failFast: !parallel.enabled`, so enabling
  parallelism silently downgraded errors to exit 0 — is **fixed** (W7,
  2026-07-24): `failFast` is decoupled from parallelism and a barrier after all
  phases fails the run on any collected error (`totalErrors > 0` →
  `createErrorResult` → `success:false`), in both modes; `maxErrors` still caps
  runaway accumulation. Two residual strictness bounds remain: (a) `discoveryPhase`
  catches a per-package `findComponents` failure, `console.error`s it and
  *continues* without `errorHandler.reportError`, so a **partial** discovery
  failure (one package fails, others succeed) is never collected → the barrier
  doesn't trip and the run succeeds with that package's components missing (a
  *total* discovery failure is still caught by the `manifests.length === 0`
  guard). (b) The barrier itself has no regression test — `ErrorHandler.test.ts`
  covers the `failFast`/`maxErrors` primitives but not the orchestrator control
  flow.
- **Why deferred:** (a) is a deliberate "continue with other packages" (commented
  as such) — making a partial discovery failure fail the whole run is a strictness
  *decision*, not a drive-by. (b) wants a mockable phase seam the orchestrator
  doesn't currently expose (phases use dynamic imports of concrete classes).
- **Found:** 2026-07-24, W7 failFast-decoupling adversarial review (narrowed from
  the original "failFast coupled to parallelism" entry, 2026-07-14; the coupling
  is resolved).


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
- **Update 2026-07-24 (W4/W6 full-suite run):** the tightened tolerance was
  applied globally but only `visual-regression.spec` was re-baselined, so the
  two older visual specs now fail on darwin as well: **13 shots** (7 in
  `floating.spec.ts`, 6 in `guide.spec.ts`) are red, each at a measured diff
  ratio of **exactly 0.01** — the previous threshold, which had been waving
  them through. Their baselines date from the initial commit and have never
  been generated under the current tolerance (or the current Playwright browser
  build: the config sets no `channel`, so a plain run uses `headless_shell`,
  whose ~1px font rendering is the documented caveat above). The rest of the
  suite is green (116 passed), including all table specs. Deliberately not
  re-baselined in passing: doing it from a headless_shell run would bake the
  wrong renderer into the baselines and break them for everyone else. Whoever
  picks this up should re-generate both specs from a full `channel: 'chromium'`
  run and verify the diffs are renderer drift, not content.
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
- **Why deferred:** Upstream prettier-plugin-svelte behaviour. The **repo
  convention** half is done (W7, 2026-07-24): `docs/DocsPageGuide.md` now
  documents "never put a code snippet in a single-quoted attribute — use a
  template-literal `code={`…`}` or `isolate`", which every page already follows.
  Only the upstream contribution remains: a minimal standalone repro + a
  `prettier-plugin-svelte` issue.
- **Found:** 2026-07-13, docs-package section polish; convention documented in W7.

## docs-gen

### `@see` on a *type* is still swallowed, and a mid-sentence `@see` becomes a real tag

- **Where:** `packages/docs-gen/src/extractors/typescript/LocalTypesExtractor.ts`
  (~`:151`/`:295`/`:313`, `documentation = extractJSDocComment(decl)`), surfacing
  in `packages/docs/src/lib/components/TypesReference/TypesReference.svelte`.
- **What:** W6 split prop-level `@see` into link targets (`seeAlso`) and prose
  refs (`seeAlsoRefs`) — but only on the **prop** side. A `@see` on a *type*
  declaration is still dropped: `BarChartDatum`'s `@see CartesianDatum`
  (`packages/blocks/src/lib/components/BarChart/index.ts:9`) reaches
  `bar-chart/api.ts` with the tag gone. Second facet, found while building the
  fixtures: TypeScript parses **any** `@see` as a `JSDocSeeTag`, including one
  written mid-sentence in a description — such a description would silently grow
  a reference chip. No prop description does that today (verified: three
  prop-level `@see`, all deliberate).
- **Why deferred:** The type side needs its own `seeAlsoRefs` counterpart:
  `TypeDefinition` + three extractor call sites + the emitted interface + the
  docs `TypeEntry` + two render sites. One real occurrence, and it loses nothing
  visible (that alias' definition literally *is* the referenced type). The
  mid-sentence trap wants a JSDoc lint, not a fix.
- **Found:** 2026-07-24, W6 `@see` split.

### The slug rule lives in two hand-synced copies

- **Where:** `packages/docs-gen/src/utils/slug.ts` vs.
  `packages/mcp-server/src/tools/get-component.ts` (~`:41`).
- **What:** W6 consolidated four drifted `toSlug` copies inside docs-gen into
  one module — but mcp-server deliberately has no dependency on docs-gen (thin
  remote adapter), so its own copy was merely *aligned*, tied to the original by
  a comment. That is exactly how the four docs-gen copies drifted apart in the
  first place.
- **Why deferred:** The right home is `@urbicon-ui/shared-types`, which both
  already depend on — but that package is types-only today (zero runtime
  exports, `sideEffects: false`), so adding a runtime function is a
  package-shape decision.
- **Found:** 2026-07-24, W6 slug consolidation.

### docs-gen's vitest never runs `src/**/*.test.ts`

- **Where:** `packages/docs-gen/vitest.config.ts` (`include: ['tests/**/*.test.ts']`).
- **What:** Two suites next to their sources — `src/generators/content/icons.test.ts`
  and `src/generators/llm/LLMDocumentationGenerator.test.ts` — are silently never
  executed; the package's reported test count contains none of them.
- **Why deferred:** Widening `include` may surface real failures in code that
  has not been exercised for months, and both files may be superseded by
  same-named suites under `tests/` — triage, not a config tweak.
- **Found:** 2026-07-24, W6.

### What the docs-gen prune deliberately left standing

- **Where:** `packages/docs-gen/src/types/configuration.ts`
  (`LLMOptimizationConfig`, `APIOptimizationConfig.compress`/`splitByPackage`/
  `generateIndex`, `DebugOutputConfig`, `MigrationConfig`, `CustomParserConfig`,
  `VariantsExtractionConfig.includeComputed`/`customParsers`,
  `MetadataEnrichmentConfig.addTags`/`autoTierAssignment`, `SchemaConfig.strict`/
  `allowUnknownSections`, `ComponentValidationConfig`);
  `packages/shared-types/src/component.ts` (`ComponentInfo.documentation`);
  `apps/docs/package.json` + `packages/docs/package.json` (`chokidar`);
  `packages/docs-gen/docs/*.mermaid`.
- **What:** Four leftovers around the W6 prune. (a) A second tier of
  declared-but-never-read config, same shape as the pruned one — two fields are
  even *written* as defaults by `VariantsExtractor` with no reader. (b) The
  inverse shape: `ComponentInfo.documentation` is *read* once (the pipeline's
  `componentsWithDocumentation` stat) but never written, so that number is
  structurally always 0. (c) `chokidar` is a devDependency of two packages with
  zero imports — residue of the same never-built watch loop whose config W6
  removed. (d) Both docs-gen architecture diagrams describe classes and types
  that no longer exist (`SectionMerger`, `DocumentationSectionRenderer`,
  `SveltePageGenerator`, the deleted `DocumentationSection` family).
- **Why deferred:** (a) pruning it further shrinks `EnrichmentConfig`/
  `ExtractionConfig` to near-empty shells — that is a decision about whether
  docs-gen keeps a configurable-pipeline contract at all. (b) means deciding
  whether to populate the field or drop a whole shared-types subpath. (c) touches
  `bun.lock`, which should not be rewritten mid-wave. (d) is a docs task of its
  own — they are the only architecture overview docs-gen has.
- **Found:** 2026-07-24, W6 prune.

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

### Disabled field labels sit at 2.3:1 in dark mode

- **Where:** `packages/blocks/src/lib/internal/field-chrome.ts`
  (`FIELD_LABEL_DISABLED = 'text-text-disabled'`), consumed by Input, Textarea,
  PinInput, TimeInput and (hand-written, same value) Select.
- **What:** A disabled field's label renders `#454f56` on `#070c10` = **2.34:1**
  in dark mode. WCAG 1.4.3 exempts inactive components, so this is not a
  violation — but it is the label, the one part that still has to say what the
  field *is*. The dark-axe gate only sees it on PinInput, because axe honours the
  exemption when a `<label for>` points at a disabled control and PinInput labels
  a `role="group"` via `aria-labelledby` instead; Input and Select pass the
  identical token in the identical state (exception recorded in
  `e2e/a11y-dark-baseline.json`).
- **Why deferred:** Choosing a legible disabled tone (e.g. the W1-hardened
  `text-text-tertiary`, or a new dedicated stop) is a design call across every
  field, and it moves VR baselines for input/select/pin-input/time-input — a
  contrast wave's work, not a validation wave's.
- **Found:** 2026-07-24, W5 (PinInput entering the dark-axe matrix).

### `surface-interactive` has no working hover partner

- **Where:** `packages/blocks/src/lib/style/semantic.css`
  (`--color-surface-interactive` vs `--color-surface-hover` / `-active`), used by
  `internal/field-chrome.ts` and the filled variants of Input, Textarea, Select,
  Combobox, plus Toggle's off track.
- **What:** `surface-interactive` resolves to the *same value* as `surface-hover`
  in light mode and as `surface-active` in dark — in the library default and
  under the Rooms skin. So the established idiom
  `bg-surface-interactive … hover:bg-surface-hover` is a **silent no-op in light
  mode** everywhere it appears: those filled fields have no hover feedback at all
  where most users see them. W5 worked around it for Toggle by using a border
  step instead of a fill step (commented at the site).
- **Why deferred:** The fix is a token-level decision — a dedicated
  `--color-surface-interactive-hover` stop (and its `-active` sibling), chosen
  against both modes and all six themes — not a per-component patch.
- **Found:** 2026-07-24, W5 interaction-vocabulary rollout.

### The press cue snaps wherever the shorthand `transition-colors` carries it

- **Where:** `packages/blocks/src/lib/primitives/Badge/badge.variants.ts`
  (`removeButton`), `packages/table/src/lib/variants/table.variants.ts`
  (`tableRowVariants.row`), `packages/table/src/lib/variants/table-cells.variants.ts`
  (`customCellVariants.container`).
- **What:** Same bug class W5 fixed for arbitrary transition lists, but expressed
  through the shorthand: `transition-colors` next to `active:scale-[0.98]` /
  `hover:-translate-y-0.5`. Those cues snap. The new variants-lint rule
  deliberately does not flag them — `transition-colors` is a *complete*
  statement ("only colours move"), so the linter cannot tell a deliberate snap
  from an oversight. Badge's `removeButton` is thereby inconsistent with
  Dialog/Drawer's `closeButton`, which are the same ghost-Button fold and do
  animate.
- **Why deferred:** Needs a design call first — is the press cue animated
  everywhere, or only where a component already opted into transform motion?
  Badge additionally carries a documented "byte-identical to the pre-extraction
  close button" contract that any change has to re-justify.
- **Found:** 2026-07-24, W5 transition-list sweep.

### Combobox's focus ring is twice as strong as every other field's

- **Where:** `packages/blocks/src/lib/primitives/Combobox/combobox.variants.ts`
  (`input` + `control` slots, `ring-primary/50`) vs. `fieldFocusRing` in
  `internal/field-chrome.ts` (`/20`), used by Input, Textarea, Select,
  PinInput, TimeInput.
- **What:** Surfaced by W5 giving Combobox the shared error frame: its invalid
  ring (`ring-danger/20`, from the shared fragment) is now *weaker* than its
  valid one (`ring-primary/50`, its own). Nothing is broken, but the field is
  the odd one out in both directions.
- **Why deferred:** Harmonising to `/20` is a visible change on every focused
  Combobox and wants a VR baseline refresh — a look decision, not a drive-by
  inside a validation wave.
- **Found:** 2026-07-24, W5 form-validation pass.

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

### `translations/en.ts` is one object, so three keys cost the whole table

- **Where:** `packages/blocks/src/lib/i18n/index.ts` (eager `{ en: enTranslations }`)
  + `packages/blocks/src/lib/translations/en.ts`.
- **What:** `useBlocksI18n()` pulls `createPackageI18n` **and** the complete
  English catalog, so a component that needs three strings pays for all of them.
  Measured on CodeBlock: +5.0 KB gz (6.8 → 11.9, +74% on a leaf) plus a 2.0 KB
  lazy `de` chunk — and StreamingMarkdown (+26%) / ReasoningDisclosure (+25%)
  inherit it just by embedding CodeBlock. CodeBlock therefore keeps plain English
  label defaults (`copyLabel` / `copiedLabel` / `copyFailedLabel`) while
  ChatMessage does use the translations, because it already carries the registry
  via Alert/Avatar/Button/Tooltip. That split is a bundle decision, not a
  considered API stance: two components in one family localise differently, and a
  consumer holding only `StreamingMarkdown` cannot reach the CodeBlock labels at
  all (no prop passthrough).
- **Why deferred:** The fix is an i18n-architecture change — split the catalog
  per area (`accessibility`, per-component groups) so a component imports only
  its slice, which touches `createPackageI18n`, the lazy-locale loader, `de.ts`,
  the `i18n:check` scanner and every package that registers a locale. It pays off
  across the whole library rather than for this one family, and it is larger than
  the chat wave that surfaced it.
- **Found:** 2026-07-25, chat-family redesign — the bundle-size gate caught the
  regression when CodeBlock was switched to the shared accessibility strings.
