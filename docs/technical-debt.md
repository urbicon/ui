# Technical Debt

Small, non-blocking findings surfaced in passing that don't belong to the task
at hand and can't be fixed on the fly — they need a design decision or a broader
sweep. Logged here so they aren't lost. Actively planned work lives in the
internal TODO instead. Sections are ordered roughly by urgency.

## Packaging / distribution

### mcp-server npm tarball ships raw src (incl. tests) with no consumer

- **Where:** `packages/mcp-server/package.json` (no `files` field, no
  `private`); `.github/workflows/release.yml` + `scripts/publish.sh` publish
  every `packages/*` to npm.
- **What:** Since the broken `bin` was dropped (`1a5f3ae`, 2026-07-13 — it
  pointed at the raw TS entry and never ran under node or bunx), the published
  artifact is raw `src/**` including `*.test.ts` and `src/eval/`, importable
  only under Bun (declared via `engines.bun`). Harmless but useless: no
  documented consumer path exists (Option B), and no other package depends on
  it.
- **Why deferred:** Launch-hygiene call for Felix alongside the hosting
  decision: either `private: true` (hosted-endpoint-only) or a `files` field
  that trims tests/eval from the tarball. Not urgent either way.
- **Found:** 2026-07-13, resolving the P1 "mcp-server distribution" TODO
  (supersedes the earlier "bin is not runnable under node/npx" entry).

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

### `ConfirmDialog` propagates a rejecting async `onConfirm` as an unhandled rejection

- **Where:** `packages/blocks/src/lib/primitives/ConfirmDialog/ConfirmDialog.svelte`
  (`handleConfirm`).
- **What:** `handleConfirm` is `try { busy = true; await onConfirm(); open = false; }
  finally { busy = false; }` — no `catch`. When a consumer's async `onConfirm`
  rejects (e.g. the server call it awaits fails), the observable behaviour is
  correct — the dialog stays open (the `open = false` after the await is skipped)
  and re-enables (busy cleared in `finally`) — but the rejection escapes
  `handleConfirm` and, because `onclick` fires it and ignores the returned
  promise, surfaces as an **unhandled promise rejection**. The JSDoc only
  promises "auto-closes on success", so staying open on failure is intended;
  the noisy rejection is the gap.
- **Why deferred:** The fix is an API-design decision, not a mechanical change:
  either (a) swallow the error silently (dialog just stays open), (b) add an
  `onError?` callback so the consumer can surface it, or (c) keep propagating but
  document that `onConfirm` must catch its own errors. Each changes the public
  contract. Today's guidance is (c) implicitly — a consumer should `try/catch`
  inside `onConfirm` and show their own error UI. Picking (a)/(b) wants a
  conscious call, so it is logged rather than patched on the fly.
