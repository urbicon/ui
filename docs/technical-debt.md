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
