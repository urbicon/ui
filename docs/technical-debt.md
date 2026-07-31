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
  without the LICENSE that the workflow's copy step and (since `1951eb75`)
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

- **Where:** `bundle-size.baseline.json` (the `Icon` entry) vs. the measured
  bundle; no icon-source change since the baseline commit `4153732e`.
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

### The date components default to `locale = 'de-DE'`, so an English app silently renders German months

- **Where:** `packages/blocks/src/lib/components/Calendar/Calendar.svelte:52`,
  `Planner/Planner.svelte:38`, `DatePicker`, `DateRangePicker` — and the
  helpers behind them, `packages/blocks/src/lib/date/format.ts`
  (`locale: string = 'de-DE'` on `formatWeekday`, `formatMonthYear`,
  `formatDateFull`, …).
- **What:** The default is a hard-coded German tag rather than the runtime
  locale (`undefined`, which makes `Intl` follow the environment) or the
  locale the app already declares through `<I18nProvider>`. A consumer running
  `<I18nProvider locale="en">` still gets "Juli 2026" from `Calendar` unless
  every date component is passed `locale` by hand — the i18n provider governs
  translated strings but has no connection to `Intl` formatting. Verified in
  the landing hero: an English-only page with an English provider rendered a
  German month until `locale` was threaded through explicitly.
- **Why deferred:** Changing the default is a behaviour change for existing
  consumers (a German app that relies on the default would start following the
  browser), and the better fix is bigger than a default swap: teaching the date
  components to read the i18n context, which couples `blocks` to the i18n
  package for a value it currently takes as a plain prop. Wants a decision on
  that coupling — the fallback chain (`prop → i18n context → runtime`) is the
  candidate.
- **Found:** 2026-07-27, landing hero prototype (forcing the hero to English).

### Table pagination can only be removed by passing an empty snippet

- **Where:** `packages/table/src/lib/core/table/Table.svelte` (~`:310`, the
  pagination block).
- **What:** Pagination renders whenever items exist and aren't grouped, even for
  a single page; suppressing it means passing an empty `pagination` snippet
  (`{#snippet pagination()}{/snippet}`) — a workaround that reads like a
  mistake. Hit while building the landing hero, which shows all 98 rows at once.
- **Why deferred:** It is a one-line condition (`totalPages > 1`) but changes
  layout for every existing consumer whose page reserves that footer height.
- **Resolved half:** the sibling gap — no way to mark a "current row" without
  `selectionMode` switching on the checkbox column — is **fixed (2026-07-27)**:
  `activeRowId` sets `aria-current` + `data-active` and its own quiet ground
  across flat rows, grouped rows and mobile cards. The hero's
  `tr:has([data-active])` CSS trick is gone.
- **Found:** 2026-07-26, landing hero prototype (`test-fixtures/landing-hero`).

### `--radius-commit` carries two meanings: the pill of a button and the circle of a radio

- **Where:** `style/foundation.css` (`--radius-commit: 9999px`) consumed by
  `primitives/RadioGroup/radioGroup.variants.ts` (`tier.commit` →
  `indicator: 'rounded-commit', dot: 'rounded-commit'`) and by every commit-tier
  button.
- **What happens:** a consumer who wants square buttons sets `--radius-commit: 0`
  — the comment at `foundation.css:178` explicitly invites the austere direction
  — and squares the radio indicators along with them. A square radio is a
  checkbox to the eye, so the "pick exactly one" affordance is gone. Shape is
  the only thing carrying that distinction; both controls are otherwise the same
  box with the same label.
- **Why it is not just styling:** the pill on a button is taste, the circle on a
  radio is convention with meaning (Material, HIG and Carbon all hold it). The
  tier bundles a decorative decision with a semantic one, and the token layer
  offers no way to take only the first.
- **Workaround in the wild:** `BlocksProvider` defaults —
  `RadioItem: { slotClasses: { indicator: 'rounded-full', dot: 'rounded-full' } }`.
  Shipped as `CIRCULAR_RADIOS` in `apps/docs/src/lib/livery/index.ts`,
  where **all four** brand liveries need it — including the one that merely
  softens the tier to `2px` instead of zeroing it, because 2px on a 20px control
  already reads as a square. The exemption was written into that livery on the
  assumption that a small radius was harmless, and the rendered form disproved
  it. So this is not a corner case for austere themes: *any* theme that touches
  the commit tier at all loses the radio affordance.
- **Possible fix:** give the radio indicator its own token (e.g.
  `--radius-control`, defaulting to `--radius-commit`) so a livery can square the
  buttons without touching the controls. Cheap, but it is a new public token —
  worth a deliberate decision rather than a drive-by.
- **Found:** 2026-07-27, while theming the A2UI salon demo across three liveries.

### ~~Field label/helper/error MARKUP is re-implemented per form component (part b)~~ — message extracted across all ten fields (2026-07-26/27), label divergence kept on purpose

- **Where:** the label/message scaffolding across the Form family — the entry
  first named `Input.svelte`, `PinInput.svelte` and `TimeInput.svelte` (label
  span + `aria-labelledby`, `role="alert"` message, required asterisk,
  `messageType` derivation); the message block turned out to be verbatim in
  Textarea, Select, Combobox, Checkbox, Toggle, RadioGroup and Slider too.