- **Found:** 2026-07-07, while adding `ConfirmDialog.svelte.test.ts` (the
  success + busy-lock paths are covered; the reject path is deliberately not
  asserted because it can't be without provoking the unhandled rejection).

### `Collapsible` optimistically mutates a controlled `open` prop on toggle

- **Where:** `packages/blocks/src/lib/primitives/Collapsible/Collapsible.svelte`
  (`toggle`).
- **What:** When `open` is controlled (`open !== undefined`), `toggle` sets
  `open = next` locally *before* calling `onOpenChange(next)`. With `bind:open`
  this is what propagates the change, so it's correct. But a consumer that passes
  `open={someValue}` **without** `bind` and then conditionally *rejects* the
  change in `onOpenChange` gets a divergence: Collapsible shows `next` while the
  consumer's source of truth still says the old value, and nothing re-syncs it
  (the unchanged parent expression never re-runs). This is exactly the trap
  `AccordionItem` hit for `collapsible=false` on the last open item — now worked
  around by calling `ctx.toggle` from the trigger directly (Collapsible is driven
  purely by its `open` prop there), fixed 2026-07-07.
- **Why deferred:** A "pure controlled" Collapsible would have to skip the local
  mutation when `open` is passed but not bound — and Svelte can't distinguish
  `open={x}` from `bind:open={x}` at runtime. Resolving it is an API-design call
  (e.g. an explicit `controlled` flag, or documenting that controlled consumers
  must accept every `onOpenChange` or use `bind:open`), so it is logged rather
  than reworked. In practice the common paths (`bind:open`, or unconditional
  `onOpenChange` write-back) are unaffected.
- **Found:** 2026-07-07, while adding `Accordion.svelte.test.ts` (the
  `collapsible=false` last-item test surfaced the divergence).

## Component behaviour

### ButtonGroup roving couples `buttonOrder` to a positional DOM query — duplicate values and dynamic add/remove desync it

- **Where:** `packages/blocks/src/lib/primitives/ButtonGroup/ButtonGroup.svelte`
  (`buttonOrder` registry indexed positionally against `rovingRadios()`).
- **What:** The single-select roving (added 2026-07-13) maps the reactive
  selection back to a radio position by assuming `buttonOrder[i]` (values, in
  registration order, deduped) lines up with `rovingRadios()[i]`
  (`querySelectorAll('[role="radio"]')`, DOM order). The value-less case is
  fixed (value-less buttons no longer get `role="radio"`), but two edges
  remain: (a) two buttons with the **same** value — `buttonOrder` dedups, the
  DOM query does not, so the indices drift; (b) buttons **added/removed at
  runtime** — `buttonOrder` only ever grows (Button can't unregister), so it
  goes stale. Static, unique-value groups (the near-universal case) are correct.
- **Why deferred:** The robust fix for both is to stop indexing positionally —
  tag each radio with its value (`data-value`) and resolve by matching value —
  which touches the shared `Button.svelte` (`getButtonProps`), outside the
  primitives-Welle scope. Wants one deliberate pass with tests for both edges.
- **Found:** 2026-07-13, ButtonGroup roving review (primitives-Welle, adversarial reviewer).

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
  checkbox's `onchange`).
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

### `Dialog`/`Drawer` spread `{...restProps}` after their own dismiss/focus handlers — a consumer `onclick` can silently disable them

- **Where:** `packages/blocks/src/lib/primitives/Dialog/Dialog.svelte`
  (~`:235`–`:244`): the `<dialog>` sets `onclick={handleBackdropClick}`,
  `onkeydown={handleKeydown}`, `onclose` and THEN spreads `{...restProps}`;
  same ordering in `packages/blocks/src/lib/primitives/Drawer/Drawer.svelte`
  (~`:176`–`:184`, `onkeydown` + `onclose`).
- **What:** Because a later spread wins in Svelte, a consumer passing a DOM
  `onclick`/`onkeydown`/`onclose` through restProps silently overrides Dialog's
  backdrop-dismiss / focus-trap / close handlers. Now reachable transitively
  through `ConfirmDialog` too (it forwards `{...rest}` into the inner Dialog,
  `3d02feb`). Same class as the form-primitive restProps-ordering fix
  (`32cfddd`) but for the overlay family's behavioural handlers — higher-stakes,
  since it can break dismissal/focus-trap, not just an ARIA value.
- **Why deferred:** A fix — spread `restProps` FIRST on the `<dialog>` (as the
  form primitives now do), or pull the dismiss/focus/close handlers out of the
  clobberable set — is a deliberate contract change across the overlay family
  (Dialog/Drawer/ConfirmDialog), wanting DOM tests, not a drive-by.
- **Found:** 2026-07-14, ConfirmDialog attribute pass-through (Opus debt-sweep).

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

### date-grid: `navigate()` range-case + range-view swipe don't clamp to `minDate`/`maxDate`

- **Where:** `packages/blocks/src/lib/date/date-grid` — the `view === 'range'`
  branch of `navigate()` emits `onNavigate(shiftedStart, {shiftedStart,
  shiftedEnd})` directly (bypassing `#emitNavigate`) and unclamped; a
  range-view swipe (`CalendarGrid onSwipeLeft → ctx.navigate(1)`) is not gated
  by `canGoForward`.
- **What:** A range-view swipe can push the window past `[minDate, maxDate]`.
  Pre-existing (untouched by the 68c8c86 navigator-bounds hardening and the
  86db345 emit-path fix), deliberately unclamped — Planner window-shift
  semantics; naively clamping only `shiftedStart` would collapse the span.
- **Why deferred:** A span-preserving sliding-window clamp is non-trivial.
  Revisit when a range consumer actually hits the escape.
- **Found:** 2026-07-05, navigator-bounds follow-up (code-reviewer).

### Guide cross-route touring: two deliberate DEV-only edge cases

- **Where:** Guide engine navigation handling (details archived →
  `docs/archive/2026-07/CR-guide-cross-route-followups.md`, follow-ups to
  issue #41).
- **What:** (a) An async/re-entrant `navigationSource` can still prematurely
  stop a cross-route tour (latent false-stop; the sync/re-entrant case was
  fixed in #41). (b) `#knownPath` skips clearing a targetless
  `#expectedRoute` state. Both are DEV-only symptoms with no teardown in the
  default path.
- **Why deferred:** Both were consciously accepted trade-offs in the #41
  review ("noted for later — not blocking"). Revisit if a real consumer tour
  trips either.
- **Found:** 2026-06-30 / 2026-07-01, issue-#41 follow-up review.

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

### Combobox multi-select: no way to seed labels for pre-selected async values; orphan dev-warn re-fires per recompute

- **Where:** `packages/blocks/src/lib/primitives/Combobox/Combobox.svelte`
  (`selectedTags` `$derived.by`, `tagCache`) — and the same orphan-warn shape in
  `Select.svelte`'s `selectedOptions`.
- **What:** In `multiple` + `queryFn` mode a consumer that binds
  `value=['a']` on mount has no API to supply `'a'`'s label — `tagCache` is only
  written by `toggleValue` (a user pick), so a pre-bound value renders as its
  raw `String(value)` until a query happens to return it. The dev-warn is now
  suppressed in async mode to stop crying wolf (CMB-2 review), but the underlying
  gap — seeding labels for pre-selected async values — remains. Separately, in
  *sync* mode the orphan warn lives inside a `$derived.by` whose deps include the
  `options`/`allOptions` reference, so it re-fires on every parent re-render that
  passes a fresh `options` array (the common `options={items.map(...)}` idiom)
  rather than once per orphan value.
- **Why deferred:** The label-seed needs a deliberate API decision (accept a
  `ComboboxOption[]` seed / a `selectedOptions` prop / a cache-seed callback), and
  the warn-dedup is the identical pattern in Select — fixing one side alone
  reintroduces the Combobox/Select divergence the mirror avoids. Wants one pass
  across both (a warned-values `Set` for idempotency; a label-seed prop).
- **Found:** 2026-07-10, blocks feature-request review (CMB-2 multi-select).

### Combobox `queryFn` rejection surfaces no user-facing error state

- **Where:** `packages/blocks/src/lib/primitives/Combobox/Combobox.svelte` — the
  async effect's `.catch` (swallows non-abort rejections with a DEV-only warn).
- **What:** A genuine `queryFn` rejection (network/server error) leaves the
  previous `asyncOptions` in place with `loading` cleared and no error signal —
  the user sees stale results or the "no results" row with no indication the
  search failed. `AbortError` is correctly ignored; the gap is only the *real*
  failure path. Pre-existing (CMB-3), not introduced by CMB-2, but on-topic.
- **Why deferred:** Needs an API decision — an `onError` callback and/or an
  error-row slot (mirroring `loadingText`/`noResultsText`) — vs. the current
  accept-stale-on-failure behaviour. Not a drive-by; wants its own increment.
- **Found:** 2026-07-10, blocks feature-request review (CMB-2 multi-select).

### Popover auto-mode: `dismissedByTrigger` can stay stale after an aborted click

- **Where:** `packages/blocks/src/lib/primitives/Popover/Popover.svelte`
  (`handleTriggerPointerDown` arms the guard; `handleTriggerClick` consumes it).
- **What:** pointerdown on the open trigger arms the "this click already
  light-dismissed it" guard, but if the pointer is released elsewhere no click
  ever fires to consume it — the *next* trigger click is swallowed once.
  Pre-existing edge case; the 2026-07-13 fix scoped the guard to auto mode
  (manual mode was permanently broken) but did not add an un-arm path.
- **Why deferred:** Fix wants a design pass on the dismiss protocol (e.g. a
  document-level `pointerup` reset or consuming the flag on the native
  `toggle` event) — drive-by attempts risk re-breaking the anti-flicker
  behaviour the guard exists for.
- **Found:** 2026-07-13, DOM-test round 2 (Popover package).

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

### Pagination `showFirstLast` is a silent no-op when `showNumbers={false}`

- **Where:** `packages/blocks/src/lib/primitives/Pagination/Pagination.svelte`
  (default-layout First/Last gate on `showStartEllipsis`/`showEndEllipsis`) +
  `computeEllipsisState`.
- **What:** First/Last are shown only when their jump target sits outside the
  visible number window (an ellipsis is present) — a deliberate redundancy gate
  (settled during the 2026-07-14 edge-policy unification: they are redundancy-,
  not edge-gated). But `computeEllipsisState` returns `{showStart: false,
  showEnd: false}` whenever `showNumbers` is false, so a consumer pairing
  `showFirstLast` with `showNumbers={false}` (a compact prev/next-only bar) gets
  no First/Last buttons at all — silently. The JSDoc frames `showNumbers={false}`
  as a prev/next-only bar, so it is arguably consistent, but the silent
  inertness of an explicitly-set `showFirstLast` deserves a call.
- **Why deferred:** Wants a small design/doc decision (honour `showFirstLast`
  without numbers, or document it as intentionally coupled to the number window),
  not a drive-by change to the ellipsis gate.
- **Found:** 2026-07-14, Pagination edge-policy unification (primitives-debt wave).

## Accessibility

### `--color-text-on-primary` is unconditionally white — 125 of 126 dark-mode intent fills miss AA

- **Where:** `packages/blocks/src/lib/style/semantic.css:58`
  (`--color-text-on-primary: var(--color-neutral-0)`, no `light-dark()`) vs.
  the intent tokens one block below (`--color-<intent>:
  light-dark(<intent>-500/600, <intent>-400)`), which resolve to the
  *lighter* shades in dark mode; `-hover`/`-active` go lighter still.
- **What:** Filled controls keep white text while their fill brightens with
  the mode, so contrast collapses: measured over 6 themes × 7 intents × 2
  modes × 3 states, **125 of 126 dark-mode combinations sit under AA** (only
  `neutral/primary/dark/base` = 5.26 passes), bottoming out at **1.51:1** —
  pressing a dark-mode button makes its label *less* readable. Affects every
  filled Button/Badge/Alert/Tooltip/Stepper/Checkbox. Light mode is fine (all
  42 base pairs ≥ 4.56 after the two token nudges of 2026-07-14). Guarded
  from now on by `style/contrast.test.ts`, which asserts the shortfall as a
  predicate and so also goes red when a remedy lands.
- **Why deferred:** The remedy is known and verified — make
  `text-on-primary` mode-aware, the exact shape `--color-text-on-dark`
  (`light-dark(neutral-0, neutral-900)`) already uses one line above; it
  clears AA for 125/126 (4.76–6.62 base, hover/active *improve*, up to
  12.87). But it flips every filled control in dark mode to dark text — a
  very visible design change — and regresses the one passing combination
  (`neutral/primary/dark/base` 5.26 → 3.74), so it needs a companion change
  (neutral theme `primary-500` to L ≥ 0.58). The test proves no single
  lightness satisfies both on-colours for that mid-grey, i.e. mode-awareness
  is unavoidable rather than a matter of taste. Wants a deliberate call plus
  a VR pass, not a drive-by.
- **Related, same call:** `warning/light/active` measures 3.89–4.05 across
  all 6 themes. The warning ramp is deliberately inverted (the only intent
  with dark text), so its press state runs *toward* its foreground — a
  ramp-direction question, not a lightness nudge.
- **Found:** 2026-07-14, PUBLISH-READINESS D.1 contrast audit. The audit's
  own premise (`success-500` fails AA) was stale — it measures 5.68:1 today.

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
- **Found:** 2026-07-14, C.1/C.7 pass (reported) + independently confirmed by
  the orchestrator (own calculation: 4.18:1).

### PlaygroundConfigurator `label for` points nowhere in most control branches — and Input ignores its `id` prop

- **Where:** `packages/docs/src/lib/components/PlaygroundConfigurator/PlaygroundConfigurator.svelte`
  (`<label for={control.key}>` per control) vs. the ids the branches actually
  render; `packages/blocks/src/lib/primitives/Input/Input.svelte` (hardcodes
  `input-${propsId}`; a consumer `id` prop — or spread id — is overridden).
- **What:** Only the color branch's `for` resolves. Toggle renders
  `#{key}-input`, Select's focusable trigger is `#{key}-trigger`, SegmentGroup's
  radiogroup has no id, Slider thumbs have no ids (the id lands on the
  wrapper), and Input discards the `id` it is given entirely — that last one is
  a genuine blocks bug affecting any consumer pairing an external `<label for>`
  with an Input. Clicking a configurator label therefore focuses nothing.
- **Why deferred:** Needs per-branch `for` targets in the configurator plus an
  Input fix to honour a supplied `id` (two-step `$props.id()` pattern per the
  repo convention) — one coherent pass with DOM assertions, found at the tail
  of the XC-5/hint pass (`d3a40c6`), which deliberately stayed scoped to
  describedby.
- **Found:** 2026-07-13, PlaygroundConfigurator hint-wiring verification.

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

## Auth — accepted trade-offs

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

### docs-gen emits `typeAnchor`/`typePreview` that nothing reads

- **Where:** `packages/docs-gen/src/**` (`APIDataGenerator`, ~`:322-346`) —
  the emitted fields, whose comment references a `TypeCell` component that no
  longer exists; plus `ApiReference.svelte` silently dropping non-`http`
  `seeAlso` values.
- **What:** Both fields land in every generated `api.ts` and are never read.
  The type-link tokenizer added 2026-07-14 supersedes them and is strictly
  better (it resolves nested cases like `ToasterSlots` inside
  `Partial<Record<…>>`, which `getBaseType` misses).
- **Why deferred:** Removing generator output touches the docs-gen pipeline
  and its fixtures — its own small sweep, and docs-gen had two other sessions
  in flight on 2026-07-14. Candidate for deletion, not preservation.
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

### No guard against silently dropped `.d.ts` files in package builds

- **Where:** every package built with `svelte-package` (`blocks`, `docs`, …);
  concretely bitten in `packages/docs/dist/**` (all nine `*.variants.d.ts`
  missing).
- **What:** When TypeScript's declaration emit fails for a file (here: TS2883,
  `tv()`'s return type not nameable because `TVConfig` wasn't exported from
  `@urbicon-ui/blocks` — fixed 2026-07-09), `svelte-package` exits 0 and simply
  omits that file's `.d.ts`. Consumers then degrade silently: every
  `*Props extends …VariantProps` loses ALL variant props — that buried the
  docs-app check gate under 274 phantom errors until the root cause was found.
  A published release with this state would break consumers' type-checking.
- **Why deferred:** The root cause is fixed, but nothing prevents a recurrence
  (any new non-portable inferred type re-triggers it, silently). A durable
  guard is a small build-gate script — e.g. after `build`, assert every
  emitted `dist/**/*.js` (excluding tests) has a sibling `.d.ts` — wired into
  CI/publish. That is its own small package (script + CI wiring across all
  packages), not part of the docs-layout task.
- **Found:** 2026-07-09, while gating the docs-layout redesign (docs-app check).

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

### The e2e a11y gate is red — 14 of 33 pages fail `color-contrast`, and CI can't tell

- **Where:** `e2e/a11y.spec.ts` + `e2e/a11y-baseline.json` (`{}` since the
  initial commit); `.github/workflows/ci.yml` runs the whole suite via
  `bunx playwright test` with no `continue-on-error`.
- **What:** A local run (chromium, this worktree, 2026-07-14) is **14 failed /
  19 passed** — every failure `color-contrast (serious)`, e.g. 15 nodes on
  `/blocks/primitives/segment-group`. The causes are pre-existing and
  independent of any current work: the deliberately off-system demos hardcode
  raw palette colours (`text-orange-950/80` etc., untouched since the initial
  commit), and `text-tertiary` sits at 4.18:1 (see the Accessibility entry).
  Since the baseline is empty, every one of these counts as a "new violation".
  The gate therefore fails permanently — which means it can no longer report a
  *real* regression: a genuinely new violation would be indistinguishable from
  the standing red. Together with the darwin-only snapshot problem below, the
  whole e2e stage is effectively inert.
- **Why deferred:** Making it green is not a test-harness tweak but the sum of
  two design calls — what to do about the off-system demos, and whether to
  darken `text-tertiary` (both in the Accessibility entry) — plus a decision on
  what the baseline is *for*: a real baseline that absorbs today's known,
  accepted violations would restore the signal immediately, but only once the
  accepted set is deliberately chosen rather than snapshotted.
- **Found:** 2026-07-14, publish-m3 wave (reported by the C.1/C.7 agent as
  "red, not mine"; the orchestrator confirmed the run and traced every failure
  to pre-existing sources).

### e2e axe harness never exercises the docs code panel

- **Where:** `e2e/a11y.spec.ts` — `AxeBuilder.include('[data-docs-preview]')`
  scopes every scan to the live-preview region only.
- **What:** The read-only code textbox and the Shiki syntax tokens sit outside
  `[data-docs-preview]`, so the harness never scanned them — which is why the
  CodePanel `aria-input-field-name` + comment-contrast failures (`572b738`)
  went uncaught, and why the remaining punctuation-contrast gap is unguarded.
  The a11y baseline is `{}`.
- **Why deferred:** Guarding these wants a second axe pass that includes the
  code panel (or drops the `.include` scope on select routes) plus a fresh
  baseline — an e2e-harness change, not a page edit.
- **Found:** 2026-07-14, CodePanel a11y pass (Opus debt-sweep).

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

### docs `codeExamplePlugin` regex breaks on `>` inside a code template literal

- **Where:** `packages/docs/src/lib/utils/code-example-plugin.ts:28`
  (`<CodeExample([^>]*)>`).
- **What:** When a `code={`…`}` template literal contains a literal `>` and an
  `isolate` example follows in the same file, the regex terminates the match
  early and the later example's build-time code extraction silently fails
  (empty code panel). Currently latent — existing pages only have such
  literals at file end; the button-group rework placed its preset example
  defensively last for this reason.
- **Second facet (2026-07-13, guide-demos pass):** a self-closing
  `<CodeExample code={…} />` has no `</CodeExample>`, so the non-greedy match
  runs to the *next* example's closing tag and eats it — that example loses
  its auto-extraction and renders the fallback InfoCard. This one was **live**,
  not latent: the guide page's waiting-hint demo was silently broken until
  `ac4b4e3` gave the setup example an explicit closing tag (workaround
  documented inline). Other pages pairing a self-closing code example with a
  following `isolate` example may be silently affected — worth a sweep when
  fixing.
- **Why deferred:** Proper fix is a quote-/self-closing-aware bracket scan (or
  extraction via the Svelte parser) plus a fail-loud warning when extraction
  finds no code — worth doing together with a small regression fixture.
- **Found:** 2026-07-13, button-group docs rework; second facet same day,
  guide narrative-demos pass.

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

### Calendar current-time indicator uses `red-500` instead of a semantic token

- **Where:** `packages/blocks/src/lib/components/Calendar/calendar.variants.ts`
  (`currentTimeLine` slot → `border-red-500`) and
  `packages/blocks/src/lib/components/Calendar/CalendarTimeGrid.svelte`
  (`bg-red-500`).
- **What:** The "now" line/marker in the time-grid view is a primitive Tailwind
  colour, against the repo maxim "semantic design tokens over primitive Tailwind
  classes". It is also the one calendar affordance that isn't `light-dark()`-aware
  (red-500 does read acceptably in both themes, so this is cosmetic, not a bug).
- **Why deferred:** A red "now" line is a real convention (Google Calendar et al.),
  and no existing semantic token fits — `--color-danger` is semantically wrong (it
  is not an error state). Resolving it is a design decision, not a mechanical
  swap: either introduce a dedicated token (e.g. a generic "live/now" accent that
  themes correctly) or consciously document red as an intentional exception.
- **Found:** 2026-07-07, while adding `calendar.variants.test.ts`.
