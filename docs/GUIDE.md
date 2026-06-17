# Guide System

The **`Guide`** component family is a bidirectional in-app help system: a non-modal help
panel, contextual hints, UI↔guide links, and an opt-in guided tour — all over *one* headless
engine. Shipped in **v5.8.0**, stability **beta**. Lives on `@urbicon-ui/blocks` (no separate
package).

This is the living architecture/usage reference. The full phase-by-phase build history (Phasen
0–8, incl. every "Abweichung vom Plan") is archived at
[archive/2026-06/GUIDE-ROADMAP.md](archive/2026-06/GUIDE-ROADMAP.md).

Cross-refs: [ARCHITECTURE.md](ARCHITECTURE.md) (tokens, i18n, provider pattern),
[COMPONENT-FAMILIES.md](COMPONENT-FAMILIES.md) (primitive taxonomy — Guide is deliberately *not*
in it, see D6), [COMPONENT-DECISION-MATRICES.md](COMPONENT-DECISION-MATRICES.md)
(Sidebar/Drawer/Popover choice — relevant to D1), [SVELTE5-PATTERNS.md](SVELTE5-PATTERNS.md).

---

## 1. What it is

`Guide` is the library's first **sequential, system-driven** overlay pattern. Every other
overlay (Tooltip, Popover, Dialog, Menu) is *spatial and event-driven* — the user clicks,
something appears *there*. `Guide` inverts that: the system decides *when*, *in what order*,
and *in which mode* help appears.

The value is **not** the tour mechanic (product tours are rightly distrusted) but three design
principles:

1. **Helpful, not intrusive.** The defaults are the *callable* help panel and the *waiting*
   hint — not a modal forced tour. The scrim-modal guided tour is the most aggressive mode and
   stays **opt-in**.
2. **One shared namespace.** Every UI spot with a help identity carries `data-guide="<topic-id>"`.
   Tours, markers, hints, and article references all resolve through that one namespace — it
   connects the modes instead of duplicating them.
3. **Bidirectional.** UI ↔ Guide is linkable in both directions (§4) — the actual
   differentiator versus Joyride/driver.js/Shepherd.

### Modes (surfaces over one engine)

| Mode | Intrusiveness | Purpose |
|---|---|---|
| **Sidebar help panel** (`GuidePanel`) | callable, self-directed | Structured in-app reference (the main focus) |
| **Contextual hint** (`GuideHint`) | waiting, non-blocking | Micro-help at the right element at the right time |
| **Bidirectional link** (`GuideMarker` ↔ `GuideMention`) | passive | UI explains itself; the article points back at the UI |
| **Guided tour + spotlight** (`Guide`, `GuideBeacon`) | modal/blocking | Critical first-run flows, **opt-in** |

---

## 2. Architecture

### Headless engine + swappable surfaces

```
            ┌──────────────────────────────────────────────┐
            │  GuideController  (utils/guide.svelte.ts)     │
            │  Class · $state · untrack · SvelteMap/Set     │
            │                                               │
            │  #targets: SvelteMap<id, RegisteredTarget>    │
            │  activeTour · stepIndex · highlightedId       │
            │  panelOpen · activeArticle · panelId · #seen  │
            │                                               │
            │  registerTarget()/target() · resolveTarget()  │
            │  startTour() next() prev() skip() finish()    │
            │  stopTour() · reapplyStepHighlight()          │
            │  highlight(id) / clearHighlight()             │
            │  openPanel(article?) / closePanel()           │
            │  hasSeen()/markSeen()/resetSeen() ← Storage    │
            └───────────────────────┬──────────────────────┘
                       createOptionalContext<GuideController>()
                                     ▼
   Surfaces (consume the controller via context):
     • GuidePanel + GuideArticle  — non-modal help panel (main focus)
     • GuideMarker                — direction A: UI → panel (ⓘ trigger)
     • GuideMention               — direction B: article → UI highlight (additive ring)
     • GuideHint                  — contextual, waiting hint
     • Guide + GuideBeacon        — guided tour + spotlight (opt-in)
```

- **Engine** (`packages/blocks/src/lib/utils/guide.svelte.ts`) is a `class` modeled on
  `overlay-stack.svelte.ts` (`$state` + `untrack`, no string context keys). **Completely
  UI-free** and unit-tested in isolation (`guide.svelte.test.ts`, node env). This is the
  valuable part.
