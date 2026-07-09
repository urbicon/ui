# Technical Debt

Small, non-blocking findings surfaced in passing that don't belong to the task
at hand and can't be fixed on the fly — they need a design decision or a broader
sweep. Logged here so they aren't lost. Actively planned work lives in the
internal TODO instead.

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
- **Found:** 2026-07-07, while adding `calendar.variants.test.ts` (the
  `never dark:` slot sweep passes because this is a fixed colour, not a `dark:`
  override — the token gap is orthogonal).

## Testing

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
  That is its own small package — fixture route, docs-app rebuild, spec — beyond
  the test-writing task in flight.
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
  in exactly the drift the files' mirror-comment warns against. That is a small
  deliberate sweep, not a range-specific addition to the task in flight. Low
  severity: the observable results (field clears; hidden value serializes) are
  simple and unlikely to regress silently.
- **Found:** 2026-07-08, in the pr-test-analyzer review of the new
  `DateRangePicker.svelte.test.ts` (flagged low/optional, shared-with-sibling).

### e2e visual snapshots are `chromium-darwin`-only — Linux CI can't verify them

- **Where:** `e2e/snapshots/**` (all committed PNGs, incl. the new
  `visual-regression.spec.ts-snapshots/**`) and `.github/workflows/ci.yml` (the
  `e2e` job, `runs-on: ubuntu-latest`).
- **What:** Every committed Playwright screenshot is stamped `-chromium-darwin`.
  Playwright resolves snapshots per platform, so on Linux (CI) it looks for
  `-chromium-linux.png`, finds nothing, and hard-fails. The whole e2e-visual layer —
  `floating.spec.ts`, `guide.spec.ts`, and now `visual-regression.spec.ts` (the
  10-primitive × light/dark × library/editorial matrix) — is therefore darwin-only.
  The new suite is explicitly `test.skip`-gated to darwin so it adds no red to the CI
  e2e job; the pre-existing floating/guide specs are NOT gated (they already fail on
  Linux — the "CI-optional until stable" state the TODO records).
- **Why deferred:** Making the visual layer CI-green needs per-platform baselines,
  which can't be produced on a macOS box: either (a) generate `-chromium-linux`
  baselines via the official `mcr.microsoft.com/playwright` Docker image and commit
  both platforms, (b) add a macOS runner for the e2e job, or (c) a one-off CI bootstrap
  that runs `--update-snapshots` on Linux and commits the result. Each is an infra
  decision spanning all three specs, not a change to the suite in flight — logged
  rather than solved here.
- **Found:** 2026-07-08, adding the primitive visual-regression suite; the CI job runs
  `bunx playwright test` on `ubuntu-latest` with no `continue-on-error`.

### `useSorting` contract test is flaky in the full-suite run

- **Where:** `packages/table/src/lib/stores/concerns/concerns.test.ts`
  (`useSorting > contract: handleSort cycles through asc → desc → off`).
- **What:** In a full `bun run test` sweep the test failed once; re-running the
  file in isolation AND re-running the whole table suite immediately afterwards
  both passed (243/243). So the failure is order- or timing-dependent, not a
  code regression — likely shared state between tests or a timing assumption in
  the sort-cycle contract.
- **Why deferred:** Flakiness needs its own investigation (repeat runs, seed /
  isolation bisection), which is unrelated to the docs-layout work in flight.
  Until then a red `useSorting` in CI should be re-run before being believed.
- **Found:** 2026-07-09, during the docs-layout redesign's full-suite gate.

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

## Component behaviour

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