- **What:** Part (a) — the duplicated tv() **class strings** for the field frame
  — is **resolved** (debt-fix-wave-5, 2026-07-24): the shared frame/focus-ring/
  variant/intent/state/label fragments now live in
  `packages/blocks/src/lib/internal/field-chrome.ts` and are composed back into
  `input`/`pin-input`/`time-input.variants.ts`, byte-identical to the old inline
  strings (proven by a 47 872-combination resolved-class matrix diff, 0 diff).
  Deliberate per-component divergences stay inline in the variants (Input's
  `xs`/`underline`, PinInput's cell-height scale + `focus-visible:z-10`,
  TimeInput's `focus-within` + cursor-free readonly) and are commented at each
  site.
- **Resolved 2026-07-26 (the message):** the helper/error block — the part that
  really was copied three times — now lives in
  `internal/core/CoreFieldMessage.svelte`, alongside `CoreIconButton` and
  `CoreSpinner`. It owns the error-beats-helper precedence, `role="alert"` on
  the error arm only, and the id wiring; the call site keeps the look and passes
  its resolved `message` slot class, so the core runs no variant engine (the
  CoreIconButton contract). Proven unchanged by the 52 resting VR shots, which
  render all three fields in their `error` state — 141/141 e2e green, no shot
  moved — and the extracted rules gained the test they never had in any of the
  three components: the helper arm had **no** coverage anywhere, and
  "error beats helper" was implied by an `{:else if}` rather than asserted.
  6 tests, negatively verified (making the helper arm a live region and dropping
  the `else` fails exactly two of them).
- **Completed 2026-07-27 (the other seven copies):** the first cut followed this
  entry's "Where" list, which named three files. The same block was verbatim in
  seven more — Textarea, Select, Combobox, Checkbox, Toggle, RadioGroup, Slider
  — so most of the copies were outside the entry. All ten now render through the
  core. Two call sites keep something of their own, both recorded in the core's
  docblock: Combobox styles its helper through a `helper` slot of its own (new
  `helperClass` prop; without it the helper would read red on an invalid field),
  and Textarea keeps the empty `<span>` that holds its counter right in the
  `justify-between` footer. Proven markup-neutral by a canonical-DOM diff over
  110 renders (10 components × 11 label/helper/error/required/disabled/unstyled
  combinations), 0 diff, negatively verified twice — dropping `role="alert"`
  moves 80 lines, dropping Combobox's `helperClass` moves 3.
- **Deliberately NOT extracted — the label.** The entry lumped the label in with
  the message, but the two are not the same kind of duplication: the element is
  dictated by what the field is. Input, Textarea and Combobox render a real
  `<label for={fieldId}>` (exactly one focusable element); Select adds an `id` so
  its trigger button can also be named by `aria-labelledby`; PinInput, TimeInput
  and RadioGroup render a `<span id>` behind `aria-labelledby` on a
  `role="group"` (many focusable segments, no single field a `for` could point
  at); Checkbox and Toggle put the text inside the wrapping `<label>`; Slider's
  sits in a header row beside the value read-out. Five a11y shapes, so unifying
  them would be a regression, not a de-duplication. The `required` asterisk and
  the `messageType` derivation were already shared via `field-chrome.ts` (part a)
  and the variants.
- **Cost, measured:** in isolation the core costs each component 92–133 B gz
  (its own module is 0.5 KB min) — the per-component measurement shows it
  unshared, so the second form component on a page pays nothing. The baseline
  refresh also absorbs drift that was never recorded: +117…+129 B on
  Input/PinInput/TimeInput and on everything embedding them (NumberInput,
  CurrencyInput, PromptInput, DatePicker, LocaleSwitcher, A2UIView) from the
  2026-07-26 cut, plus −2…−7 B on ChatMessage/Stepper/Tab/FileUpload from the
  clipboard-state-machine commit.
- **Found:** 2026-07-24, component-trio review; part (a) closed same day
  (debt-fix-wave-5), part (b) closed 2026-07-26 and finished across the family
  2026-07-27.

## Component behaviour

### AvatarGroup's overlap eats the second initial

- **Where:** `packages/blocks/src/lib/components/AvatarGroup/` (the overlap is
  the `spacing` axis in `avatar-group.variants.ts`); visible on
  `/blocks/components/avatar-group` and in the landing's "Chairs today" card.
- **What:** Each avatar centres its initials, and the next avatar covers the
  right ~30% of it. With image avatars that is the intended stack; with
  initials it clips the second letter of every avatar but the last — "Io
  Nakamura" reads "II", "Ada Lovelace" reads "AI". The docs page shows it in
  its own default example, so the component demonstrates the defect.
- **Why deferred:** wants a design decision, not a patch. Options: shift the
  initials off-centre toward the visible half while overlapped (needs to know
  which side is covered, i.e. LTR/RTL-aware), fall back to one initial in a
  group, or reduce overlap when the content is text rather than an image. Each
  changes how every existing AvatarGroup looks.
- **Found:** 2026-07-30, landing polish (the stylist row in the Blocks tile).

### The table offers Sum/Avg/Min/Max based on the column's *name*, not its data

- **Where:** `packages/table/src/lib/features/SmartFilterBar/SummaryMenu.svelte:40-47`
  and `HeaderMenu.svelte:122-134` gate the offer on
  `/^(age|salary|price|amount|…)$/i` against the column id; the same regex
  exists a third time in `factories/TableColumns.ts:446-447`.
- **What:** A column called `price` is offered a sum even when its accessor
  yields `'$95'` — the menu promises an operation that cannot work on that
  data, and the result is a dash indistinguishable from "no rows". (The dash
  now at least warns in DEV — `utils/index.ts`, added 2026-07-30 — but the
  offer itself is still made on a name.) A numeric column called `throughput`
  gets no offer at all.
- **Why deferred:** sampling the actual values is the right check but changes
  which menus appear for existing consumers, and the triplicated regex should
  collapse to one exported helper in the same pass.
- **Found:** 2026-07-30, landing polish (`Σ –` on the bookings tile).

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
- **Found:** 2026-07-23, review of the mint tree-shaking commit (46fb7e0d).

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

### PlaygroundConfigurator: (a) + (c) closed 2026-07-30; the slot question (b) stays open

- **Where:** `packages/docs/src/lib/components/PlaygroundConfigurator/PlaygroundConfigurator.svelte`
  and root `package.json` (`i18n:check` scan roots).
- **(c) resolved — and the scope question got a measured answer, not a blanket
  "add every root".** `i18n:check` now also scans `packages/docs/src`. The other
  two candidates are deliberately out, each for its own reason:
  **`apps/docs/src` produced 6728 advisory findings** — the site's chrome is
  bilingual but its *content* is hardcoded English by decision (the open O1
  call), so adding it would bury the gate in noise it is not allowed to act on;
  **`packages/auth/src` cannot be scanned at all** — its bundles export
  `export const en = {…}` and the audit's loader accepts only an object *default*
  export, so both files fail to load (2 bundle errors, `FAIL`). See the entry
  below.
- **What the newly-scanned root found, and what was done with it:** 22 findings
  → 2. Eight hardcoded strings were localized and three components joined the
  translation system they were shipping keys for: `ApiReference` (all four column
  titles were hardcoded while `property`/`type`/`default`/`description` sat
  unused in both bundles — the columns are `$derived` now, so a language switch
  rebuilds them), `TypesReference` and `DocsLayout`. Eleven dead keys removed
  after checking the *consumer* too, not just the package (`apps/docs` calls none
  of them). The two remaining findings are one deliberately empty value
  (`playgroundSubtitle`, the default of an optional prop) now carrying a comment
  saying so.
- **(a) resolved with the same pass:** the modified-dot's `title`/`aria-label`,
  the variant Tooltip and the literal `default` badge are localized (EN/DE).
- **(b) still open:** `variantBadge`/`modifiedDot`/`colorInput` are internal-only
  styles never declared in the public slotClasses union — exposing them as slots
  is a design call, unlike the dead-but-declared helpToggle that was woken in
  2026-07-22.
- **Found:** 2026-07-22, PlaygroundConfigurator helpToggle/dt() pass
  (debt-fix-wave-3); (a)+(c) closed 2026-07-30.

### The i18n audit cannot read a bundle that exports its locale under a name

- **Where:** `packages/design/src/cli/commands/i18n.ts` (~`:180`, the bundle
  loader) vs. `packages/auth/src/lib/i18n/{en,de}.ts` (`export const en = {…}`).
- **What:** The loader accepts only `mod.default` and reports
  "has no object default export" otherwise, so `urbicon i18n audit
  packages/auth/src --translations packages/auth/src/lib/i18n` fails on both
  bundles and audits nothing. auth ships EN/DE translations and is the one
  package whose strings a consumer actually sees in production, so it is the
  most valuable root still missing from `i18n:check`.
- **Why deferred:** It is the house's read-tolerant/write-strict rule applied to
  a new shape, but "tolerant" needs a definition: accept any single object export
  when there is exactly one? Prefer an export named after the locale? Both are
  fine until a barrel file exports two locales, and the answer decides what
  `duplicate locale` means. auth's own `translations.parity.test.ts` covers the
  parity half meanwhile — the unused/hardcoded halves are what is missing.
- **Found:** 2026-07-30, extending the `i18n:check` scan roots.

### Grouped tables: the group header is a Tab stop, not an arrow-key stop

- **Where:** `packages/table/src/lib/core/GroupedRow.svelte` (the header `<td>`
  carries `role="button"` + `tabindex="0"`) vs. the roving sequence over item
  rows, wired 2026-07-25.
- **What:** Making keyboard navigation work inside groups needed a call on
  whether the group header is part of the arrow-key sequence. It is not: it keeps
  its own `tabindex={0}` and answers Enter/Space by collapsing, so it is reachable
  by Tab while the arrows move only between item rows. That is the smaller change
  and it left the header's existing behaviour untouched, but it means a table with
  many groups has many Tab stops, and a screen-reader user arrowing through rows
  is never told they crossed into a new group.
- **Why deferred:** The alternative — one index space over headers *and* rows —
  changes what Enter means depending on where focus sits, and wants real SR
  testing to judge (does announcing the group on crossing beat a dedicated stop?).
  That is a design pass, not a follow-up to the wiring.
- **Found:** 2026-07-25, wiring the grouped roving tabindex.

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

### ~~Table persists a *controlled* `searchTerm`, unlike controlled selection~~ — resolved 2026-07-27

- **Where:** `packages/table/src/lib/stores/concerns/usePersistence.svelte.ts`
  (`syncSearch`) vs. `syncSelection`, which checks `state.selectionControlled`;
  driven by `TableProvider.svelte`'s controlled-search effect.
- **What:** With a controlled `searchTerm` prop every keystroke was still
  mirrored into storage, although the prop is the source of truth. Switching
  that table back to uncontrolled later revived the old term — the exact bug
  class `selectionControlled` already prevents for selection.
- **Resolved 2026-07-27:** a `searchControlled` flag on `TableState`, set by
  TableProvider from the prop's presence *before* the value is applied so
  `syncSearch` sees it and skips the write. Deliberately **without** the
  `untrack` the selection twin carries: that one needs it because
  `setSelectedIds` reads `state.selectedIds` on its write path even while
  controlled, whereas this path reads nothing reactive
  (`useSearch.setSearchTerm` only assigns, `syncSearch` short-circuits on the
  flag). Copying the sibling verbatim would have meant a comment claiming a
  mechanism that is not there. Two tests, negatively verified — dropping the
  flag check fails the controlled one while the "an uncontrolled term is still
  persisted" guard stays green, so the skip is keyed on the flag rather than
  being a blanket "search is never persisted".
- **Found:** 2026-07-24, W4 persistence work; closed 2026-07-27.

### Combobox `queryFn` failure has no in-component error-row slot

- **Where:** `packages/blocks/src/lib/primitives/Combobox/Combobox.svelte` — the
  async runner's `.catch`.
- **What:** A genuine `queryFn` rejection can now be surfaced by the consumer:
  `onError(error)` shipped 2026-07-20 (`d430797e`, ConfirmDialog vocabulary),
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
- **What:** The `fluid` prop (added `ac7c4886`) stretches the svg to its
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

### Scroller `emphasis` renders flat in Firefox < 156 — accepted, self-resolving

- **Where:** `packages/blocks/src/lib/primitives/Scroller/scroller.variants.ts`
  (the `align="center"` + `emphasis` compound), keyframes in
  `style/interaction.css`.
- **What:** The centred-stage lift is driven purely by
  `animation-timeline: view(inline)`. Firefox ships that only from **156**
  (caniuse, checked 2026-07-29); in 155 and below the animation never starts
  and the row renders identical minus the lift — which reads as "emphasis is
  broken" to anyone testing in Firefox (it did, twice, in review). Chrome 115+
  and Safari 26+ are fine.
- **Why deferred:** A `@supports not (animation-timeline: view(inline))`
  JS fallback (discrete pop on the active item via `activeIndex`) was designed
  but not built: the gap closes by itself as Firefox 156 rolls out, and the
  row's usability is untouched either way.
- **Decision 2026-07-29:** ✅ Accept the degradation — no fallback. Revisit
  only if a consumer reports it before FF 156 adoption makes it moot.
- **Found:** 2026-07-29, Scroller review session (the "no emphasis" reports
  turned out to be Firefox 153).

### Scroller: arrow paging and dots reportedly desync under `snap="mandatory"` — not reproduced

- **Where:** `packages/blocks/src/lib/primitives/Scroller/Scroller.svelte`
  (`step()` → `scrollTargetForStep`) and `scroller.utils.ts`
  (`activeItemIndex`) — both derive from the live `scrollStart`. Observed on
  the landing journey's row 1, which runs `itemBasis="85%"` +
  `snap="mandatory"` (`apps/docs/src/routes/+page.svelte`).
- **What:** Two observations from the 2026-07-30 browser round: the arrow
  appeared to advance only on every second click, and the dots appeared to lag
  one position behind. **Neither could be reproduced in a follow-up hand
  test** — logged as an open question, not a confirmed defect.
- **Plausible mechanism if real:** both the step target and the active dot are
  computed from the current scroll offset, not from a pending destination. A
  click landing mid-animation (smooth scroll plus snap settling) therefore
  computes its next target from an intermediate offset, which can resolve to
  the position the row is already travelling to; the dots follow that same
  intermediate offset, so during the animation they show where the row *is*,
  not where it is going. With `itemBasis="85%"` neighbouring targets sit
  closer than one viewport width, making the nearest-target match more
  sensitive to that intermediate state. The 85 % is the landing's item basis —
  there is **no** 85 % threshold in the anchor derivation (the concept doc
  guessed one).
- **Why deferred:** Wants a reproduction before anything changes. Tracking a
  pending destination (remembering the `scrollTo` target until `scrollend`)
  would address both symptoms *if* they are real, but it adds state to a
  primitive that currently derives everything from one observed value — not
  worth it on an unconfirmed report. When retrying, keep the tab in the
  foreground: a backgrounded tab runs no scroll animation at all, which looks
  exactly like a dead arrow.
- **Found:** 2026-07-30, landing journey browser round; unreproduced in a
  follow-up hand test.

### Table: grouping accepts data-field keys the grouping menu cannot represent

- **Where:** `packages/table/src/lib/features/SmartFilterBar/GroupingMenu.svelte`
  (options = groupable **columns** only) vs. `initialGroupBy` /
  `setGroupByKey`, which happily group by any item field.
- **What:** Grouping by a field that is not a column (e.g. the landing
  journey's booking list groups by `day` while showing no Day column) works —
  group headers render, the toolbar button shows active — but the menu's
  `Select` holds a value with no matching option: DEV logs
  `[Select] value "day" has no matching option`, the menu cannot display the
  active grouping, and once a user ungroups there is no way back to it.
- **Why deferred:** Needs a design decision: either the menu appends the
  active non-column key as a labelled option (grouping stays a superset of
  the menu), or `initialGroupBy` validates against columns and warns
  (menu stays the single source of truth). Both are small; picking one is
  API semantics, not a bugfix.
- **Found:** 2026-07-30, landing journey table tile (booking list grouped by
  `day`).

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

### ~~Rooms skin pins `--color-primary` to the raw accent in both modes — dark-mode accent-as-foreground misses the floor~~ — resolved 2026-07-30, by the Material-3 split the entry kept asking for

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
- **Update 2026-07-25:** measured worse on the Guide surfaces than the figure
  above — the panel's GuideRef link and the tour's "Next" fill both render
  `#006c4a` on `#322f2c` = **2.05:1** (axe: serious). The `guide.spec.ts`
  dark baselines now bake this in: they were re-generated on 2026-07-25, and the
  previous ones were the last artefact in the repo still showing the adaptive
  light green (≈5.15:1). So a fix here is also a Guide re-baseline.
- **Update 2026-07-30 (dark half resolved, light half inverted):** the docs rooms
  moved from four hand-picked area colours to the landing's channel register
  (`--room-accent` = a channel's *accent step*, the lightest step still clearing
  3:1 on paper — see `apps/docs/scripts/channels-gen.ts`). Measured against the
  dark Rooms paper `#232220` every room now sits at **4.85–4.87:1** (ink 5.1:1),
  i.e. the dark-mode foreground complaint above is gone, and the Guide's darker
  `#322f2c` follows. The trade is the light half: on cream every room is now a
  uniform **3.13:1** as foreground — above the 3:1 UI floor (marker, focus ring,
  active bar) but below AA for the active nav-link *text* and body links, where
  the old green sat at 6.20:1 (the old amber room sat at 2.11:1, so the spread
  narrowed even as the best case got worse). The Material-3 split named above is
  still the real fix; it is now a **light**-mode split (a darker stop for the
  foreground role) rather than a dark-mode one.
- **Resolved 2026-07-30:** the split shipped. Each channel gained a fourth,
  generated step — `accentText`, the lightest step of the same hue clearing
  **4.5:1** against the darkest light paper in play (L 0.53–0.59, so still a
  colour, not ink) — emitted as `--room-accent-text` next to the existing pair.
  In `rooms-docs.css` the primary ramp now has **two anchors**: 50–500 hang off
  the fresh accent (surfaces, tints, the raw 500), 600–950 off the text step, and
  `--color-primary` is the library's own `light-dark(600, 500)` shape again with
  `--color-text-on-primary` following it (`light-dark(cream, room-accent-fg)`).
  Measured in the browser across six rooms × both modes: body link 3.13 →
  **4.72–4.76** light, **4.85–4.88** dark (unchanged); on-primary 4.72–4.76 light
  / 5.48–5.59 dark; header band title 5.48–5.59; active nav entry 10.9–12.3.
  The fresh accent keeps every non-text role and is untouched — header bands,
  hero fields, the register rail, the wordmark cursor, the playground tint (all
  read `var(--room-accent)` directly), plus `--color-interactive-focus` and
  `--color-chart-*`, both measured at 3.12–3.14 light / 4.85–4.88 dark.
- **The dual role is real and was not resolved, only re-pointed:** `--color-primary`
  is `bg-primary` AND `text-primary` — 42 fill sites vs 43 foreground sites inside
  `packages/blocks` alone, so no amount of rewriting docs-app call sites reaches
  it. It therefore carries the sharper threshold, and the cost is that light-mode
  primary FILLS (button, toggle, progress, `fill-primary` marks) sit one step
  deeper than the header band above them rather than matching it exactly. That is
  a deliberate trade, not an oversight: it is also what the library's own default
  theme does (`primary-600` fill under white text). A genuinely separate text
  token would need a new Tailwind colour utility and ~145 call sites across two
  packages.
- **No single colour can be AA on both papers**, which is why the text role is a
  `light-dark()` pair rather than one new value: 4.5:1 against `#fbfaf6` needs
  relative luminance ≤ 0.173, 4.5:1 against `#232220` needs ≥ 0.247. The
  generator's guard therefore measures the *role*, not the colour — the text step
  against the light paper, the accent step against the dark one.
- **Found:** 2026-07-24, W1 adversarial review (deepened by W1's green nudge).

### `bg-primary-subtle` + `text-primary` lands at 4.29:1 in the Rooms light mode — a library-wide pairing, not a Rooms defect

- **Where:** `--color-primary-subtle` (light = `--color-primary-50`) under
  `text-primary`. Used by `CommandPalette` (`itemHighlighted`), `EmptyState`
  (icon), `Planner` (count badge), `Calendar` (selected day) and, via
  `--color-surface-selected`, by every selected row.
- **What:** measured in the browser across six rooms: **4.29–4.30:1** light,
  3.62–3.69:1 dark. Both short of AA for the small text those components put on
  it. The light figure is a large improvement — before the 2026-07-30 accent-text
  split it was **2.83:1** — and the dark figure is already better than the
  library's own default theme, which measures 4.55 light / **3.46** dark for the
  identical pairing. So the shortfall is a property of the `subtle`-surface
  recipe library-wide, not something the Rooms skin introduces.
- **Why deferred:** closing it in the Rooms skin alone would mean lightening
  `--color-primary-50` from a 10 % accent tint to roughly 5 %, which washes the
  subtle surface out to almost nothing — the wrong lever. The right one is a
  decision about what `*-subtle` + `text-*` is allowed to promise across the
  library (the same question the `surface-subtle` entry below asks), measured by
  a gate that can resolve the skins (see the entry above about the Rooms skins
  being invisible to `contrast.test.ts`).
- **Found:** 2026-07-30, browser measurement of the accent-text split.

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

### ~~A new docs page has to be hand-registered in two places, and nothing checks it~~ — gated 2026-07-30 (`registry:lint`), and it was three places

- **Resolved:** `apps/docs/scripts/registry-lint.ts` (`bun run registry:lint`)
  checks five things: every catalogue component with a `+page.svelte` is in
  `componentLinks` **and** points at its own page (only page-less names may alias
  onto a family page); every `componentLinks` href resolves; every page appears
  in the sidebar; every recipe appears in the cookbook; every component chip on a
  recipe/showcase card resolves. Deliberately unlisted pages need an `UNLISTED`
  entry with a reason, and a stale entry is an error too — the `imports-lint`
  contract. Text-parsed rather than imported (both registries import
  `$app/paths`, so importing them would need `svelte-kit sync`), with sanity
  floors against a parser collapse.
- **What it found on its first run — 26 items, more than the entry assumed.**
  **23** catalogue components with a page but no `componentLinks` entry (so every
  `@related` chip pointing at them was dropped without a word) — the entry named
  four, and the real list is the whole AI/Chat family plus CurrencyInput,
  ChartFrame, QRCode, Planner, EmptyState, AvatarGroup, PinInput, TimeInput,
  SplitPane, ConfirmDialog, FormField, CodeBlock and more. **3** published recipe
  pages (`/recipes/a2ui-agent-ui`, `/recipes/ai-chat`, `/recipes/filter-sidebar`)
  that were prerendered and listed in the cookbook but in **no** sidebar — the
  third registry the entry did not know about. Plus two recipe chips
  (`RadioItem`, `StepperStep`) rendering as `href="#"`. All fixed;
  `componentLinks` is 76 → 102 entries and alphabetical.
- **The catalogue-driven nav check the entry proposed would have found nothing** —
  every catalogue page was already in the sidebar. The useful direction is
  route-driven (every *page* must be in a navigation surface), and that one needs
  the 6 justified `UNLISTED` exceptions (test fixtures, imprint/privacy, the
  salon, two AI harness pages).
- **Open, editorial:** `/ai/streaming-markdown` has no incoming link anywhere in
  the repo and is currently exempted as a harness — either link it (the way
  `/ai/chat` is linked from three chat pages) or delete it.
- **Found:** 2026-07-27, giving the last catalog components a shared example;
  closed 2026-07-30.

### ~~`TabProps`' JSDoc examples show an API that does not compile~~ — gated 2026-07-30 (`examples:lint`)

- **Resolved as the class, not the instance:** `packages/docs-gen/scripts/examples-lint.ts`
  (`bun run examples:lint`) writes every ```svelte `@example` block out as a real
  `.svelte` file and runs `svelte-check` over it — 181 examples across blocks,
  table, auth and docs. The harness fills in what a *fragment* legitimately
  leaves out (imports for PascalCase tags, `$state<any>()` slots for free
  identifiers collected from a first pass, the DOM globals a fragment shadows),
  and only reports the diagnostics that mean the example is wrong: unknown prop,
  wrong enum value, missing required prop, mistyped component name. A consumer
  placeholder (`<SettingsForm>`) needs a `PLACEHOLDERS` entry; stale entries are
  errors, per the `imports-lint` contract.
- **What it found besides the logged Tab case (7 examples, 5 components):**
  Tab's `tabs={[{value,label}]}` for a `Snippet` prop **and** a
  `variant="underline"` that never existed · `Popover` documented an `arrow` prop
  it does not have · `Alert` used `<AlertCircle>`, `Breadcrumb` `<ChevronRight>`,
  `Select` `<FilterIcon>` — none of the three is an export (the icons are
  `AlertCircleIcon`, `ChevronRightIcon`, `ListFilterIcon`) · `Chat`'s example
  omitted Toolbar's required `aria-label` · `Badge` and `Select` carried literal
  `…` / `{...}` ellipses inside code expressions, so the snippet could not
  compile at all · auth's TwoFactorManager invented `<MyQrCode>` where the house
  `QRCode` fits.
- **Known limit, recorded in the script:** every filled-in identifier is `any`,
  so a type error that only surfaces through such a value stays invisible. The
  gate covers the classes that actually drifted, not every conceivable one.
- **Costs two `svelte-check` passes per package**, so it is a pre-merge/pre-bump
  gate rather than a per-commit one.
- **Found:** 2026-07-26, landing hero prototype; closed 2026-07-30.

### ~~A `@related`/`@tag` value swallows the prose that follows the tag block~~ — fixed 2026-07-30

- **Where:** `packages/docs-gen/src/extractors/typescript/TypeScriptBaseExtractor.ts`
  (`extractJSDocTagAll`), surfacing in `_catalog.json`, `llm.txt` and every
  related-chip consumer.
- **What:** TypeScript attaches every line after a JSDoc tag to that tag's
  comment, so a paragraph written *below* the tag block landed inside the last
  tag's value. Measured: 2 of 83 blocks components shipped a related component
  literally named `"Toast\n\nBadge props are a discriminated union…"` (Badge) and
  `"Stepper\n\nTab props are a discriminated union on `orientation`…"` (Tab) — a
  chip that can never resolve, in the catalogue, in llms-full.txt and in the MCP
  payload at once.
- **Fixed on both ends:** the extractor cuts a repeated single-value tag at its
  first line and *warns* about the dropped prose instead of folding it in, and
  the two JSDoc blocks now put their prose above the tags. Four tests, negatively
  verified (restoring the old `results.push(raw)` fails exactly the two value
  tests, with the tag-tag case covered by its own fixture where `@tag` closes the
  block).
- **Side finding worth keeping:** an `@`-word anywhere in a JSDoc block is parsed
  as a tag — including inside backticks. Writing `` `@tag` `` in prose added a
  phantom tag whose value was `.`; the fixture had to be reworded.
- **Found:** 2026-07-30, while auditing the `@example` blocks.

### A playground whose demo data is built *from a control* still prints a static snippet

- **Where:** the `Playground.svelte` files of A2UIView, ChatMessage and
  ReasoningDisclosure, versus
  `packages/docs/src/lib/components/PlaygroundConfigurator/code-gen.ts`
  (`CodeSetup.consts`).
- **What:** `consts` takes the objects the demo renders, so the snippet cannot
  drift — but it is evaluated once, and these three derive their data *from a
  control*: A2UIView's payload follows the scenario switch, ReasoningDisclosure
  builds its `reasoning` object from a duration slider. Move the control and the
  preview changes while the printed data does not.
- **Why deferred:** The fix is not a bigger `consts` — it is making the setup a
  function of `values`, which changes `CodeSetup` from a declaration into a
  callback and has to answer what happens to the `imports` and `state` halves.
  Worth doing against a second use case rather than for these three.
- **Resolved sibling:** the larger half of this — demos whose content is
  **markup** (Card's header/footer snippets, SplitPane's panes, SegmentGroup's
  items), which no data declaration can express — is **fixed (2026-07-27)** by
  source extraction: `extract-markup.ts` lifts the `{#snippet children}` body
  out of the playground's own text (`source={playgroundSource}`), 24 playgrounds
  are wired, and `playgrounds:lint` fails on a demo that has markup but no
  `source`. Name the import `playgroundSource`, never `self` — `self` is
  `window.self`, so a missing import type-checks and passes the Window object.
- **Found:** 2026-07-27, rolling `codeSetup` out across all 76 playgrounds.

### The long `@description`s were never revisited after the `@summary` split

- **Where:** every `*Props` JSDoc — the `@description` tag, now sitting next to
  a `@summary`.
- **What:** `@summary` was added as the human-facing sentence and 97 of them
  were written; `@description` was left byte-identical, on purpose, so the diff
  stayed reviewable and the shipped agent surfaces (`llm.txt`, the MCP catalog)
  could not regress. But those texts were written when one field served both
  readers. Some now open with a sentence the summary already made
  ("Compact label for status, categories, counters…" under "A small label for a
  status, a category or a count"), and some carry landing-page voice in a field
  only agents read. The redundancy is harmless; the missed opportunity is that
  `@description` may now be *purely* the contract — types, constraints, failure
  modes, the server factory to pair with — and several are not.
- **Why deferred:** It is an editorial pass over a **shipped** surface. Judging
  97 agent-facing texts is a different job from writing 97 human-facing ones,
  and mixing them into one diff would have made both unreviewable. Worth doing
  against a concrete question — what does `find_components` actually need to
  answer? — rather than as a rewrite for its own sake.
- **Found:** 2026-07-27, splitting `@summary` out of `@description`.

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


### CI runs since the GitHub move; the pixel suite is the one part still ungated

- **Where:** `.github/workflows/ci.yml` + `release.yml` vs. the deploy pipeline:
  a webhook → a systemd unit on the deploy host → `@buny/deploy-runtime`, driven
  by an environment file there. Host-side paths and unit names are deliberately
  not repeated in this public file; they live in the internal deployment doc.
- **What:** This entry used to read "Linux CI can't verify them", which framed
  the problem wrongly for months, and then "there is no CI at all", which was
  true for as long as `origin` was Codeberg: the workflow files described a
  runner that did not exist. Before that, the only automation was the Buny
  deploy, running `INSTALL_CMD` → `BUILD_CMD` → publish with **no test step**,
  for all eight projects on the host — for `ui` that meant twelve packages went
  to registry.npmjs.org on every release tag without a single test having run.
- **Resolved 2026-07-31 (the runner):** with the move to github.com/urbicon/ui
  the workflows execute for the first time. `ci.yml` gained the nine gates that
  had grown up since it was written (imports/icons/summary/registry/playgrounds/
  examples lint, `a2ui:axes:check`, `i18n:check`, `size --check`) — each one
  verified green locally first, so the first public run was not a fishing trip.
  Publishing stays with Buny: `release.yml`'s publish steps are guarded by
  `if: env.NPM_REGISTRY_URL != ''` and the secrets are deliberately unset, which
  makes that workflow a tag gate rather than a second publisher.
- **Still open after that, and the reason this entry survives:** CI runs
  `playwright test --grep-invert @pixel`, so the 26 screenshot tests are the one
  suite no automatic gate covers. Excluding them is not a preference — the
  Docker measurement below proves a foreign renderer cannot host these
  baselines, and a GitHub runner is exactly that. The pixel suite therefore
  still runs only where its baselines were made: locally (darwin) and on the
  deploy host (linux), both by hand.
- **Resolved 2026-07-26 (the gate):** `deploy-runtime` supports an opt-in
  `TEST_CMD` that runs after the build and *before* the release move and the
  publish, failing the whole deploy on a non-zero exit (10-minute budget). The
  host's environment file now sets `TEST_CMD=bun run test` — measured at 90s
  there under full load. Verified by running the suite on the host first, in a
  throwaway checkout: it surfaced a real flake (four audit-scanner tests timing
  out at the 5s default, fixed in `badd9983`) that would otherwise have blocked
  every deployment the moment the gate went live. The previous config was backed
  up alongside it.
- **Resolved 2026-07-26 (the baselines):** `-chromium-linux` baselines now exist
  alongside the darwin ones, generated on the deploy host itself — the machine
  that would run them — rather than by trying to match some CI renderer
  byte-for-byte. The `test.skip(process.platform !== 'darwin')` gate on
  `visual-regression.spec.ts` is gone with its reason. The full Chromium build
  (not just `headless_shell`) had to be installed on the host for this, because
  `playwright.config.ts` pins `channel: 'chromium'`.
- **The deploy gate runs unit tests only.** e2e/Playwright is not in `TEST_CMD`
  — it takes **~11 minutes on that host** (5 locally) against a ten-minute
  budget shared with the build, and a red visual diff blocking a docs deployment
  is a policy call rather than an obvious win. Since 2026-07-31 this matters
  less for the behavioural half: GitHub Actions runs the full e2e suite minus
  `@pixel` on every push and PR, so the deploy gate is no longer the only thing
  between a change and production. It stays the only place the **pixel** half
  could run automatically — which is why the host, not the runner, is where
  that decision still sits.
- **A systemd `EnvironmentFile` is read at service start, not per request — so
  editing it changes nothing until the unit restarts.** The deploy daemon had
  been up since 2026-06-30, so the freshly-added `TEST_CMD` was absent from its
  process environment and the v6.43.2 deploy still published untested. Verified
  by reading the running process's environment, which listed `BUILD_CMD` but not
  `TEST_CMD`; fixed by restarting the unit. The general lesson outlives this
  incident: any change to such a file needs a restart, and the only honest way
  to confirm a gate is armed is to read the running process's environment rather
  than the file it was supposed to come from.
- **Baseline hygiene, learned twice in one day:** both platform sets had to be
  regenerated after merging the surface-ladder change (`162bac47`), which moved
  `neutral-25/-50` without touching any snapshot — correct for pass/fail, since
  `threshold: 0.15` cannot see a ΔL of 0.015, but it leaves the committed images
  showing surfaces the library no longer has. 24 darwin and 7 Linux shots moved
  on re-capture. A baseline that passes is not the same as a baseline that is
  current, and only `--update-snapshots=all` reveals the difference.
- **The Linux set went stale again on 2026-07-31** and this time could not be
  refreshed here. The channel wave (`d89f7d3c`, `942e1d2a`) moved the rooms
  fallback accent from green to the orange channel, which moves every `rooms`
  shot: 49 darwin baselines were re-captured, and the same change invalidates
  33 committed Linux ones (26 primitive `rooms` + 6 guide + the full floating
  fixture). Only the deploy host can produce them — **Playwright's own Docker
  image cannot stand in for it**, measured rather than assumed: running the
  suite in `mcr.microsoft.com/playwright:v1.61.1-noble` against the *unchanged*
  `library` baselines drifts 387px (ratio 0.01), five times `maxDiffPixelRatio`,
  so a Docker re-capture would write baselines the host would immediately
  reject. Refresh path stays `--update-snapshots=all` on the host itself. Until
  then the Linux set is knowingly behind on those 33 shots — a Linux run reads
  as 33 red diffs that are the channel wave, not a regression.
- **Found:** 2026-07-08 (as the darwin-only observation); re-framed and largely
  resolved 2026-07-26 after inspecting the host; Linux set stale again
  2026-07-31.

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
  (commit `f21cb7ed`).

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

### Two type shapes reach `api.ts` unresolved, so their props carry no values

- **Where:** `packages/docs-gen/src/extractors/typescript/PropsExtractor.ts` (the
  `values` it records per prop) — visible in every generated `api.ts` as props
  whose `type` is an alias and whose `values` is `null`.
- **What:** Most named aliases are recoverable downstream, because the
  definition travels along in `types[]` (`ComponentSize` →
  `'xs' | 'sm' | 'md' | 'lg' | 'xl'`), and `deriveControls` now resolves those
  locally. Two shapes stay opaque:
  1. **Computed unions** — `ComponentIntent` is `(typeof INTENTS)[number]`, so
     the definition names a runtime array instead of listing values. Affects
     every `intent` prop that goes through the shared alias.
  2. **Indexed variant access** — `ButtonVariants['variant']`,
     `RadioItemVariants['size']`, `AvatarProps['size']`,
     `ChatMessageProps['layout']`: the referenced type is `VariantProps<typeof
     xVariants>`, which again holds no literals.
  Consequence beyond playgrounds: the API tables on those pages show an opaque
  alias where every other prop shows its options, and an agent reading the
  catalog cannot tell what `intent` accepts.
- **Why deferred:** Both need the type checker at extraction time (resolving
  `typeof INTENTS` to its literal members, and instantiating
  `VariantProps<typeof buttonVariants>`), not string handling — a real change
  in `PropsExtractor`, worth doing once, deliberately. Around 20 playground
  controls across `ButtonGroup`, `Menu`, `RadioGroup`, `Textarea`, `Popover`,
  `Toolbar`, `AvatarGroup` and `ChatMessageList` currently need a hand-written
  override for this reason alone.
- **Found:** 2026-07-27, deriving playground controls from the generated API.

### ~~`@see` on a *type* is still swallowed~~ — resolved 2026-07-27; the mid-sentence trap stays open

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
- **Resolved 2026-07-27 (the type side):** the splitting rule moved onto
  `TypeScriptBaseExtractor` (`extractSeeTags`) so props and types cannot drift
  apart — a second aligned copy on LocalTypesExtractor was the alternative, and
  that is exactly how the four `toSlug` copies drifted. Wired through all three
  construction sites (`toTypeDefinition` plus the two in-file `out.push` sites),
  `TypeDefinition`, and TypesReference, which renders it the way ApiReference
  already does. Keys are omitted rather than set to `undefined` — the package
  compiles under `exactOptionalPropertyTypes`, and an empty `seeAlsoRefs` would
  render an orphan "See" label. 5 tests over both extraction paths, each
  negatively verified; a regenerated `bar-chart/api.ts` now carries
  `"seeAlsoRefs": ["CartesianDatum"]`, the one real occurrence (blast radius
  measured across every generated `api.ts`).
- **Still open — the mid-sentence trap.** TypeScript parses **any** `@see` as a
  `JSDocSeeTag`, including one written inside a description, so such a
  description silently grows a reference chip. `BarChartDatum` is in fact
  written that way (`… per series. @see CartesianDatum` on one line) and the
  outcome there is right, so nothing is broken today — but it is luck, not a
  rule. Catching a genuinely accidental one wants a JSDoc lint, not a change to
  the extractor. The caveat is recorded on `extractSeeTags`.
- **Found:** 2026-07-24, W6 `@see` split; type side closed 2026-07-27.

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

### ~~docs-gen's vitest never runs `src/**/*.test.ts`~~ — resolved 2026-07-27, both suites are real coverage and now run

- **Where:** `packages/docs-gen/vitest.config.ts` (`include: ['tests/**/*.test.ts']`).
- **What:** Two suites next to their sources — `src/generators/content/icons.test.ts`
  and `src/generators/llm/LLMDocumentationGenerator.test.ts` — were silently never
  executed; the package's reported test count contained neither.
- **Resolved 2026-07-27:** both triage questions answered by measuring rather
  than assuming. *Superseded?* No — the four `tests/LLMDocumentationGenerator.*`
  suites cover the index links, docs config, global aggregator and type-size
  cap; the orphan covers copying `guides:` into the llms.txt scope index, which
  nothing else touches, and the icons suite has no counterpart at all.
  *Hidden failures?* None: 25 → 27 files, 198 → 208 tests, all green. The
  revived tests are not vacuous either — breaking `parseComponentNames`'
  `DEFAULT_ICONS` lookup and the `## Guides` index heading fails one test in
  each. Swept the rest of the repo for the same shape: every other package's
  include roots cover every test file on disk, so docs-gen was the only case.
- **Found:** 2026-07-24, W6; closed 2026-07-27.

### What the docs-gen prune deliberately left standing

- **Where:** `packages/docs-gen/src/types/configuration.ts`
  (`LLMOptimizationConfig`, `APIOptimizationConfig.compress`/`splitByPackage`/
  `generateIndex`, `DebugOutputConfig`, `MigrationConfig`, `CustomParserConfig`,
  `VariantsExtractionConfig.includeComputed`/`customParsers`,
  `MetadataEnrichmentConfig.addTags`/`autoTierAssignment`, `SchemaConfig.strict`/
  `allowUnknownSections`, `ComponentValidationConfig`);
  `packages/shared-types/src/component.ts` (`ComponentInfo.documentation`);
  `apps/docs/package.json` + `packages/docs/package.json` (`chokidar`).
- **What:** Four leftovers around the W6 prune. (a) A second tier of
  declared-but-never-read config, same shape as the pruned one — two fields are
  even *written* as defaults by `VariantsExtractor` with no reader. (b) The
  inverse shape: `ComponentInfo.documentation` is *read* once (the pipeline's
  `componentsWithDocumentation` stat) but never written, so that number is
  structurally always 0. (c) `chokidar` is a devDependency of two packages with
  zero imports — residue of the same never-built watch loop whose config W6
  removed. ~~(d) Both docs-gen architecture diagrams describe classes that no
  longer exist.~~
- **(d) resolved 2026-07-27:** measured before rewriting — 18 of the class
  diagram's 33 classes were gone and 11 real ones were missing, so it was more
  wrong than right. Both diagrams are now derived from the sources, which
  corrected three things an eyeball rewrite got wrong (`DocsGeneratorCLI`, not
  `CLI`; `DocsConfigurationBuilder` *implements* the `GeneratorConfigBuilder`
  interface; `VariantsExtractor` extends `TypeScriptBaseExtractor`, not
  `BaseExtractor`). The class diagram now carries only the members that show
  architecture — phase entry points and the seams between classes — because
  duplicating full signatures is what made it a second copy that drifts. Both
  validated with mermaid's own parser, negatively verified.
- **Why deferred:** (a) pruning it further shrinks `EnrichmentConfig`/
  `ExtractionConfig` to near-empty shells — that is a decision about whether
  docs-gen keeps a configurable-pipeline contract at all. (b) means deciding
  whether to populate the field or drop a whole shared-types subpath. (c) touches
  `bun.lock`, which should not be rewritten mid-wave.
- **Found:** 2026-07-24, W6 prune; (d) closed 2026-07-27, (a)–(c) still open.

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

### The table's own intents (`filter`/`group`/`summary`) never got the WCAG darkening the blocks intents have, and no test looks at them

- **Where:** `packages/table/src/lib/style/table-theme.css:5-56` (raw Tailwind
  cyan/teal/emerald ramps) vs. `packages/blocks/src/lib/style/foundation.css:55-68`
  ("Darkened *-500/-600/-700 so text-on-primary passes WCAG AA"); the blind spot
  is `packages/blocks/src/lib/style/contrast.test.ts:252-263`, whose `INTENTS`
  list holds only the seven blocks intents — the test globs the table
  `*.variants.ts` files (`:412-417`) but then never touches these three.
- **What:** white on `bg-summary` measures 3.67:1, on `bg-filter` 3.60:1, on
  `bg-group` 3.66:1 — all under AA, in the plain default theme. The pairing
  guard and the WCAG sweep both walk past them because they are not in the list,
  so the ramps have quietly been three intents that no gate covers.
- **Mitigated, not fixed (2026-07-30):** the three call sites that put text on
  those solid grounds moved to `soft` (state chips, the counter badges, the two
  active header-menu entries — 8.8–9.2:1), so nothing renders under AA today.
  The ramps themselves are unchanged and the next solid use re-opens it.
- **Why deferred:** the fix is to pull `--color-filter/group/summary` to their
  `-700` stop *and* add the three to `INTENTS` — a token change that moves every
  existing surface in the table and wants a VR pass, not a same-session edit.
- **Found:** 2026-07-30, landing polish (the counter badge on the Σ button).

### `text-on-primary` is used as the on-colour for every solid intent surface

- **Where:** `badge.variants.ts:336-372` (filled success/secondary/danger/neutral
  all pair their `bg-<intent>` with `text-text-on-primary`; only warning has its
  own `text-on-warning`), and the same pairing recurs in at least
  `button.variants.ts`, `checkbox.variants.ts`, `tooltip.variants.ts`,
  `stepper.variants.ts`, `prompt-input.variants.ts` (single-line grep heuristic —
  a proper sweep must recount across multi-line class arrays).
- **What:** `--color-text-on-primary` is semantically "readable on the primary
  colour", but it is composed onto success/danger/secondary/neutral fills as
  well. That holds only while on-primary happens to be near-white globally. The
  moment primary is rethemed — `BlocksProvider` overrides, a consumer theme, or
  the landing's `.room-accent` channel scoping — every non-primary solid fill
  inherits the retheme's on-colour: on the journey prototype's orange tile, a
  `success` filled Badge rendered dark-orange text on dark green (~1.5:1).
  Themability is a core promise; this couples it to intent colours it must not
  touch.
- **Why deferred:** Needs a token design decision, not a local patch: either
  per-intent on-tokens (`--color-text-on-success` etc. — warning already has
  one) or one shared `--color-text-on-emphasis` that themes deliberately. Then a
  sweep over all variants files + contrast tests for the new pairings.
- **Found:** 2026-07-29, journey-prototype tile livery (channel-scoped primary).

### A contrast floor on a token says nothing about what a component composes on it

- **Where:** `packages/blocks/src/lib/style/contrast.test.ts` (the ramp guards)
  vs. `packages/blocks/src/lib/components/Calendar/calendar.variants.ts:407-409`
  (disabled day: `day: 'opacity-40'` + `dayNumber: 'text-text-disabled'`).
- **What:** The guards measure a text token against a surface token. Calendar's
  disabled day then wraps that pairing in `opacity-40`, which lands it around
  1.6:1 — below where the token sat *before* it was hardened, while the guard
  reports the token's own 3.4–4.9:1 and stays green. Any `opacity-*` on an
  ancestor has the same effect; Calendar is just the instance that was measured.
- **Second half of the same gap:** `--color-text-disabled` now resolves to the
  same value as `--color-text-quaternary` in light mode (both `neutral-500`).
  That is defensible in general — they are two roles, not two rungs of one ladder
  — but Calendar puts them side by side: `outsideMonth` (quaternary) and
  `disabled` (disabled) used to differ (neutral-500 vs -300) and are now
  identical, so the two states are told apart only by that same `opacity-40`.
- **Why deferred:** The fix is either a resolved-style assertion (measure the
  composed result in a browser, which is an e2e/VR job, not a node test) or a
  house rule against `opacity` on text-bearing elements — plus a Calendar
  redesign of how "outside month" and "disabled" differ. Both are their own pass.
- **Found:** 2026-07-25, adversarial review of the interaction-token wave.

### The docs Rooms skins override the semantic ramp and no contrast gate sees them

- **Where:** `apps/docs/src/lib/style/rooms.css` +
  `rooms-docs.css` (they re-declare `--color-text-*`, `--color-surface-*` and
  `--color-primary`) vs. `packages/blocks/src/lib/style/contrast.test.ts`, which
  resolves only the library themes.
- **What:** Every contrast guarantee the library gates is re-opened by the skins
  the docs site actually ships, and nothing measures the result. Concretely
  today: `rooms.css` disabled text clears 3:1 on the reading surfaces but not on
  `surface-active` (~2.8:1), and each room's `--room-accent` shifts every surface
  again (with the wine accent, quiet/subtle/disabled land near 2.9:1). The
  `--color-primary` dark-mode defect under §Accessibility is the same class.
- **Why deferred:** The guard resolves `light-dark(var(--color-*))` chains; the
  skins are hex literals and `color-mix()` with a runtime `--room-accent`, so
  covering them means either a resolver for those forms or measuring in a browser
  (axe against the rooms, which the dark-axe project currently excludes on
  purpose). A gate-scope decision, not a value fix.
- **Found:** 2026-07-25, adversarial review of the interaction-token wave.

### `surface-subtle` still duplicates `surface-elevated` — the hover half is fixed, the token's own role is not

- **Where:** `packages/blocks/src/lib/style/semantic.css`
  (`--color-surface-subtle` vs `--color-surface-elevated` — both
  `light-dark(neutral-50, neutral-800)`); ~150 remaining *resting* uses across
  blocks, table, auth and the docs site.
- **Resolved 2026-07-26 (the hover half):** the decision recorded here was
  taken in favour of moving the idiom, not the value — following the precedent
  Progress and Slider had already set for the identical collapse (both moved
  their track to `surface-interactive` rather than redefining the token). All
  11 hover sites now use `surface-hover`: the `ghost` variants of
  Input/Textarea/Select/Combobox (`internal/field-chrome.ts` + three own
  configs), Checkbox and RadioGroup's `group-hover`, Tab's `enclosed` trigger,
  table's `detailsToggle`, and three docs demos that were teaching the idiom to
  consumers. Two guards close the class rather than the instance:
  `semantic.test.ts` asserts every interaction step (`surface-hover`,
  `surface-active`) differs from **every** reading surface in both modes — the
  pair guard added on 2026-07-25 only proved a step differs from *one* resting
  value, which is why this shipped — and `variants-lint` now errors on any
  `hover:`/`group-hover:` fill naming a reading surface (negatively verified:
  exit 1 on a planted violation). Side finding, fixed in passing: FileUpload's
  `disabled` branch carried `hover:border-border-default hover:bg-surface-base`
  under a `pointer-events-none` root — unreachable, and it would have
  *lightened* a disabled dropzone resting on a card.
- **Still open:** `surface-subtle` has no rung of its own. Its in-page-zone role
  went to `surface-quiet` in v5 (MIGRATION-v5 "New tokens consumers can use
  directly" calls `surface-quiet` the "was `bg-surface-subtle`-equivalent"), and
  its value equals `surface-elevated` exactly — so a `bg-surface-subtle` row or
  chip resting on an elevated card is invisible unless a border carries it (most
  current uses do have one, which is why this is a latent smell rather than a
  live defect). The open decision is whether the token gets a distinct value, or
  is deprecated and its ~150 resting uses split between `surface-quiet` (tinted
  zone) and `surface-elevated` (raised) — a sweep across four packages plus the
  docs site, and a consumer-visible token change either way.
- **Found:** 2026-07-25, interaction-token wave (while fixing the universal
  `surface-interactive` sibling); hover half closed 2026-07-26.

### ~~The VR matrix has no hover, focus or disabled state~~ — resolved 2026-07-26, and a pixel suite turned out to be the wrong tool for half of it

- **Where:** `e2e/visual-regression-interaction.spec.ts` +
  `e2e/interaction-tokens.spec.ts` + `e2e/helpers/force-state.ts` +
  `apps/docs/src/routes/test-fixtures/interaction`.
- **What it was:** The 2026-07-25 wave changed `--color-text-disabled`,
  Combobox's focus ring, two `description` sizes and the filled-field hover
  fill, and the suite stayed 131/131 green with **0 of 52 shots moved** — the
  fixture renders resting states only.
- **Resolved:** a second fixture renders four groups (fields, choice, nav,
  actions) with the `ghost` variants the resting fixture never had, each
  rendered **twice — on `surface-base` and inside an elevated Card**, because a
  fill that collapses onto its backdrop is invisible only on the surface it
  collides with. States are forced via CDP `CSS.forcePseudoState` rather than a
  real pointer: `group-hover:` compiles to `.group:hover .child` and so must be
  forced on the ancestor, and `:focus-visible` depends on input-modality
  heuristics that are awkward to drive. 48 shots (4 groups × 3 states × 2 modes
  × 2 themes), so the matrix is 100 total.
- **The part worth remembering — screenshots could not carry this alone.** With
  the interaction shots in place, reverting the `surface-subtle` fix left **all
  48 green**: `maxDiffPixelRatio` never got a chance, because the suite's
  per-pixel `threshold: 0.15` treats neutral-50 and neutral-100 as the same
  colour. Only dropping it to 0.005 turned them red, which trades this bug class
  for antialiasing flake across the other 52 baselines. A neighbouring-rung
  collapse is therefore invisible to a pixel diff **by construction** — the same
  lesson the chat-family wave hit from the other side (ΔL < 0.04 under
  `threshold: 0.15`). So `interaction-tokens.spec.ts` carries that half by
  resolved value, not pixels: for every element with a `hover:bg-*` utility it
  asserts the hover colour differs from its rest colour **and** from the nearest
  non-transparent backdrop behind it. The second assertion is the load-bearing
  one — a `ghost` field rests on `bg-transparent`, so a rest/hover comparison
  alone passes trivially while the user sees nothing, which is exactly how the
  bug survived. Negatively verified in both directions.
- **Two documented exemptions**, both design rather than defect: an element in a
  selection state (`data-state="active"`, `aria-selected`, `aria-current`) pins
  its own background on purpose — an active enclosed Tab reads as a
  continuation of the panel below it — and `hover:bg-transparent` is an explicit
  "answer hover with colour, not a surface" (Button's `text` variant).
- **Still open (small):** the gate is hover-only. `focus-visible:bg-surface-base`
  legitimately matches its backdrop on a base surface, where the affordance is
  the ring and border rather than the fill, so the same rule would false-positive
  on focus. Focus rings are high-contrast enough for the pixel suite to hold;
  a resolved-value gate for *rings* (border-colour + box-shadow rather than
  background) would close the remainder.
- **Found:** 2026-07-25, interaction-token wave; resolved 2026-07-26.

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
- **Measured 2026-07-26 — the catalog is the smaller half of that 5.0 KB.**
  Emptying `en.ts` + `de.ts` to `{}` and rebuilding moves every i18n-carrying
  component by a flat **−1.7 KB gz** (Toast −11.8 %, Dialog −12 %, Badge
  −12.9 %, Avatar −14 %), while CodeBlock and Spinner move ±0 — confirming they
  carry no translations today. So of CodeBlock's measured +5.0 KB, roughly 1.7 KB
  is the catalog and the remaining ~3.3 KB is the i18n *machinery* (registry,
  context, factory) that a per-area split does not touch at all. Two
  consequences for whoever picks this up: the achievable saving is ~1.7 KB gz per
  component minus its own slice, not 5 KB; and it only materialises for a
  consumer using **one** i18n component, since any second one shares the same
  catalog chunk. Against that: 58 `.svelte` call sites would have to pass their
  slice explicitly, and every future component would have to remember to. The
  cost/benefit is therefore much tighter than the entry originally implied, and
  the decision is a real one rather than a formality.
- **Decision 2026-07-26 (Felix):** ⏸ Hold — do not split. Measured against the
  real figure the trade is bad: ~1.7 KB gz per component, only for a consumer
  using exactly one i18n component, paid for with 58 call sites passing their
  slice explicitly and every future component having to remember. Revisit only
  if the machinery half (~3.3 KB) is attacked, since that is the larger share
  and needs no API change — or if a real consumer reports the leaf cost.
  The CodeBlock/ChatMessage split (plain English defaults vs. translations)
  therefore stays as it is; it is a documented consequence, not an oversight.
- **Found:** 2026-07-25, chat-family redesign — the bundle-size gate caught the
  regression when CodeBlock was switched to the shared accessibility strings;
  quantified 2026-07-26.

### The calendar header's month name sets the calendar's width

- **Where:** `packages/blocks/src/lib/components/Calendar/CalendarHeader.svelte`
  (the title button), measured through `packages/blocks/src/lib/components/DatePicker/DatePicker.svelte`.
- **What:** The header title is a plain `<button>{ctx.headerTitle}</button>`, and
  when it is wider than the day grid it drags the grid with it. Measured in the
  DatePicker overlay (`size="md"`, `de-DE`), paging March → September 2026:
  212 px (Mai/Juli) up to 268 px (September) — a 56 px step on every month
  change. The height half of this is fixed (`fixedWeeks` now defaults to `true`
  on DatePicker and is actually wired through `getMonthGrid`, so the overlay
  holds 314 px), and `tabular-nums` on the title slot removed the year-boundary
  twitch. The month *name* remains.
- **Why deferred:** Every fix that fully removes it is either locale-fragile or
  wider than this wave. A `min-width` in px/rem is a magic number per `size` ×
  locale ("September" is not the longest month name everywhere). The correct fix
  reserves the width of the longest month name of the *active* locale — a grid
  stack holding all twelve names in one cell, visible one at a time — which
  changes the header box for **every** Calendar consumer, not just the popover,
  and therefore needs a VR-baseline pass and a look at the embedded case, where
  the container already sets the width and the reservation would only add
  padding.
- **Found:** 2026-07-28, hero-playground review point 30 (overlay jumps while
  paging months).

### ~~docs-gen extracts `Pick<X, …>` in an extends clause as one prop named "...Pick"~~ — fixed 2026-07-30

- **Cause:** the heritage handling knew only `Omit`. `Pick<ButtonProps, …>`
  matched no branch (no `*Variants` suffix, no `Omit` prefix, and `Pick` itself
  is a lib type alias, not an interface), so it fell through to the unknown
  placeholder, which builds `...${typeName}` — hence `...Pick`.
- **A syntactic fix could not have worked**, which is the reusable part: of
  CopyButton's five picked members only `disabled` is a `PropertySignature` on
  `ButtonProps`; `variant`/`intent`/`size`/`tier` arrive through
  `VariantProps<typeof buttonVariants>` and live as `PropertyAssignment`s in
  `button.variants.ts`. Only the TypeChecker joins both sources. The fix
  therefore resolves the clause through the shared `ts.Program`, takes
  documentation from the declaration but *type and values from the checker* —
  the symbol of a mapped-type property points at the declaration it was mapped
  from, so a variant axis' `declaration.type` reports the tv() config object
  (`{ calm: unknown; loud: unknown }`) instead of `'calm' | 'loud'`.
- **Class measured, not assumed:** an AST scan over 1165 `.ts` files of all
  packages and apps found `Omit` 105×, `Pick` 2× (CopyButton, JourneyTimeline),
  `Partial` 1× and `Record` 1× (neither on a `*Props`), and nothing else. The
  placeholder path is hardened anyway: an unresolved utility type is now named
  after its *base* (`...PickLocalBaseProps`), never after itself.
- **Effect on the generated output, diffed against the same tree state:** 2 of
  107 components changed, all 105 `Omit` cases byte-identical. CopyButton gains
  the five members with real literal unions; JourneyTimeline's
  `Pick<JourneyTimelineVariants, 'orientation' | 'size'>` is now read
  symmetrically to `Omit`, so six per-node internals (`connectorStyle`,
  `focused`, `interactive`, `status`, `travelled`, `withMeta`) correctly stop
  being component props.
- **The workaround it replaces is gone:** the CopyButton playground dropped its
  hand-written `tier`/`disabled` overrides and the option lists of
  `variant`/`intent` entirely; only the two `defaultValue`s stay, because those
  defaults live in `CopyButton.svelte` rather than as a prop `@default`.
- **One follow-up defect fell out of it**, caught by the docs-app check rather
  than docs-gen's own: the resolved members carry `values`, but the emitted
  one-line `InheritanceProp` interface did not declare it — 4 type errors in the
  generated `api.ts`. Fixed, and the existing "emitted interface covers the
  emitted data" guard was extended one level down to `inheritance[].props[]`,
  which is where it slipped through.
- **Left open:** the `Omit` path still parses its arguments with a regex over
  the clause text (`/Omit<([^,]+),\s*([^>]+)>/`), which breaks on a base with a
  comma in its type arguments. Nothing hits it today; the new
  `heritageBaseTypeText`/`heritageKeyArgText` helpers would fix it, but the
  switch wants verification across all 105 sites.
- **Found:** 2026-07-28, hero-review point 28; closed 2026-07-30.

## Design engine

### ~~"slop" is the public name of the second score axis, and it is the wrong word to say out loud~~ — renamed 2026-07-30

- **Resolved:** the axis is `craft`, a single finding is a **craft note**, and the
  flag is `--craft-floor`. `SLOP_WEIGHT` became `CRAFT_PENALTY` (it is a deduction,
  not a virtue — the name now says which direction it moves the score); the local
  finding factory in `heuristics.ts` is `craftNote()`. Polarity was already right
  (100 = good) and stayed untouched — no operator flipped, no `100 - x` inverted.
- **Two spots were not mechanical**, and both were resolved with the house maxim
  *read tolerant, write strict*:
  - **Stored consumer histories.** `manifest/history.ts` validated
    `typeof e.slop === 'number'` and skipped invalid lines **silently**, so a bare
    rename would have made every existing `design.manifest.history.ndjson` parse as
    `[]` with nothing to see. The reader now accepts `e.craft ?? e.slop` and
    normalises to `craft`; the writer emits `craft` alone, so a file converges on
    the current key the first time it is appended to. Regression-tested both ways
    (a `"slop": 70` line reads back as `craft: 70`; a re-serialised entry contains
    no `slop`).
  - **The CLI flag.** `checkFlags` rejects an unknown flag with exit 2, and the
    Levenshtein hint cannot rescue this one (`slop-floor` → `craft-floor` is 5
    edits; the length-scaled threshold is 3). `--slop-floor` survives as an
    unadvertised alias in `DEPRECATED_FLAG_ALIASES` — absent from `COMMAND_FLAGS`
    and from `--help`, so nothing teaches the dead name — folded to `--craft-floor`
    before dispatch, with a deprecation notice on **stderr** so the `--json`
    envelope on stdout stays parseable.
- **Prose that inverted, not just renamed:** `adopt.md` ("the slop-floor score is
  how generic it reads today") and `compose.md` ("lower is more generic") both read
  exactly backwards under `craft` and were rewritten rather than substituted.
- **Left standing on purpose:** `rubric.ts` ("Penalise AI-slop sameness") — there
  "slop" names the failure being judged, not the axis. Fixtures under
  `prototypes/**` (not a workspace member) still carry `"slop"` keys; the tolerant
  reader covers them.
- **Found:** 2026-07-30, landing polish (Felix, on the Agents tile); the
  intent to rename predates it, but was never written down. Renamed the same day,
  with the landing's Agents tile re-recorded from the real command afterwards.

### `token-hallucination` is a warning, so markup that renders unstyled passes an error gate

- **Where:** `packages/design-engine/src/linter/rules.ts:376`
  (`severity: 'warning'`) vs. `evaluateGate` / `urbicon validate`, which blocks on
  errors and treats the craft axis as opt-in.
- **What:** A component whose colour utilities all reference non-existent tokens
  scores **correctness 25 with zero errors** — measured, not hypothetical. A
  recorded baseline run (no design grounding in the prompt) first used raw
  Tailwind colours, and when the linter rejected those, the fix round replaced
  them with token-*shaped* names that do not exist (`bg-surface-raised`,
  `text-text-muted`, `text-text-inverse`, `bg-surface-inverse-hover`). The
  `raw-tailwind-color` errors disappeared, 15 hallucination warnings appeared,
  and the result renders with no styling at all while looking system-conformant
  in review.
- **Why it is not just severity tuning:** a hallucinated token is a dead
  reference, not a matter of taste — the axis assignment (it already lowers
  *correctness*, not craft) and the severity disagree. Promoting it to `error`
  is a gate-breaking change for existing consumers, so it needs a decision:
  promote, or gate on a correctness floor rather than on error count.
- **Found:** 2026-07-26, artifact-recorder spike (`prototypes/artifact-frame`).

### ~~The CSS reference teaches no z-index tokens, but the linter requires them~~ — withdrawn 2026-07-27, the reference does teach them

- **The claim was wrong.** `css-reference.ts` ships the full `--z-*` scale (12
  tokens with their intended layer, plus the `z-[var(--z-modal)]` usage form) in
  its `shadows` section, and the overview announces it verbatim as
  "`shadows` — 5 shadow tokens + z-index scale". Asking for the wrong section
  name already fails loudly and lists the real ones (`urbicon css-reference
  z-index` → "unknown section … Available: surfaces, text, borders, intents,
  shadows, typography, theming"), so the discovery path works too.
- **What actually produced the reproducible `z-10`:** the spike's own injected
  grounding, which pulled only `surfaces`, `text` and `borders` into the prompt
  (`prototypes/artifact-frame/recorder/grounding.ts`). The model never saw the
  z-index scale because the harness never sent it. The recorded run that used
  the **real CLI** instead of injected context fetched `css-reference shadows`
  itself (call 26 of 40) and produced zero errors — the same task, the same
  model, no z-index finding. Fixed in the harness; nothing to fix in the engine.
- **Kept as a note rather than deleted**, because the wrong diagnosis is the
  reusable part: a gap in a hand-assembled prompt reads exactly like a gap in
  the knowledge base. Before filing "the CLI doesn't teach X", check what the
  harness actually sent — and prefer the measurement where the model serves
  itself, since that is the consumer path.
- **Found:** 2026-07-26, artifact-recorder spike; withdrawn 2026-07-27 after
  re-reading the reference and the recorded CLI transcript.

### ~~The CLI silently ignores unknown flags, so an agent cannot tell a typo from a result~~ — fixed 2026-07-27

- **Resolved:** `packages/design/src/cli/command-flags.ts` declares the flags
  each command reads, and `index.ts` rejects anything else with a usage error
  (exit 2) before the command runs — with a did-you-mean suggestion for typos
  (`--limitt` → `--limit`). `--query` is accepted as an alias for the positional
  on `find` and `icons`, the two discovery commands agents reached for it on;
  giving the query twice is an error rather than a precedence rule. The same
  fail-loud treatment now covers a value flag passed bare (`urbicon icons
  --limit` used to fall back to the default in silence) — the identical
  silent-answer failure, found while fixing the first one.
- **Consumer-visible behaviour change:** a call that used to be quietly ignored
  now exits 2. `urbicon verbs --json` is the concrete case — `verbs` reads no
  flags, so it printed plain text and exited 0; it now reports that it takes no
  flags. That is the point of the fix (the caller wanted JSON and did not get
  it), but it can break a script that passed a flag the CLI never honoured.
- **Two documentation drifts fell out of the guard test**, which diffs the flag
  table against `--help`: `i18n --function-names` and `--runtime-usage` were
  implemented and undocumented, and `hook` described its gate flags in prose that
  omitted `--skip-heuristics`. Both corrected.
- **Found:** 2026-07-26, artifact-recorder spike — the run that used the real
  CLI as its only knowledge source (`prototypes/artifact-frame`); fixed
  2026-07-27.

### ~~The ADR log's `status` field is inert, and the log cannot express supersession~~ — fixed 2026-07-30

- All three defects settled, in the shape the entry proposed:
  `record-decision --supersedes <title>` sets **both** ends (the old entry gets
  `**Status:** superseded` + `**Superseded by:**`, the new one `**Supersedes:**`)
  and fails with exit 2 on an unknown or ambiguous title *before writing
  anything* — a test asserts the file is byte-identical after such a call.
  `appendDecision` now inserts by date instead of always on top. And `superseded`
  is **honoured rather than dropped**: `urbicon context` moves those entries out
  of the active list into a "Superseded — the history, not the current stand"
  block, so the log stays append-only while a reader sees which stands were tried.
- **Why honour it rather than drop the value**, given the entry's own measurement
  that the model is unaffected: the manifest is also a document for people, and
  dropping `superseded` would have thrown away the chain along with the field.
- **Backwards compatible:** the parser reads tolerantly (missing fields →
  `undefined`, a hand-written `Superseded by: X (2026-06-20)`, `Status:
  Superseded` case-insensitively) and writes strictly — the house rule. Two tests
  cover old manifests.
- **Found:** 2026-07-27, wiring per-session manifests into `apps/artifact-studio`;
  closed 2026-07-30.

### ~~The CLI has been fixed four times for the same failure — it needs one audit, not a fifth fix~~ — swept 2026-07-30

- **The sweep ran over all 18 commands × the four questions** (unread positional,
  out-of-range enum, missing required argument, a name a caller reaches for
  before the canonical one), each finding reproduced against the running CLI
  rather than read out of the source.
- **The worst find was not on the list:** `urbicon validate` with no path and
  empty stdin (a CI step, a harness) linted the empty string and reported
  "✓ no issues", exit 0 — **the gate passed on nothing**. Now exit 2.
- **Second worst:** `urbicon i18n prity` read the typo as a source directory,
  found no sources, and therefore reported *every defined key as unused* — exit
  0. A typo and a real result were indistinguishable.
- **Generic fix rather than a handful of ifs:** a `COMMAND_POSITIONALS` table
  beside `COMMAND_FLAGS` declares how many positionals each command reads and
  where a stray one belongs; `index.ts` checks it, and a test forces an entry per
  dispatched command. That closed the silent-swallow class across 9 commands
  (`init`, `hook`, `primer`, `context`, `record-decision`, `sync-manifest`,
  `verbs`, plus the second positional of `get-component`/`pattern`/`recipe`/
  `guide`/`css-reference`).
- **Also fixed:** `find --tag <unknown>` said "no components" instead of failing ·
  `i18n --runtime-usage` ignored a non-array JSON file completely, silently
  falsifying the unused report · `--limit` was honoured only together with a
  query, so `urbicon icons --limit 5` printed all 315 icons · `urbicon help
  <command>` printed the whole 9.5 kB page (the `--help` case in the other
  spelling) · `get-component Button` — the name the caller sees in the code *and*
  in `find`'s own output — failed with "Invalid component slug" and now resolves
  through the catalogue.
- **Deliberately no alias inflation:** `principles --topic` already lists all six
  topics on failure (unlike the z-index case, nothing is hidden), and
  `guide table` / `sync-manifest <dir>` stay fail-loud with an exact hint.
- **Consumer-visible:** seven call shapes that used to exit 0 now exit 2 — see
  the release notes for the list. `urbicon validate` with empty stdin is the one
  that can turn a currently-green CI red, which is precisely the fix.
- **Left open (own decision):** `pattern`/`recipe`/`guide` exit **1** on an
  unknown name while `css-reference`/`principles`/`verb` exit **2**. Both are
  loud, but the exit-code contract is inconsistent; unifying it is a breaking
  change of its own.
- **Found:** 2026-07-28, after the fourth instance; swept 2026-07-30.

### A citation chip inside a markdown paragraph makes SSR emit invalid HTML

- **What:** `MdBlock` renders a paragraph as `<p>…</p>`, `MdInline` renders a
  `[1]` marker as a `CitationChip`, and the chip is a `Popover` — whose trigger
  wrapper and panel are both `<div>`. A `<div>` inside a `<p>` is invalid HTML,
  so the browser closes the paragraph early while repairing it, and the client
  tree no longer matches the server's.
- **Measured (2026-07-28, Playwright, dev server):** three docs pages log
  `[svelte] hydration_mismatch` on load — `/blocks/components/citation-chip`,
  `/blocks/components/streaming-markdown` and `/blocks/components/chat-message`
  — each preceded by two `node_invalid_placement_ssr` warnings naming
  `Popover.svelte:411` (`<div class="inline-flex">`, the trigger wrapper) and
  `Popover.svelte:463` (the panel) as children of `MdBlock.svelte:23`.
- **Scope:** every SSR-rendered chat answer that cites a source, which is the
  headline case of the AI kit. Not a docs-site problem — the docs pages are just
  where it is visible.
- **Why it is not a quick fix:** the trigger wrapper could take an element name
  (`<span class="inline-flex">` when the trigger sits inline), which would settle
  the first half. The panel is the harder half: it already moves to the top layer
  at runtime, but SSR emits it in place. Either it renders nothing on the server
  until mounted — changing first-paint behaviour for every Popover consumer — or
  the inline case gets its own markup path. Both need a VR pass over the whole
  overlay family.
- **Found:** 2026-07-28, while measuring the ChatMessage playground rebuild
  (review point 18); pre-existing, unrelated to that change — `citation-chip`,
  which the rebuild did not touch, shows the same warning.