- **Surfaces** are thin views in `packages/blocks/src/lib/components/Guide/*` that consume the
  engine via `createOptionalContext` — a surface used **without** a `GuideProvider` renders
  inert (or as plain text for `GuideMention`) instead of throwing `missing_context`.
- **No separate package.** The UI depends fundamentally on `floating`/`Portal`/`overlay-stack`
  (all in `blocks`); a separate package would only create peer-dependency friction (same reason
  `CommandPalette` stayed in `blocks`).

### Boundary: engine/UI in the library, content in the consumer app

The library ships **engine + presentation**. The guide *definition* (which steps, which texts,
which selectors, which articles) belongs in the **consumer app**. This keeps consumer i18n
content out of the library and prevents over-engineering. `GuideTour` / `GuideStep` /
`GuideArticle` content is authored by the consumer.

### Reused building blocks (zero-dependency contract)

`packages/blocks` has no runtime dependencies, so an external tour library (driver.js, Shepherd)
is out — and unnecessary, because the expensive parts already exist:

| Guide needs… | Existing building block |
|---|---|
| Anchor a bubble/hint to a target (flip/shift/arrow) | `utils/floating.ts` (`computePosition` + `autoUpdate`) |
| Coexist with / pause around foreign overlays | `utils/overlay-stack.svelte.ts` (`depth`, `isTop`, `register`) |
| Position the panel as a sidebar | `Sidebar` mechanics + `Drawer` styling (D1) |
| Localize next/prev/skip/done | `@urbicon-ui/i18n` (runes-based, keys under `guide.*`) |
| Engine state (class + `$state` + `untrack`) | model: `overlay-stack.svelte.ts` |

**Genuinely new:** only the **engine/registry** (state machine + topic resolution + persistence)
and the **spotlight mask** for the tour. Everything else is composition.

---

## 3. The `data-guide` namespace

Two ways to mark an element as a guide target, both feeding the **same** registry — so a tour
step, a hint, a marker, and a mention can all point at one id:

1. **`data-guide="topic-id"`** — declarative, framework-agnostic, robust, placeable even on
   elements the consumer doesn't render itself. Resolved via `querySelector` fallback.
2. **`{@attach controller.target('topic-id', { label, article, direction })}`** — programmatic,
   carries metadata, reactive binding, auto-cleanup (`{@attach}`, **not** `use:`).

A single `highlight(topicId)` in the engine serves **both** tour steps **and** the Mention→UI
hover — one mechanism, multiple surfaces.

**Two layers (D3).** The `data-guide` anchors are the **anchor layer** (*where* an element is —
necessarily declarative & distributed). On top sits an optional, typed **structure layer**: a
`defineGuide([...])` manifest describing *which* tours/articles exist in *what* order, referencing
`data-guide` ids as a string union. The manifest does **not** resolve targets itself — that
separation is what makes the DEV-mode warning valuable (manifest names id X, engine can't find X
in the DOM → warning). Repo precedent: `TypedColumnBuilder` (table columns), `createPackageI18n`
(i18n).

**Resilience.** In DEV, any tour step / mention / highlight pointing at an id that can't be
resolved logs a warning instead of failing silently. A lazily-rendered target is observed and
re-anchored once it appears; a vanished one falls back gracefully (§6).

---

## 4. Bidirectional link (the differentiator)

