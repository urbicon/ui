# Technical Debt

Small, non-blocking findings surfaced in passing that don't belong to the task
at hand and can't be fixed on the fly — they need a design decision or a broader
sweep. Logged here so they aren't lost. Actively planned work lives in the
internal TODO instead. Sections are ordered roughly by urgency.

## Packaging / distribution

### mcp-server bin is not runnable under node/npx

- **Where:** `packages/mcp-server/package.json` (`bin` → `./src/index.ts`,
  `build` script is a no-op echo) and `src/index.ts` (`#!/usr/bin/env node`
  shebang, relative `.js` specifiers resolving to `.ts` files).
- **What:** `npx @urbicon-ui/mcp-server` crashes — node cannot execute the
  TypeScript entry nor resolve the `.js`→`.ts` specifiers. Even plain `bunx`
  fails because it respects the node shebang.
- **Why deferred — and de-escalated (Option B, 2026-07-10):** no consumer runs
  this bin anymore. The local-install MCP path was removed from the public docs
  (`/ai` now leads with `@urbicon-ui/design` + `urbicon init`; the CLI ships a
  real node-runnable `dist/cli.js`), and the server's only intended deployment
  is the hosted HTTP endpoint at launch — run in-repo under Bun. Resolve
  together with that hosting decision: either ship a dist build then, or drop
  the `bin` field entirely and commit to bun-on-own-infra.
- **Found:** 2026-07-10, docs-launch triage quick-fix pass (§3 of
  `docs/internal/DOCS-PAGE-TRIAGE-2026-07.md`); rescoped same day with the
  Option-B de-advertising of the MCP.

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

### Table's `resolveSlotClass` concatenates past the tv() conflict fold — slotClasses can't beat base utilities

- **Where:** `packages/table/src/lib/core/table-style-context.ts`
  (`resolveSlotClass`: `[variantClasses, slotClass, extra].join(' ')`), used by
  every table subcomponent; concretely bitten on the `table` slot
  (base `min-w-[600px]`).
- **What:** For **blocks** this is resolved since the 2026-07-08 tv() engine
  rework: components pass `slotClasses` as the call-site `class` into the slot
  function, and the fold strips same-bucket conflicts (verified:
  `min-w-[600px]` + class `min-w-0` → `min-w-0` wins). The **table** package
  bypasses that path — its own `resolveSlotClass` string-concatenates outside
  the fold, so `slotClasses={{ table: 'min-w-0' }}` still renders both classes
  and stylesheet order decides; the landing had to use `!min-w-0`.
- **Why deferred:** The fix is mechanical but broad: route table's slot
  application through `tableStyles.<slot>({ class: [slotClass, extra] })`
  across all subcomponents (~17 slots), with a visual pass. Should be one
  deliberate sweep, not a per-call-site patch.
- **Found:** 2026-07-09 (original), re-verified + rescoped to table-only
  2026-07-10 after the engine fold landed.

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

## Accessibility

### PlaygroundConfigurator control hints carry an orphaned `-hint` anchor id

- **Where:** `packages/docs/src/lib/components/PlaygroundConfigurator/PlaygroundConfigurator.svelte`
  (`<div class={slot('controlHint')} id="{control.key}-hint">` in the controls
  `{#each}`).
- **What:** The per-control description renders with an anchor id that nothing
  references — none of the control branches (text, checkbox, select, color,
  slider) set `aria-describedby="{control.key}-hint"`, so assistive tech never
  associates the hint with its control. The id is dead weight today.
- **Why deferred:** Wiring it up touches every control branch in the `{#each}`
  (and the hint only renders while `helpVisible` — the `aria-describedby`
  should appear/disappear in sync). Wants one small pass over the configurator
  rather than an inline patch. Docs-package only, no library consumer impact.
- **Found:** 2026-07-10 (silent-failure review of the P1 `hint`→`helper`
  rename; pre-existing, not a regression of that rename).

### `Select` spreads `aria-label` onto its role-less wrapper — surfacing as the LocaleSwitcher axe hit

- **Where:** `packages/blocks/src/lib/primitives/Select/Select.svelte`
  (`{...restProps}` lands on the `base` `<div>`; the trigger button names
  itself only via `aria-labelledby={labelId}`), consumed by
  `LocaleSwitcher.svelte` (passes `aria-label` to Select), visible in the docs
  sidebar chrome on every page.
- **What:** An axe scan (WCAG 2.1 AA) reports `aria-prohibited-attr` —
  `aria-label` sits on a plain `div` with no role — plus a `button-name` hit
  on the trigger when no visible `label` prop is set (then `labelId` points
  nowhere and the trigger has no accessible name). The e2e a11y suite scopes
  to `[data-docs-preview]`, so the chrome instance never gates.
- **Why deferred:** The fix belongs in Select (forward `aria-label`/labelling
  to the trigger element rather than the wrapper, or accept a dedicated
  `triggerLabel` prop), then LocaleSwitcher inherits it. Changes markup for
  every Select consumer, so it wants its own pass with the DOM tests.
- **Found:** 2026-07-09 (axe over `/blocks`), root cause narrowed to Select's
  restProps target 2026-07-10.

