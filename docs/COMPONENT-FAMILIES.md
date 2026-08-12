# Component Families

> A taxonomy of the Urbicon UI primitives. Every component belongs to exactly one family, and the family determines its ARIA role, its border-token source, its tier-system membership, and the question a consumer should ask before reaching for it.
>
> This page is the canonical reference. Doc-page JSDoc `@tag` annotations follow the same taxonomy so that the MCP server, `llms.txt`, and the documentation site all agree.

---

## Why families exist

The library exposes 40 primitives and 27 components. Without a shared mental model, choosing between `Menu` and `Select`, or between `Sidebar` and `Drawer`, becomes a memorisation task. Families give every component a position on three axes:

1. **ARIA role** — what assistive technology calls it.
2. **Tier membership** — does its radius react to a wrapping `tier`-aware context (commit/modify/contain), is it hardcoded to one tier, or does it sit outside the tier system entirely?
3. **Border-token source** — does the border read as **interactive** (Intent tokens, high contrast) or as **architectural** (Surface tokens, low contrast)?

Picking the right family up-front avoids the most common categorical bugs: a button that looks like an input, a menu that doubles as a listbox, an avatar that mutates when the brand flattens commit-radii.

---

## The seven families

| Family | Members | ARIA role | Tier behaviour | Border source |
|---|---|---|---|---|
| [Action](#action) | Button · ButtonGroup · Menu · Toolbar · Toggle | `button`, `menu`, `menuitem`, `toolbar` | tier-aware (commit default) | **Intent** (`border-neutral` etc.) |
| [Form](#form) | Input · Select · Combobox · Textarea · Checkbox · RadioGroup · Slider · FormField | `textbox`, `listbox`, `combobox`, `checkbox`, `radio` | tier-aware (modify default) | **Surface** (`border-border-subtle`) |
| [Navigation](#navigation) | Breadcrumb · Pagination · SegmentGroup · Stepper · Tab · JourneyTimeline | `navigation`, `tablist`, `tab` | tier-aware (commit or modify per component) | mixed (route-context dependent) |
| [Container](#container) | Card · Alert · Accordion · Collapsible · Dialog · Drawer · Popover · Tooltip · Sidebar · Separator · ConfirmDialog | `dialog`, `region`, `tooltip`, etc. | tier-aware (contain default) | **Surface** or **Hairline** |
| [Feedback / Ambient](#feedback--ambient) | Toast · Spinner · Progress · Skeleton · Badge | `status`, `alert`, `progressbar` | **not tier-aware** — fixed geometry per component | **Intent** (status-tinted) or **none** |
| [Identity](#identity) | Avatar | `img` or `button` | **not tier-aware** — own shape axis (`circle`/`rounded`/`square`) | none (avatar is its own surface) |
| [Conversation](#conversation) | Chat · ChatMessageList · ChatMessage · PromptInput · StreamingMarkdown · CodeBlock · ToolCallCard · ReasoningDisclosure · CitationChip · A2UIView | `log`, `article`, `textbox`, `region` | mixed — `bridge` for the bubble, `contain` for the framed blocks, `modify` for the composer | **Surface**, and only on the OUTERMOST frame |

The split between `display`, `overlay`, `layout`, `feedback` etc. JSDoc tags collapses into these seven families — the tags drive doc-page generation and MCP filtering, the family decides architecture.

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

**Bridge token.** Menu's panel container is the canonical *adjacency* case: the trigger is a pill (`commit`-tier) but the panel sits between the pill edge and the `contain`-tier surface beneath. The library exposes `--radius-bridge` to keep that radius tunable, and it also covers the *optical-size* case — a surface too small for the container radius to read as intentional: the `ChatMessage` bubble, `Textarea` at `tier="commit"`, and `Card tier="bridge"`. It was tokenised rather than hard-coded so a brand that flattens `--radius-commit` keeps the panel visually attached to its trigger. See [ARCHITECTURE.md § The tier system](ARCHITECTURE.md#the-tier-system) for the token and the [tier-system doc page §Bridge Token](../apps/docs/src/routes/customization/tier-system/+page.svelte) for the live demo.

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

Full decision matrix with edge cases (search threshold, multi-select, async sources, the CommandPalette boundary, what a screen reader hears): [COMPONENT-DECISION-MATRICES.md §Form-input layer](COMPONENT-DECISION-MATRICES.md#form-input-layer--select-vs-combobox-vs-menu).

**Not in this family:** `SegmentGroup` (also holds a value, but lives in Navigation — it's a navigational tab strip cast as a value-picker).

### How `error` shows on the control

Three shapes, picked by what the control's own colour already means. Getting this wrong is not a style slip: on a boolean control a danger *fill* reads as "not selected", which is the opposite of the truth.

| Control shape | `error` renders as | Why |
| --- | --- | --- |
| **Text-entry** — `Input`, `Textarea`, `Select`, `Combobox`, `PinInput`, `TimeInput` | Danger **frame**, as its own compound step after every axis (`fieldErrorFrame`) | The border carries no other meaning, so the error can simply own it. The compound step (rather than an axis) keeps precedence independent of the order axes are declared in — see the comment in `input.variants.ts`. |
| **Boolean** — `Checkbox`, `RadioGroup`, `Toggle` | **Unselected:** danger border, with the hover bucket pinned. **Selected:** danger **ring** on top of the unchanged intent fill. | An error on a boolean usually means "must be switched on", so the off state carries the mark on its boundary. But an error on an *already selected* control is real too ("this option is not available on your plan", "this consent was withdrawn") — there the fill must keep saying *what is selected* while a ring on a separate layer says *this selection is the problem*. |
| **Continuous** — `Slider` | Danger **ring** on the thumb, unconditionally | A slider always holds a value, so it has no unselected state to paint. Same layering as the selected boolean case. |

The ring is `ring-2 ring-danger/60 ring-offset-1 ring-offset-surface-base`, and it pins the focus bucket to danger as well (`peer-focus-visible:ring-danger/60`, or `focus-visible:` where the control is itself focusable). Without that pin the focus ring repaints the mark primary exactly while the user is on the control — the same trap the hover pin closes on the unselected side.

`intent` stays orthogonal to all of this: it says what a *healthy* control means (a success-green field, a warning-amber one) and it colours the border on text-entry controls and the fill on booleans. `error` is not an intent value and never competes with one.

---

## Navigation

**Members:** `Breadcrumb`, `Pagination`, `SegmentGroup`, `Stepper`, `Tab`, `JourneyTimeline`.

**ARIA:** `<nav aria-label>`, `role="tablist"` + `role="tab"`, `aria-current` for breadcrumbs / pagination current page. `JourneyTimeline` is an `<ol>` with `aria-current="step"` on the active-status node and disclosure semantics (`aria-expanded`/`aria-controls`) on the focused node's trigger.

**Tier:** Per-component default. `SegmentGroup` defaults `commit` (tab-strip pill), `Tab` defaults `modify` (closer to an editorial surface), `Stepper` defaults `commit`. All tier-aware via context. `JourneyTimeline` is not tier-aware — its cards/panel sit on the fixed `contain` radius.

**Border source:** Mixed. `SegmentGroup` indicator uses Intent (the active item is action-like). `Tab` `line` variant has no border. Breadcrumb uses no border by default.

**Industry analogue:** Radix `Tabs`, Material `BottomNavigation`, Linear `SegmentedControl`. The key trait: route-or-section selection that persists; not "click and dispatch".

**When to reach for:**
- App-level navigation (sections, sub-routes) → `Tab` (`variant="line"` for editorial), `SegmentGroup` (the pill-track default) for inline pickers.
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

**Two of these render inside a paragraph** — `Tooltip` by design (it is what the library documents for hover-described inline targets) and `Popover` on request (`inline`, as `CitationChip` uses it). A `<div>` start tag closes an open `<p>`, so both had to change; which remedy each one takes is the phrasing-content rule written up under [Conversation](#conversation), the family where it first came up.

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

**Tier:** **Not tier-aware.** Avatar has its own `variant` axis (`circle` / `rounded` / `square`) that is an identity-shape concern, not a layout-tier concern. Brands that flatten `--radius-commit` (squared pill buttons) keep circular avatars — the two axes are orthogonal, which is why Avatar was taken out of the tier system rather than given a tier default. See [foundation.css §3-tier-system](../packages/blocks/src/lib/style/foundation.css).

**Border source:** None. Avatar provides its own surface; `ring` (focus / status indicator) is the only border-adjacent affordance.

**Industry analogue:** Radix `Avatar`, Chakra `Avatar`, Material `Avatar`. The key trait: stands in for a person; reads as a visual handle, not as a control.

---

## Conversation

**Members:** `Chat`, `ChatMessageList`, `ChatMessage`, `PromptInput`, `StreamingMarkdown`, `CodeBlock`, `ToolCallCard`, `ReasoningDisclosure`, `CitationChip`, `A2UIView` (the `ai` JSDoc tag).

**ARIA:** `role="log"` with `aria-live="off"` for the conversation (token-by-token live output would flood a screen reader — a separate polite region announces start and completion once each), `<article>` per message, `<textarea>` for the composer, `role="region"` for the scrollable code body.

**Tier:** Mixed, and deliberately so — this family is the one place where three tiers meet inside one component tree. The bubble is `bridge` (6 px): it is *content*, and `contain` at 2 px reads as a rectangle at bubble size, because optical radius scales with the area it turns. The framed blocks (a standalone CodeBlock, `ToolCallCard variant="card"`) are `contain` — they are panels. The composer is `modify`, like any other editable surface. The parts that report *how* an answer was produced draw no frame at all by default: `ToolCallCard` (`quiet`) and `ReasoningDisclosure` are muted single lines, because machinery is not content.

**Phrasing content.** This is the family where the rule first came up — `MdInline` puts a `CitationChip` in the middle of `MdBlock`'s `<p>` — but it is not confined here: `Tooltip` (Container) is documented for inline targets, so the rule below governs it too. A `<div>` start tag closes an open `<p>` while the parser repairs the document, so an SSR'd answer that cites a source used to emit invalid HTML and diverge from the client tree (`node_invalid_placement_ssr` → `hydration_mismatch`). A `<span>` wrapper alone does not suffice, because the rule is about the whole subtree, not the immediate element — and which remedy that leaves you depends on one question: **is the panel's content phrasing by construction?**

- **No — the content is the consumer's.** Then no element can make the subtree legal, and the panel has to leave the server render. `Popover`'s `inline` mode does this: the trigger wrapper becomes a `<span>` and the panel appears on mount. `CitationChip` sets it. The cost is stated in the prop's own JSDoc: a non-rendering crawler never sees the panel, so it is opt-in rather than the default.
- **Yes — the component's own API constrains it.** Then the panel can simply *be* a `<span>` and stay in the SSR output, with no prop and no cost. `Tooltip` is this case: `label` is typed `string`, so its panel, arrow and trigger are all spans unconditionally (2026-08-02). Note what does the blockifying there — the panel's inline `position: fixed`, never a `display` utility, which would beat `[popover]:not(:popover-open) { display: none }` and leave a closed tooltip laid out. Valid inside a `<p>` is not the same as *flowing* with it: Tooltip's trigger wrapper is `inline-flex` and therefore atomic, so a multi-word trigger occupies one unbreakable box.

**Border source:** **Surface**, and here the family adds a rule the others do not need: **only the outermost frame draws one.** A conversation nests deeper than any other family — shell → message → tool call → payload — so a component that frames itself *and* is framed by its parent stacks outlines at the same radius, which reads as depth that is not there. Hence `CodeBlock` has a `variant="plain"` that drops surface, outline, radius and padding for exactly this case, and `ToolCallCard` uses it for its payloads. When you nest a block, the parent owns the frame and the child owns the content.

**Also specific to this family:**

- **Tint over outline.** Message surfaces differentiate by tint (`surface-elevated` for the assistant bubble, `primary-subtle` for the user's), never by a border. That only works because the light surface ladder was spread in 2026-07 — see [semantic.css §SURFACE](../packages/blocks/src/lib/style/semantic.css) and the `surface ladder — perceptual separation` guard in `style/contrast.test.ts`.
- **Alignment lives on the column, not the bubble.** Everything under a message (citations, status alert, footer) shares the bubble's aligned column, so it follows the role side. A row that sits outside it drifts to the opposite margin.
- **Untrusted content.** Assistant output never reaches the DOM as markup: no `{@html}` anywhere, and every URL is policy-checked before render (images blocked by default). See [A2UI.md](A2UI.md) and the `ai-chat` pattern.

**Industry analogue:** Vercel AI SDK UI, `assistant-ui`, Copilot Kit. The key trait: the content is streamed, partially settled, and not authored by the application — the components have to stay legible mid-stream and safe with hostile input.

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
| `Badge` vs `Chip` | Badge today does both via `purpose` patterns | A dedicated `Chip` for filter/removable use cases is possible but not planned. |

---

## Listbox item rhythm

Four surfaces render option/item rows inside a floating panel: `Select` and `Combobox` (Form, `role="listbox"`), `Menu` (Action, `role="menu"`), and `CommandPalette` (a filtered `role="listbox"` command surface). They share **one structural rhythm**; only the *voice* differs by family. A fifth listbox-shaped surface must adopt the shared rhythm and pick its family voice deliberately.

**Shared structure (all four):**

- Panel: `p-1` edge inset (symmetric 4px) + `space-y-0.5` item-to-item (2px). Grouped listboxes re-establish the same gap on the `group` container so grouped options space like flat ones.
- Rows: `rounded-modify`, `gap-2` icon↔label (the gap owns the distance — no `mr-*` on leading indicators), min-height staggered per size `1.75 / 2 / 2.5 / 3 / 3.5 rem` (xs–xl; Menu covers sm–lg, CommandPalette sits fixed on the md baseline), horizontal inset `px-2` below md, `px-3` at md/lg, `px-4` at xl.
- Group/section headers always share the row's horizontal inset (`px` follows the size axis); `py-1.5` fixed — headers don't scale vertically.
- Cursor/hover = `bg-surface-hover`; disabled = `opacity-50` + not-allowed cursor.

**Family voice (deliberate contrasts — do not flatten):**

| | Form (Select / Combobox) | Action (Menu) | CommandPalette |
|---|---|---|---|
| Row typography | one step under the trigger: `text-xs/sm/sm/base/lg` (xs–xl) — options are data, quieter than the control | the Button ladder: `text-sm/base/lg` (sm–lg) — items read like the Button that opened them | `text-sm` fixed, rows `text-text-secondary` |
| Selected | `bg-surface-selected font-medium` + trailing `text-primary-text` check (space reserved, opacity fade — no layout shift) | none — items dispatch, nothing holds a value | none — actions run and dismiss |
| Header voice | uppercase `text-xs font-medium tracking-wider text-text-tertiary` | plain `text-xs font-medium text-text-tertiary` — sections label actions, not data groups | uppercase `text-2xs font-semibold text-text-quaternary` — micro command voice |
| Keyboard cursor | `bg-surface-hover` via `aria-activedescendant` | `bg-surface-hover` + real roving focus (`focus-visible` ring) | `bg-primary-subtle text-primary-text` — "Enter runs this" |
| Empty/loading rows | `text-sm text-text-tertiary` centered, `py-4` | n/a (static action lists) | same signature, `py-8` (larger surface) |

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

## Cross-references

- [ARCHITECTURE.md](ARCHITECTURE.md) — token system (foundation → semantic → interaction), tier model, `tv()` engine.
- [COMPONENT-API-CONVENTIONS.md](COMPONENT-API-CONVENTIONS.md) — props, callbacks, styling patterns.
- [COMPONENT-DECISION-MATRICES.md](COMPONENT-DECISION-MATRICES.md) — use-case-driven picker tables.
- [VARIANT-CONTRACT.md](../packages/blocks/docs/VARIANT-CONTRACT.md) — what each `variant` value means across the families.