Both directions share the `data-guide` namespace and the same `highlight()` primitive.
Per topic/surface configurable: `direction?: 'to-guide' | 'to-ui' | 'both'` (default `both`) —
so uni- or bidirectional is a deliberate option, resolved by `resolveDirection(id, override?)`
(a surface-level override wins over the topic's registered direction).

**Direction A — UI → Guide** (`GuideMarker`): a discreet "ⓘ" trigger on a UI element. Activation
(click/Enter/Space) opens the `GuidePanel` at the matching article. A real `<button>` with
`aria-controls` (the panel's published id) + `aria-expanded`. Inert when the direction is
`'to-ui'`. → *"I see this element and want to know what it does."*

**Direction B — Guide → UI** (`GuideMention`): an inline reference inside a `GuideArticle`. Hover
**or focus** (keyboard parity) highlights the real element (`[data-guide="…"]`) with a light
ring/glow + optional scroll-into-view; clicking scrolls it into view. Degrades to plain text when
the direction is `'to-guide'`. → *"I'm reading the article and want to see where the element is."*

**Highlight principle (D5):** **Tour = subtractive** (full scrim, the surroundings disappear)
· **Highlight = additive** (an `outline` ring + soft glow, the target is emphasized, nothing is
dimmed). Direction B uses only the additive ring via `outline` (not `border` → no layout shift at
the target), `prefers-reduced-motion`-aware. The full scrim is reserved for the spotlight tour.

---

## 5. Component inventory

| Name | `@tag`s | Role |
|---|---|---|
| `GuideProvider` | overlay, feedback | Context root; instantiates `GuideController`, injects the StorageAdapter (analogous to `BlocksProvider`) |
| `GuidePanel` | overlay, navigation | Callable, **non-modal** sidebar help panel |
| `GuideArticle` | display | Structured article in the panel (contains `GuideMention`s) |
| `GuideMention` | navigation | Inline article→UI reference (direction B) |
| `GuideMarker` | action, feedback | "ⓘ" UI→panel trigger (direction A) — *not* a status `Badge` |
| `GuideHint` | overlay, feedback | Contextual, non-blocking hint at an element |
| `Guide` | overlay, feedback | Tour renderer: bubble (`floating.ts`) + spotlight mask |
| `GuideBeacon` | feedback, action | Waiting hotspot — unobtrusive tour entry point |

Plus `controller.target(id, meta?)` — the attachment that registers/binds an element
programmatically.

Every `*Props` interface carries the mandatory JSDoc (`@description`, `@tag`, `@related`,
`@stability beta`) — the single source for the MCP server, `llms.txt`, and the docs site.
The seven surfaces additionally carry `@standalone`, which gives each its own MCP-catalog
entry and `llm.txt` (`find_components("guide")` lists all eight; `get_component("guide-panel")`
etc. work) despite the family sharing one `index.ts` and one docs page — unlike compound
subcomponents (TabItem, MenuItem), which stay folded into their directory component's entry.

**Family classification (D6):** Guide is a standalone **component family** (like `CommandPalette`,
`DatePicker`) — deliberately **not** a row in the six-family table of
[COMPONENT-FAMILIES.md](COMPONENT-FAMILIES.md), which describes the *primitives* taxonomy (border-
token source + tier system). The surfaces carry `@tag`s; the architecture lives here.

---

## 6. Tokens, z-index & top-layer discipline

`Dialog` uses a native `<dialog>` → a real top layer. A portaled tour bubble with an ordinary
z-index would vanish *behind* an open dialog. Therefore:

- Active tours/spotlight register in the `overlayStack`.
- The engine **pauses/dims** (`paused` getter) when `overlayStack.depth` grows from a *foreign*
  overlay; non-modal surfaces (`GuideHint`) hide while `overlayDepth > 0`.
- z-index is token-only. **`--z-guide: 1550`** (D4), between `--z-popover` (1500) and
  `--z-skiplink` (1600), drives the spotlight tour. `GuidePanel` inherits `--z-sidebar` (1350),
  `GuideHint` `--z-popover` (1500). The stacking guarantee versus a native `<dialog>` (browser
  top layer) comes from the `overlayStack.depth` pause, **not** from z-index.

Tunable tokens (defined in `blocks/src/lib/style/interaction.css`, the `[data-guide-highlight]`
rule in `index.css`):

- `--blocks-guide-scrim` (default `oklch(0 0 0 / 0.5)`) — the tour's dimming backdrop.
- `--blocks-guide-highlight-ring` (default `--color-primary`) — the additive Mention→UI ring.

---

## 7. Key decisions (D1–D6)

- **D1 — Panel placement: a standalone, *non-modal* `GuidePanel`.** It takes the `Sidebar`
  mechanics (coexists with the app) and only the `Drawer` styling/`slotClasses` pattern. `Drawer`
  is modal (`<dialog>.showModal()`, backdrop, focus trap) — that would break direction B (§4),
  which must hover a mention *and simultaneously* highlight the element behind the panel.
- **D2 — Marker naming: `GuideMarker`.** The interactive "ⓘ" is **not** a "Badge" (collision with
  the non-interactive status `Badge` primitive). It may still *look* like "ⓘ".
- **D3 — Topic definition: declarative anchors + a typed manifest (both, layered).** Anchors stay
  declarative & distributed; structure (tours/articles/order) comes from an optional typed
  `defineGuide([...])` manifest referencing `data-guide` ids (§3).
- **D4 — z-index: token `--z-guide: 1550`** for the spotlight bubble; stacking vs. native
  `<dialog>` comes from the `overlayStack.depth` pause, not z-index (§6).
- **D5 — Direction-B highlight: additive `outline` ring, no scrim.** Tour = subtractive, highlight
  = additive; `outline` (not `border`) → no layout shift; reduced-motion-aware (§4).
- **D6 — Family: standalone component family, not a row in the primitives table** (§5).

---

## 8. As-built contract (deviations now part of the API)

The build deviated from the original plan in ways that are now the intended contract:

- **`createOptionalContext`** (not `createContext`): surfaces render inert without a provider.
- **Controller-driven panel visibility** (`panelOpen`), not `bind:open` — single source of truth.
  The panel uses `inert` (not `aria-hidden`) when closed, and focus-sensitive Escape (non-modal
  courtesy). Closing from *within* returns focus to the opener (`aria-labelledby` on the header).
- **Native Popover API top-layer** (not `Portal`) for `GuideHint` and `Guide` — mirrors
  `Tooltip`/`Popover`. The tour is one `popover="manual"` shell (`pointer-events:none`) with an
  SVG even-odd scrim **and** the bubble inside.
- **`GuideMarker` opens on activation** (click/Enter/Space), not on bare focus (tab-friendly).
  `GuideMention` has **no** `aria-describedby` (the visible text is the accessible name).
- **Tour progress = dot row + "Step X of Y"** (not the `Stepper` primitive — too heavy for a
  ~22rem bubble). Step announcement via an always-present polite `aria-live` region (a sibling of
  the popover, so the first step is announced as a content *change*). Interactive steps use a
  two-zone Tab cycle (bubble ⇄ target) so the spotlit target stays keyboard-reachable; `aria-modal`
  is dropped on those steps.
- **Spotlight = SVG even-odd hole** following the target via `autoUpdate`; a non-interactive step
  lays a transparent blocker `<rect>` over the hole, an interactive step leaves it click-through.
- **Analytics hooks** on `GuideTour`: `onStep` / `onComplete` / `onSkip` (the real business value —
  the onboarding funnel + drop-off). Fired from the engine, defensively (a throwing callback can't
  corrupt tour state). `stopTour()` is analytics-silent (programmatic teardown, e.g. route change).
- **Action-gated steps** (`GuideStep.advance: 'action'`, default `'user'`): learning-by-doing —
  the footer's Next is rendered `aria-disabled` (still focusable, with an `aria-describedby`
  screen-reader hint, i18n `guide.actionRequired`) and ArrowRight is inert; the app advances
  imperatively via `controller.next()` once the user performed the real action (pair with
  `interactive: true`). The gate lives purely in the `Guide` renderer — the engine's `next()`
  is never blocked. Back/Skip stay available; the live region announces the gate per step.
- **Phase-8 hardening:** `observeTargetResolution` (rAF-coalesced MutationObserver) +
  `reapplyStepHighlight()` re-anchor and re-spotlight a target that renders *after* a step begins,
  and fall back to the centered scrim when one vanishes. The tour exit fades via a
  `view = liveView ?? heldView` snapshot that holds the last step's content through the popover
  transition. `GuidePanel` returns focus to its opener on close.

---

## 9. Recipe — cross-route tours

Mechanically, tours already survive client-side navigation: the controller lives in the
layout's `GuideProvider` and outlives route components; an unresolved step target falls back
gracefully to the centered, full-scrim bubble; and the `MutationObserver` in `Guide.svelte`
re-anchors as soon as the new route's `data-guide` element appears (the Phase-8 lazy-target
hardening, §8). What the library deliberately does **not** do is navigate — UIB stays
framework-agnostic, so the app triggers navigation in `tour.onStep`:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { GuideTour } from '@urbicon-ui/blocks';

  // App-side step → route map; the library knows nothing about your router.
  const stepRoutes: Record<number, string> = {
    0: '/dashboard',
    2: '/settings/billing'
  };

  const tour: GuideTour = {
    id: 'cross-route-onboarding',
    steps: [
      { target: 'dash-overview', title: 'Your dashboard', body: '…' },
      { target: 'dash-filter', title: 'Filter', body: '…' },
      { target: 'billing-plan', title: 'Your plan', body: '…' } // lives on /settings/billing
    ],
    onStep: ({ index }) => {
      const route = stepRoutes[index];
      if (route && route !== page.url.pathname) goto(route);
    }
  };