### Rooms-skin secondary text on accent fields misses WCAG AA contrast

- **Where:** `apps/docs/src/lib/style/rooms-docs.css` — the shared
  `[data-docs-sticky-bar] / [data-docs-header] / [data-room-hero]` block remaps
  `--color-text-secondary` (and `--docs-soft`, which `meta-marker`/`font-meta`
  read) to `color-mix(in oklab, var(--room-accent-fg) 74%, transparent)`.
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

### docs `CodePanel` code view: unnamed `role="textbox"` + Shiki comment tokens below AA

- **Where:** `packages/docs` code panel (`data-docs-stage="example"` →
  `[role="textbox"][aria-readonly="true"]`) and its Shiki theme (comment token
  `#B8B5AD` on the cream `#fbfaf6` panel).
- **What:** axe reports `aria-input-field-name` (serious) on the read-only
  code textbox of every `CodeExample` (it has no accessible name), and
  `color-contrast` 1.96 on syntax-highlighted comment lines. Affects every
  docs page that renders code, on every route.
- **Why deferred:** Both fixes live in the docs package, not in any page:
  the textbox wants an `aria-label` derived from the panel title, and the
  comment token wants a darker stop from the warm-neutral ramp picked against
  both panel grounds. Library change + visual sweep across all code panels.
- **Found:** 2026-07-10, axe over the rebuilt `/getting-started` build guide.

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

## Testing / CI gates

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

### No standing e2e guard for Dialog/Drawer modal promotion

- **Where:** `e2e/` (no dialog/drawer spec) and
  `apps/docs/src/routes/test-fixtures/` (no dialog/drawer fixture).
- **What:** The Dialog/Drawer `showModal()` ref-bind bug (fixed 2026-07-07 —
  `showDialogModal` ran in the same effect tick that set `isVisible`, before
  `bind:this` assigned the dialog element, so it captured `undefined` by value
  and silently no-op'd; the overlays never actually entered the top layer, so
  there was no initial panel focus and `:modal` never matched → nested overlays
  hit the iOS #23 path). It is now covered at the unit level
  (`Dialog.svelte.test.ts` asserts `dialog.open` via the jsdom `showModal` stub)
  and was verified once in Chromium (`:modal` + focus moved into the panel), but
  jsdom cannot assert `:modal` / top-layer, so there is no *standing* browser
  regression guard.
- **Why deferred:** A robust guard wants a dedicated `test-fixtures/dialog` (+
  `-drawer`) route and spec (à la `floating.spec.ts`), not a brittle assertion
  against the docs playground page (which also needs an SSR→hydration retry).
  That is its own small package — fixture route, docs-app rebuild, spec.
- **Found:** 2026-07-07, while adding the jsdom interaction tests for
  Select/Menu/Dialog; the test-quality review surfaced the latent showModal bug.

### `DatePicker` / `DateRangePicker`: two shared commit-path branches untested in both pickers

- **Where:** `packages/blocks/src/lib/components/DatePicker/DatePicker.svelte` +
  `DateRangePicker.svelte` (`commitDraft`'s empty-draft branch; the hidden-input
  `serialize` / `hiddenValue` path when `valueFormat='iso'`), and their two
  co-located `*.svelte.test.ts` files.
- **What:** Two glue branches are covered for neither picker:
  1. **Typed-empty clear** — emptying the field by selecting-and-deleting the text
     (not the clear button) drives `commitDraft`'s `trimmed === ''` branch, which
     fires `onValueChange(undefined)`. The suites only cover the clear-*button*
     path (`handleClear`), a different function.
  2. **`valueFormat='iso'` serialization** — the hidden form input's ISO branch
     (`d.toISOString()`, for Drizzle/timestamp consumers per the JSDoc). Only the
     `'date'` default (`YYYY-MM-DD`) is asserted.
- **Why deferred:** Both are *shared* mechanics the two pickers mirror ~90% of, so
  the fix belongs in both `*.svelte.test.ts` at once — a one-sided add would bake
  in exactly the drift the files' mirror-comment warns against. Low severity: the
  observable results are simple and unlikely to regress silently.
- **Found:** 2026-07-08, in the pr-test-analyzer review of the new
  `DateRangePicker.svelte.test.ts` (flagged low/optional, shared-with-sibling).

### `useSorting` contract test is flaky in the full-suite run

- **Where:** `packages/table/src/lib/stores/concerns/concerns.test.ts`
  (`useSorting > contract: handleSort cycles through asc → desc → off`).
- **What:** In a full `bun run test` sweep the test failed once; re-running the
  file in isolation AND re-running the whole table suite immediately afterwards
  both passed (243/243). So the failure is order- or timing-dependent, not a
  code regression — likely shared state between tests or a timing assumption in
  the sort-cycle contract.
- **Why deferred:** Flakiness needs its own investigation (repeat runs, seed /
  isolation bisection). Until then a red `useSorting` in CI should be re-run
  before being believed.
- **Found:** 2026-07-09, during the docs-layout redesign's full-suite gate.

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

## Design tokens

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
