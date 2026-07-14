# Component Families

> A taxonomy of the Urbicon UI primitives. Every component belongs to exactly one family, and the family determines its ARIA role, its border-token source, its tier-system membership, and the question a consumer should ask before reaching for it.
>
> This page is the canonical reference. Doc-page JSDoc `@tag` annotations follow the same taxonomy so that the MCP server, `llms.txt`, and the documentation site all agree.

---

## Why families exist

The library exposes ~35 primitives. Without a shared mental model, choosing between `Menu` and `Select`, or between `Sidebar` and `Drawer`, becomes a memorisation task. Families give every component a position on three axes:

1. **ARIA role** — what assistive technology calls it.
2. **Tier membership** — does its radius react to a wrapping `tier`-aware context (commit/modify/contain), is it hardcoded to one tier, or does it sit outside the tier system entirely?
3. **Border-token source** — does the border read as **interactive** (Intent tokens, high contrast) or as **architectural** (Surface tokens, low contrast)?

Picking the right family up-front avoids the most common categorical bugs: a button that looks like an input, a menu that doubles as a listbox, an avatar that mutates when the brand flattens commit-radii.

---

## The six families

| Family | Members | ARIA role | Tier behaviour | Border source |
|---|---|---|---|---|
| [Action](#action) | Button · ButtonGroup · Menu · Toolbar · Toggle | `button`, `menu`, `menuitem`, `toolbar` | tier-aware (commit default) | **Intent** (`border-neutral` etc.) |
| [Form](#form) | Input · Select · Combobox · Textarea · Checkbox · RadioGroup · Slider · FormField | `textbox`, `listbox`, `combobox`, `checkbox`, `radio` | tier-aware (modify default) | **Surface** (`border-border-subtle`) |
| [Navigation](#navigation) | Breadcrumb · Pagination · SegmentGroup · Stepper · Tab · JourneyTimeline | `navigation`, `tablist`, `tab` | tier-aware (commit or modify per component) | mixed (route-context dependent) |
| [Container](#container) | Card · Alert · Accordion · Collapsible · Dialog · Drawer · Popover · Tooltip · Sidebar · Separator · ConfirmDialog | `dialog`, `region`, `tooltip`, etc. | tier-aware (contain default) | **Surface** or **Hairline** |
| [Feedback / Ambient](#feedback--ambient) | Toast · Spinner · Progress · Skeleton · Badge | `status`, `alert`, `progressbar` | **not tier-aware** — fixed geometry per component | **Intent** (status-tinted) or **none** |
| [Identity](#identity) | Avatar | `img` or `button` | **not tier-aware** — own shape axis (`circle`/`rounded`/`square`) | none (avatar is its own surface) |

The split between `display`, `overlay`, `layout`, `feedback` etc. JSDoc tags collapses into these six families — the tags drive doc-page generation and MCP filtering, the family decides architecture.

---

## Action

**Members:** `Button`, `ButtonGroup`, `Menu`, `Toolbar`, `Toggle`.

**ARIA:** `role="button"`, `role="menu"` + `role="menuitem"`, `role="toolbar"`, `role="switch"` (Toggle).

**Tier:** Default `commit` — buttons, menu triggers, toolbar surfaces declare identity and want the pill (or pill-adjacent) radius. All five components read `tier` from the wrapping `<TierContext>` (set by `<Toolbar tier="modify">` for compact strips, by `<Menu tier="modify">` for inline action lists), so a wrapping context cascades down.

**Border source:** **Intent**. Action borders must read as interactive even in their neutral state — `border-neutral` is `~neutral-500` in light mode, deliberately darker than the surface borders below.

**Industry analogue:** Radix `DropdownMenu`, Headless UI `Menu`, Material `MenuItem`. The key trait: items dispatch `onSelect` callbacks; nothing holds a value.

**When to reach for:**
- "Click this and something happens" → `Button`.
- "Open a list of one-off actions" → `Menu`.
- "Group several action triggers" → `ButtonGroup` (single/multi-select segmentation) or `Toolbar` (free-form toolbar).
- "Two complementary states (bold/italic, mute/unmute)" → `Toggle` with `pressed`. Persistent selection (a sort column, the current tool) uses `active`.

**Bridge token (Menu only).** Menu's panel container is the canonical adjacency case: the trigger is a pill (`commit`-tier) but the panel sits between the pill edge and the `contain`-tier surface beneath. The library exposes `--radius-bridge` to keep that radius tunable — a fourth *adjacency* token, not a fourth tier. No other component uses it as a primary surface radius. See [ARCHITECTURE.md §Tier System](ARCHITECTURE.md#tier-system) for the token and the [tier-system doc page §Bridge Token](../apps/docs/src/routes/customization/tier-system/+page.svelte) for the live demo. Historical rationale: [archive/2026-05/LIGHTER-CONSOLIDATION.md §B.2](archive/2026-05/LIGHTER-CONSOLIDATION.md#b2--menu-bridge-radius-tokenisiert).

**Not in this family:** `SegmentGroup` (looks like ButtonGroup, but holds a value — see Navigation).

---

## Form

**Members:** `Input`, `Select`, `Combobox`, `Textarea`, `Checkbox`, `RadioGroup`, `Slider`, `FormField`.

**ARIA:** `role="textbox"`, `role="listbox"`, `role="combobox"`, `role="checkbox"`, `role="radio"`, `role="slider"`. `FormField` is a wrapper that ties `label` / `description` / `error` to the inner control's `aria-describedby` / `aria-errormessage` plumbing.

**Tier:** Default `modify` — inputs, selects, checkboxes are "tap surfaces" that read as editable, not as commit-decisions. Tier-aware via context — a `<Toolbar tier="commit">` pulls Form children up to `commit` if the inline layout calls for pill-shaped inputs.

**Border source:** **Surface**. Form borders must read as containers, not buttons — `border-border-subtle` is `~neutral-200` in light mode, low-contrast so a frame is not mistaken for a CTA.

**Industry analogue:** Radix `Select`/`Combobox`, Headless UI `Listbox`/`Combobox`, MUI `TextField`. The key trait: the control holds a value and emits `onValueChange` / `bind:value`.

**Picker disambiguation:**
- Pick a value → `Select`.
- Pick a value with search → `Combobox`.
- Pick multiple values → `Select multiple` (not `Menu multiple`).
- One-off action list → `Menu` (Action family).

Full decision matrix with edge cases (search threshold, multi-select, async sources, the CommandPalette boundary, what a screen reader hears): [COMPONENT-DECISION-MATRICES.md §Form-input layer](COMPONENT-DECISION-MATRICES.md#form-input-layer--select-vs-combobox-vs-menu-xc-7).

**Not in this family:** `SegmentGroup` (also holds a value, but lives in Navigation — it's a navigational tab strip cast as a value-picker).

---

## Navigation

**Members:** `Breadcrumb`, `Pagination`, `SegmentGroup`, `Stepper`, `Tab`, `JourneyTimeline`.

**ARIA:** `<nav aria-label>`, `role="tablist"` + `role="tab"`, `aria-current` for breadcrumbs / pagination current page. `JourneyTimeline` is an `<ol>` with `aria-current="step"` on the active-status node and disclosure semantics (`aria-expanded`/`aria-controls`) on the focused node's trigger.

**Tier:** Per-component default. `SegmentGroup` defaults `commit` (tab-strip pill), `Tab` defaults `modify` (closer to an editorial surface), `Stepper` defaults `commit`. All tier-aware via context. `JourneyTimeline` is not tier-aware — its cards/panel sit on the fixed `contain` radius.

**Border source:** Mixed. `SegmentGroup` indicator uses Intent (the active item is action-like). `Tab` `line` variant has no border. Breadcrumb uses no border by default.

**Industry analogue:** Radix `Tabs`, Material `BottomNavigation`, Linear `SegmentedControl`. The key trait: route-or-section selection that persists; not "click and dispatch".

**When to reach for:**
- App-level navigation (sections, sub-routes) → `Tab` (`variant="line"` for editorial), `SegmentGroup` (`appearance="solid"` for inline pickers).
- Linear progress through a process the user *completes* (wizard, checkout) → `Stepper`.
- Retrospective record of a sequence the user *observes* (shipment tracking, audit trail, billing run — with a time axis and one focused node) → `JourneyTimeline`.
- Position context inside a route → `Breadcrumb`.
- Paginated list → `Pagination`.

**SegmentGroup vs ButtonGroup:** SegmentGroup holds a value; ButtonGroup dispatches actions. If you find yourself adding `bind:value` to a ButtonGroup, you want a SegmentGroup.

---

## Container

**Members:** `Card`, `Alert`, `Accordion`, `Collapsible`, `Dialog`, `Drawer`, `Popover`, `Tooltip`, `Sidebar`, `Separator`, `ConfirmDialog`.

**ARIA:** `<dialog>` (Dialog, Drawer, ConfirmDialog), `role="tooltip"` (Tooltip), `role="alert"` or `role="status"` (Alert, Toast — Toast lives in Feedback though), `<aside>` (Sidebar), `<details>` / `aria-expanded` (Accordion, Collapsible). Card is `<article>` or `<a>` depending on `href`/`onclick`.

**Tier:** Default `contain` — containers are architectural surfaces, not interactive affordances. They read as low-key panels that hold content; the radius signal is "this is a frame", not "this is a button". All tier-aware via context (typical: a `tier="modify"` wrapping context pulls Cards from `contain` to `modify` for denser inline layouts).

**Border source:** **Surface** (`border-border-subtle`/`border-border-default`) or **Hairline** (`border-border-hairline`, for editorial separator lines). Never Intent in the default state — Container borders that read as buttons indicate a family mismatch.

**Industry analogue:** Radix `Dialog`, Headless UI `Disclosure`, Material `Card`, Bootstrap `Modal`. The key trait: they hold content; they don't dispatch or pick.

**Decision-matrix for the four overlapping surfaces** (Sidebar, Drawer, Popover, SidebarLayout) — see [COMPONENT-DECISION-MATRICES.md §Overlay & Layout Surfaces](COMPONENT-DECISION-MATRICES.md#overlay--layout-surfaces).

---

## Feedback / Ambient

**Members:** `Toast`, `Spinner`, `Progress`, `Skeleton`, `Badge`.

**ARIA:** `role="alert"` / `role="status"` (Toast, Badge), `role="progressbar"` (Progress, Skeleton with implicit busy semantics). Spinner inherits `aria-busy` from its host.

**Tier:** **Not tier-aware.** Feedback components have fixed geometry that does *not* react to `<TierContext>`. Rationale: a Toast pops over the page chrome and must keep its visual identity even if the host page is themed `tier="modify"`; a Spinner is a circular affordance that the user reads at-a-glance — flipping it to `modify` would defeat the affordance. Badge is the only edge case (the `tier` prop *is* exposed because a Badge inside a `<Toolbar tier="modify">` does want to flatten to `rounded-modify`), but the family-level rule remains: Feedback geometry is per-component, not per-context.

**Border source:** **Intent** (status-tinted) for Alert/Badge in their `outlined` variants; **none** for Spinner / Progress / Skeleton — they read as pure surface.

**Industry analogue:** Radix `Toast`, Material `Skeleton`, Sonner. The key trait: ephemeral status communication; pulled in by the framework, not arranged by the consumer.

**When to reach for:**
- System-wide notification → `Toast`.
- In-page status banner → `Alert`.
- "Working on it" indicator → `Spinner` for unknown-duration, `Progress` for known-duration, `Skeleton` for placeholder content while data loads.
- Inline status / count / tag → `Badge` — see [Badge Patterns §02](../apps/docs/src/routes/blocks/primitives/badge/Docs.svelte) for the five canonical use cases.

---

## Identity

**Members:** `Avatar`.

**ARIA:** `<img>` (decorative or labelled by `name`) or `<button>` when `clickable`/`onclick` is set.

**Tier:** **Not tier-aware.** Avatar has its own `variant` axis (`circle` / `rounded` / `square`) that is an identity-shape concern, not a layout-tier concern. Brands that flatten `--radius-commit` (squared pill buttons) keep circular avatars — the two axes are orthogonal. See [foundation.css §3-tier-system](../packages/blocks/src/lib/style/foundation.css) and [archive/2026-05/LIGHTER-CONSOLIDATION.md §F.2](archive/2026-05/LIGHTER-CONSOLIDATION.md#f2--avatar-aus-dem-tier-system-nehmen).

**Border source:** None. Avatar provides its own surface; `ring` (focus / status indicator) is the only border-adjacent affordance.

**Industry analogue:** Radix `Avatar`, Chakra `Avatar`, Material `Avatar`. The key trait: stands in for a person; reads as a visual handle, not as a control.

---

## Cross-family relationships

Some surfaces sit close to each other and consumers regularly ask "which one". The canonical disambiguations:

| Pair | Choose | Because |
|---|---|---|
| `Menu` vs `Select` | Menu for one-off actions, Select for value pickers | Different ARIA pattern (`menu`/`menuitem` vs `listbox`/`option`), different border family. |
| `ButtonGroup` vs `SegmentGroup` | ButtonGroup for action triggers, SegmentGroup for value selection | Holds value → Navigation family. Dispatches actions → Action family. |
| `Sidebar` vs `Drawer` | Sidebar for persistent layout, Drawer for transient modal | See [COMPONENT-DECISION-MATRICES.md §Overlay & Layout Surfaces](COMPONENT-DECISION-MATRICES.md#overlay--layout-surfaces). |
| `Popover` vs `Tooltip` | Popover for click-interactions, Tooltip for hover-descriptions | Tooltip is non-focusable; Popover hosts a focus-trapped panel. |
| `Alert` vs `Toast` | Alert for in-page banners, Toast for ephemeral notifications | Alert is `role="alert"` + in-page; Toast is system-level + stacking. |
| `Badge` vs `Chip` (v6) | Badge today does both via `purpose` patterns | Future: a dedicated `Chip` for filter/removable use cases (tracked as BDG-1). |

---

## How JSDoc tags map to families

The `@tag` annotations on each `*Props` interface in `packages/blocks/src/lib/primitives/*/index.ts` drive doc-generation and MCP filtering. They are *finer-grained* than families:

| JSDoc tag | Family | Notes |
|---|---|---|
| `action` | Action | Button, ButtonGroup, Menu, Toolbar |
| `form` | Form | Toggle is form-tagged but in Action by behaviour (bistable switch) — see the table at top for canonical family. |
| `navigation` | Navigation | Breadcrumb, Pagination, SegmentGroup, Stepper, Tab, JourneyTimeline (also `display`-tagged) |
| `layout` | Container | Accordion, Card, Collapsible, Separator, Sidebar |
| `overlay` | Container | ConfirmDialog, Dialog, Drawer, Popover |
| `feedback` | Feedback / Ambient | Alert, Badge, Progress, Skeleton, Spinner, Toast |
| `display` | Identity (Avatar) / Container (Tooltip) | Tooltip is display-tagged but lives in Container by behaviour — see canonical family. |

When the tag and the family disagree (Toggle, Tooltip), the family rules — JSDoc tags exist for fine-grained MCP filtering ("show me all form-tagged components"), not as the architectural source of truth.

---

## Querverweise

- [ARCHITECTURE.md](ARCHITECTURE.md) — Token system (foundation → semantic → interaction).
- [COMPONENT-API-CONVENTIONS.md](COMPONENT-API-CONVENTIONS.md) — Props, callbacks, styling patterns.
- [COMPONENT-DECISION-MATRICES.md](COMPONENT-DECISION-MATRICES.md) — Use-case-driven picker tables.
- [archive/2026-05/LIGHTER-CONSOLIDATION.md §F](archive/2026-05/LIGHTER-CONSOLIDATION.md#8--cluster-f--edge-cases) — historical rationale for Badge `purpose` axis and Avatar tier-exit.