</script>
```

Rules of thumb:

- **Mount `<Guide />` (and the provider) in the layout, not in a route.** A route-local
  renderer unmounts on navigation, and its unmount cleanup calls `stopTour()` — the tour
  would silently end mid-flight.
- **The navigation gap is covered by design.** Between `goto(...)` and the new route's
  `data-guide` element appearing, the step renders centered over the full scrim; once the
  target mounts, the bubble re-anchors and the spotlight ring lands.
- **`stopTour()` vs. keep running.** Keep the tour running for an *intentional* in-tour
  navigation like above. Call `controller.stopTour()` when navigation invalidates the tour
  (logout, the user leaves the flow on their own) — it tears down **without** marking the
  tour seen and stays analytics-silent, so the tour can surface again later.
- Steps that land right after a navigation pair well with `advance: 'action'` (§8) when the
  navigation itself *is* the action being taught.

A declarative step 2 (`GuideStep.route` + an `onNavigate` hook on `GuideProvider`, the
consumer injecting `goto`) is deliberately deferred until the first real cross-route tour
sharpens the requirements — this app-driven recipe is the supported v1 pattern.

---

## 10. Non-goals / v2

Deliberately **out** of the first cut (avoiding over-engineering):

- Branching / conditional steps (branched tours by user answer)
- Built-in multi-page tour orchestration (declarative per-step routes, resume state) — the
  app-driven cross-route pattern is supported and documented as a recipe (§9)
- WYSIWYG tour editor / no-code authoring
- Built-in analytics persistence (we ship only the hooks, no backend)
- Server-driven remote guides (content from a CMS) — an adapter is conceivable, not v1

---

## 11. Where things live & how it's tested

| Concern | Location |
|---|---|
| Engine (state machine, registry, persistence, analytics) | `packages/blocks/src/lib/utils/guide.svelte.ts` |
| Lazy/vanishing-target watcher | `packages/blocks/src/lib/utils/observe-target.ts` |
| Surfaces | `packages/blocks/src/lib/components/Guide/*.svelte` |
| Context + panel context | `components/Guide/guide.context.ts`, `guide-panel.context.ts` |
| Variants | `components/Guide/guide.variants.ts` |
| Tokens / highlight CSS | `blocks/src/lib/style/{interaction,index,foundation}.css` |
| i18n keys (`guide.*`) | `blocks/src/lib/translations/{en,de}.ts` |
| Doc page (live examples) | `apps/docs/src/routes/blocks/components/guide/` |
| Recipe (Onboarding Flow + live analytics log) | `apps/docs/src/routes/recipes/onboarding-flow/` |
| MCP pattern | `design-system/patterns/onboarding-guide.md` |

**Tests.** Engine logic is node-unit-tested (`utils/guide.svelte.test.ts`,
`utils/observe-target.test.ts`). Component behaviour + a11y (axe) + light/dark visual snapshots
run via Playwright against `apps/docs/src/routes/test-fixtures/guide/`
(`e2e/guide.spec.ts`); the visual baselines are CI-optional (`e2e/snapshots/guide.spec.ts-snapshots/`).

**docs-gen caveat.** docs-gen extracts only local `*Props`/`*Variants`, not types imported from
`utils`. So `GuideController` / `GuideTour` / `GuideStep` / the analytics-event payloads are **not**
auto-expanded into the generated `api.ts` / `llms.txt`; the hand-authored API tables on the doc
page are the source of truth for them until docs-gen does cross-file type resolution.
