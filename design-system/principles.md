# Urbicon UI — Design Principles

Design heuristics for building UIs with Urbicon UI. These principles guide the LLM in making design decisions — from individual component choices to full-page composition. They complement the token reference (`get_css_reference`) and component catalog (`find_components`).

## Visual Hierarchy

- Max 1 primary CTA per viewport. Additional actions use `intent="neutral"` or `variant="ghost"`.
- Use the typography scale (text size + weight) for information hierarchy, never color alone.
- Progressive disclosure: show a summary, let the user expand for detail (Accordion, Collapsible, "Show more").
- 3 hierarchy levels max per view: heading, subheading, content. Deeper nesting signals a need for navigation.
- Vary visual weight across Cards — not every Card needs `variant="outlined"` and `padding="lg"`. Mix quiet (no border, bg-surface-quiet) with prominent (outlined, elevated).
- Text hierarchy: primary for key info, secondary for supporting, tertiary for metadata, quaternary for subtle labels. Never skip more than one level.
- Use `intent` colors only for semantic meaning (success/danger/warning/info), never for decoration.
- **A category is not a status.** Workflow stages, types, priorities and owners are *categories*: they carry no severity, so mapping them onto intents ("roasting" → warning, "normal" → info) makes the interface shout about a problem that does not exist. Use `Badge purpose="tag" intent="neutral"` for a category label, and reach for the `--color-chart-1…6` ramp (`bg-chart-1`, `text-chart-3`, …) when several categories genuinely need to be told apart at a glance — chart tokens are built for exactly that and re-tint with the theme. Keep the intents for what has a severity: success, warning, danger, info.

## Interaction

- Destructive actions always require explicit confirmation via `ConfirmDialog`.
- Form validation: inline at the field via `FormField` error state, not a global error banner after submit.
- Loading states belong on the triggering element (`Button` spinner), not a global page spinner.
- Hover states: use `bg-surface-hover` for interactive surfaces, never raw opacity changes.
- Focus: always `focus-visible:`, never `focus:` — keyboard-only focus rings.
- Disabled elements: `bg-surface-disabled` + `text-text-disabled`, with `cursor-not-allowed`. Never hide disabled options — show them so users understand they exist.
- Optimistic UI where safe (toggles, selections). Confirmation-dependent actions (delete, send) wait for server.
- Toasts for non-blocking feedback (saved, copied). Alerts for persistent status (offline, quota reached).

## Component Selection

These heuristics map common UI needs to the right Urbicon UI component:

| Need | Component | Why |
|---|---|---|
| 2-3 mutually exclusive options | `RadioGroup` | Visible at a glance |
| 4-6 mutually exclusive options | `Select` | Compact, scrollable |
| 7+ options or needs search | `Combobox` | Searchable, filterable |
| Boolean on/off setting | `Toggle` | Immediate visual feedback |
| Boolean agreement/consent | `Checkbox` | Conveys "I confirm" semantics |
| Single action | `Button` | Clear affordance |
| Multiple related actions | `ButtonGroup` | Visual grouping |
| Contextual actions (right-click, "more") | `Menu` | Discoverable on demand |
| Date selection | `DatePicker` | Constrained input with calendar |
| Free text | `Input` or `Textarea` | Single-line vs. multi-line |
| Currency amount | `CurrencyInput` | Locale-aware formatting |
| Navigation between peer sections | `Tab` | Horizontal, same hierarchy |
| Navigation between hierarchical sections | `Sidebar` | Vertical, nested groups |
| Quick access to any page/action | `CommandPalette` | Keyboard-first, searchable |
| Status indicator | `Badge` | Compact, intent-colored |
| Step-by-step flow | `Stepper` | Shows progress + completion |
| Blocking user decision | `Dialog` | Modal, focused |
| Supplementary content panel | `Drawer` | Slide-in, non-blocking |
| Contextual info on hover/focus | `Tooltip` | Ephemeral, no interaction |
| Contextual content on click | `Popover` | Persistent, interactive |
| Empty data state | `EmptyState` | Friendly, actionable |
| Tabular data | `Table` | Sorting, filtering, selection |
| Proportional breakdown | `CompositionBar` | Visual percentages |
| Flow/relationship visualization | `Sankey` | Multi-level flows |
| File selection | `FileUpload` | Drag-and-drop + browse |

## Layout

- Content max-width: 720px for readability. Wider only for data-dense views (tables, dashboards).
- Use `Sidebar` for large, hierarchical, or admin settings navigation; a small, flat single-save settings page can use `Tab` (peer sections within a page). See the `settings-page` pattern for the scale-based choice.
- Group related content in `Card`s. Cards represent conceptual units, not individual items.
- Sticky action bars (`Save`/`Cancel`) when forms exceed the viewport.
- Empty states: always provide an action. "No results" alone is a dead end.
- Page spacing rhythm: `gap-8` or `gap-10` between sections, `gap-4` or `gap-6` within sections. **That two-tier rule is the floor, not the ceiling:** it stops a page from running on one uniform gap, it does not ask every section to sit at the same distance. Let the rhythm follow the content — a warning that belongs to the metric above it sits closer than the next section does, a dense list needs less air than a hero, and `padding` varies with a card's density (`lg` for the one that carries the page, `md` or `sm` for the reference blocks beside it).
- Separator for visual breaks within a surface, not between Cards (Cards have their own boundaries).
- Use `SidebarLayout` for app shells with persistent navigation. Use standalone `Sidebar` for in-page nav.

### Layout markup

- **Layout is markup, not a component.** There is no `Stack`, `Box` or `Row` in this library: a `<div class="flex …">` that carries a layout decision is the correct tool, not a shortcoming.
- **Top-level regions are landmarks, not `<div>`s.** Page content goes in `<main>`, site navigation in `<nav>`, the page banner in `<header>`, and a titled section in `<section>` with an `aria-label` (or a heading it is labelled by). Every node that lands outside one is a screen-reader dead zone — this is the most frequent accessibility failure measured across generated pages, and it scales with page length.
- **Every wrapper earns its place.** A `<div>` without layout utilities, one whose single child could carry the classes itself, or two nested flex containers that could be one — each is noise, not structure.
- **Use a component only where one genuinely fits.** `Separator` for a break inside a surface; `Toolbar` for a bar of controls. `ButtonGroup` is for buttons that are visually connected or share a selection — two independent actions side by side stay two `Button`s in a flex container.
- **When changing existing markup, fit the change in rather than wrapping it.** A new row inside a card belongs in the structure that is already there.

## Accessibility

- Every icon-only `Button` needs `aria-label`.
- Form fields must be wrapped in `FormField` for automatic label + error + description association.
- Keyboard navigation: all interactive elements reachable via Tab. Custom widgets implement arrow-key navigation (Menu, Select, Combobox, Table).
- Color contrast: semantic tokens are pre-tuned for WCAG AA (4.5:1 for text, 3:1 for UI elements). Do not override with lower-contrast alternatives.
- Motion: all animations respect `prefers-reduced-motion`. Interaction tokens collapse durations to 1ms automatically.
- Skip links: include for long navigation sections.
- Announce dynamic content (toast messages, live table updates) via aria-live regions.

## Theming

### The 5-Layer Token Hierarchy

Understanding which layer to modify is the key to efficient design changes:

| Layer | What it controls | Format | How changes propagate |
|---|---|---|---|
| 1. Foundation | Raw OKLCH color palettes, radius scale, z-index | CSS `@theme` | Automatically to all layers above |
| 2. Semantic | Surface, text, border, intent, shadow tokens | CSS `@theme` with `light-dark()` | Automatically to components |
| 3. Component | Variant defaults, slot classes, presets | `tv()` + `BlocksProvider` | Automatically to instances |
| 4. Composition | Page layout, component arrangement, spacing | Markdown patterns (this system) | Via LLM knowledge |
| 5. Principles | Design heuristics, selection rules | Markdown (this file) | Via LLM knowledge |

**Layers 1-3 propagate through code.** Change a foundation token and every semantic token, component, and instance that references it adapts automatically. **Layers 4-5 propagate through knowledge.** Change a principle or pattern and the LLM applies it the next time it generates UI.

### Design Change Decision Tree

When asked to modify the design, identify the correct layer:

**"Change the color / mood / brand"** → Layer 1 (Foundation)
- Create a custom theme CSS file overriding `--color-primary-*` and `--color-secondary-*`
- Use OKLCH: adjust hue (H) for color direction, chroma (C) for vibrancy, lightness (L) curve for contrast
- Everything else adapts automatically — semantic tokens, components, dark mode
- Optional: override `--blocks-shadow-tint` for cohesive shadows (warm brand → warm shadows)

**"Adjust dark mode appearance"** → Layer 2 (Semantic)
- Modify the `light-dark()` values in semantic tokens
- Never use Tailwind `dark:` overrides — they bypass the token system
- The 4-level surface ladder (quiet → base → elevated → overlay) and text hierarchy auto-resolve

**"Make buttons / cards / inputs look different"** → Layer 3 (Component)
- Use `BlocksProvider` `defaults` for global component overrides
- Use `presets` for named looks (e.g., `preset="compact"`)
- Use `overrides` for prop-conditional rules — style only one variant/intent/state (e.g. only `variant="outlined"`), what an unconditional `slotClasses` cannot express
- Use `slotClasses` on individual instances for one-off overrides
- Use `unstyled` to strip all defaults and bring your own styling

**"Change page layout / navigation structure"** → Layer 4 (Composition)
- Update the composition pattern file (see `get_pattern()`)
- LLM applies the updated pattern when generating new pages
- Existing pages need manual migration

**"Change design rules / component selection heuristics"** → Layer 5 (Principles)
- Update this file
- LLM applies updated rules going forward

### Creating a Custom Theme

A theme file overrides three foundation ramps: the two accents (`--color-primary-*`, `--color-secondary-*`) **and the neutral chassis** (`--color-neutral-*`). All semantic tokens — surfaces, text, borders, intents — inherit automatically. The chassis is the most-missed piece: surfaces/text/borders derive from `--color-neutral-*`, which defaults to a cool Hue 240. Re-tint it to your accent's temperature, or a warm brand color lands on cold grey surfaces (the classic "half-themed" look).

```css
/* app-theme.css — import AFTER base styles */
@theme {
  /* Primary palette — shift hue, adjust chroma for vibrancy */
  --color-primary-50:  oklch(0.97 0.01 YOUR_HUE);
  --color-primary-100: oklch(0.93 0.03 YOUR_HUE);
  --color-primary-200: oklch(0.85 0.06 YOUR_HUE);
  --color-primary-300: oklch(0.76 0.09 YOUR_HUE);
  --color-primary-400: oklch(0.66 0.12 YOUR_HUE);
  --color-primary-500: oklch(0.55 0.14 YOUR_HUE);
  --color-primary-600: oklch(0.48 0.14 YOUR_HUE);
  --color-primary-700: oklch(0.40 0.12 YOUR_HUE);
  --color-primary-800: oklch(0.32 0.10 YOUR_HUE);
  --color-primary-900: oklch(0.24 0.07 YOUR_HUE);
  --color-primary-950: oklch(0.16 0.04 YOUR_HUE);

  /* Secondary — complementary or analogous hue */
  --color-secondary-50:  oklch(0.97 0.01 SEC_HUE);
  /* ... same 50-950 scale ... */

  /* Chassis — re-tint the neutral ramp to CHASSIS_HUE (≈ YOUR_HUE).
     Keep lightness + chroma at the foundation values; only shift the hue,
     so WCAG contrast is preserved. Set chroma to 0 for a true grayscale. */
  --color-neutral-25:  oklch(0.99 0.002 CHASSIS_HUE);
  --color-neutral-50:  oklch(0.98 0.005 CHASSIS_HUE);
  /* ... 100-850 ... */
  --color-neutral-900: oklch(0.15 0.012 CHASSIS_HUE);
  --color-neutral-950: oklch(0.08 0.008 CHASSIS_HUE);
}
```

**OKLCH parameter guide:**
- **Hue (H):** 0-360 color wheel. 0=red, 30=orange, 60=yellow, 140=green, 220=blue, 280=purple, 340=pink
- **Chroma (C):** 0=gray, 0.05=muted, 0.10=moderate, 0.15=vibrant, 0.20+=vivid. Stay under 0.18 for foundation accent scales; keep the neutral chassis ≤0.017 so it stays near-grey.
- **Lightness (L):** 0=black, 1=white. The 50-950 scale should span L=0.97 (lightest) to L=0.16 (darkest). 500/600 are the "base" shades used in semantic intent tokens.

> If you scope a theme to a class (e.g. a runtime-toggled `.theme-x`) instead of a global `@theme`/`:root` block, you must also re-declare the derived semantic tokens (`--color-primary`, surface/text/border) inside that class — inline/scoped `var()` won't re-substitute against the overridden ramp on its own. Global `@theme` themes don't hit this. See `apps/docs/src/lib/style/rooms-docs.css` for a fully worked scoped example.

### Built-in Themes

Five pre-built themes are available, each shifting primary + secondary hues, re-tinting the neutral chassis to match the accent's temperature, re-tuning any intent ramp that would collide with the accent (plus a matching shadow tint), **and** re-tinting the neutral intent (`bg-neutral` / `text-neutral` / borders) via `--neutral-chrome-hue`. Non-colliding intents (success/warning/danger/info) stay at the library defaults; the Neutral theme inherits the cool default chrome.

The neutral intent keeps the `--color-warm-neutral-*` ramp's lightness profile (tuned so white-on-fill and neutral-text both stay legible light/dark) and only takes its hue from `--neutral-chrome-hue` (`:root`, default 240). Set it per theme — `:root { --neutral-chrome-hue: 50; }` — to re-tint neutral controls without touching contrast. Don't repoint the neutral intent onto the chassis `--color-neutral-*` ramp; its surface lightness breaks the dual-role (fill vs. text) contrast balance.

| Theme | Primary Hue | Secondary Hue | Chassis Hue | Re-tuned intents | Character |
|---|---|---|---|---|---|
| Default | 240 (indigo) | 280 (purple) | 240 (cool) | — | Professional, balanced |
| Ocean | 220 (blue) | 190 (teal) | 220 (cool) | info → 255 (off brand blue) | Cool, trustworthy |
| Forest | 155 (green) | 90 (lime) | 150 (stone) | success → 172, warning → 60 | Natural, calm |
| Sunset | 55 (amber) | 25 (orange) | 50 (warm) | warning → 92, danger → 16 | Warm, energetic |
| Rose | 350 (pink) | 310 (magenta) | 350 (warm) | danger → 34 | Soft, approachable |
| Neutral | 240/minimal chroma | 240/minimal chroma | grayscale (chroma 0) | — | Content-focused, no brand color |

### Semantic Radius Tiers

Radius tiers map to component families — override these, not individual component radii:

| Tier | Token | Default | Components | Brand tuning |
|---|---|---|---|---|
| Commit | `--radius-commit` | `9999px` (pill) | Button, Badge, Toggle, SegmentGroup | Lower for less playful (e.g., `--radius-xl`) |
| Modify | `--radius-modify` | `var(--radius-sm)` (4px) | Input, Textarea, Select, Combobox, Tab | Raise for softer (e.g., `--radius-md`) |
| Contain | `--radius-contain` | `var(--radius-xs)` (2px) | Card, Dialog, Drawer, Alert, Tooltip, Popover, Toolbar surface | Raise for friendlier (e.g., `--radius-md`) |
| Bridge | `--radius-bridge` | `var(--radius-md)` (6px) | Menu panel under a pill trigger, ChatMessage bubble | Follows `contain` if you raise that |

The first three are the primary tiers — pick one of them. **Bridge** is the middle
tier for the two cases where `contain` is too hard and `commit` too soft:

1. **Adjacency** — a floating panel anchored to a pill trigger reads disconnected at 2px and over-sized at pill radius.
2. **Small tinted content surfaces** — optical radius scales with the area it turns. 2px on a 600px Card reads as a precise edge; the same 2px on a ~200px chat bubble reads as a rectangle. A bubble is *content*, not architecture.

Anything that genuinely *is* a panel, dialog or container stays on `contain`.

**The tiers rank roles, not nesting.** Radius here is a semantic marker: actions are the softest
because committing should feel inviting, fields sit in between because they read as tap areas,
containers are the tightest because architecture should read as precise. That a pill Button sits
*inside* a hairline-edged Card is not a contradiction — it is the whole point, and it stays the
point at any scale. `--radius-commit: var(--radius-lg)` with `--radius-contain: var(--radius-sm)`
is simply a quieter voicing of the same ranking, and it is as correct as the shipped default.

So the question to ask is never "is the inner element rounder than the outer one" (in this system
it usually is, by design) but: **can a reader state the rule?** Retune the tiers *together*, keep
the three families distinguishable, and if you deliberately re-order them — containers softer than
actions, say — carry that everywhere rather than in one token.

What actually fails, measured across the eval runs: one family moved while the others keep values
that no longer relate to it, hand-set `rounded-*` on individual elements that disagree with the
components beside them, and small stacked surfaces where the default hairline edge never reads as
an edge at all (that last one is what `bridge` exists for).

**When the 2px default reads as intent — and when it does not.** A hairline-precise container
edge is a deliberate identity: it makes the surface read as a plane rather than as a box, and
it is what keeps the library out of the uniformly-rounded look. It only carries that meaning
under two conditions: the surface is large enough that its edge is visible as an edge, and
something else on the page (a pill action, a circular avatar) supplies the contrast that makes
the flatness legible as a choice. On a small stacked tile with nothing round beside it, the
same 2px is indistinguishable from "nobody decided" — that is the case `bridge` exists for.

One more token to know before you flatten a tier: `--radius-control` (default `9999px`) owns
the radio indicator's circle. Shape is the only thing distinguishing a radio from a checkbox,
so it deliberately does *not* follow `--radius-commit` when a theme squares the pill.

### Interaction Tuning

Override timing and easing tokens for different personalities:

| Token | Default | Subdued | Energetic |
|---|---|---|---|
| `--blocks-duration-fast` | 150ms | 200ms | 100ms |
| `--blocks-duration-normal` | 250ms | 300ms | 180ms |
| `--blocks-ease-gentle` | ease-out variant | keep | swap for springy |
| `--blocks-mint-scale-intensity` | 1.04 | 1.02 or remove | 1.06 |

### Mint (Micro-Interactions)

Mint classes add playful polish: `blocks-mint-scale` (hover grow), `blocks-mint-glow` (color halo), `blocks-mint-bounce`, `blocks-mint-pulse`. Use sparingly — 1-2 mint effects per view. Glow color auto-adapts to intent (`blocks-intent-success` → green glow).

## Design Paradigms

When asked for a wholesale aesthetic shift, map the paradigm to specific changes across all layers:

### Minimal (Default)
The Urbicon UI baseline. Clean, functional, professional.
- **Foundation:** moderate chroma (0.12-0.15), hue 240, default radius tiers
- **Semantic:** neutral surfaces, subtle borders, standard shadows
- **Interaction:** gentle easing, subtle mint (scale 1.04), standard durations
- **Composition:** generous whitespace, content-focused, 720px max-width

### Brutalist
Raw, honest, structural. High contrast, visible grid.
- **Foundation:** all radii to 0 (`--radius-commit: 0; --radius-modify: 0; --radius-contain: 0`), no shadows
- **Semantic:** max border contrast (`border-emphasis` everywhere), monochrome surfaces
- **Interaction:** `--blocks-duration-fast: 0ms` (instant), no mint effects, no easing
- **Composition:** grid-heavy, high density, visible structural borders, monospace accents

### Organic / Warm
Friendly, natural, approachable. Warm palette, soft shapes.
- **Foundation:** warm hue (H: 30-60), high chroma, generous radii (`--radius-contain: var(--radius-md)`), warm shadow tint (`--blocks-shadow-tint: 30 0.01 50`)
- **Semantic:** warm neutrals for surfaces, soft borders (`border-subtle`), deeper shadows
- **Interaction:** springy easing, scale + glow mint, slightly longer durations
- **Composition:** flowing layouts, generous spacing (`gap-10`+), rounded Cards

### Corporate / Enterprise
Professional, data-dense, efficient. Neutral palette, compact layout.
- **Foundation:** neutral theme (minimal chroma), tight radii, subtle shadows
- **Semantic:** high text contrast for data readability, strong borders for tables
- **Interaction:** confident easing (fast, no overshoot), minimal or no mint
- **Composition:** dense layouts, prominent Tables, sidebar navigation, compact Cards

### Playful / Friendly
Fun, engaging, vibrant. Bold colors, bouncy motion.
- **Foundation:** vivid hue with high chroma (0.16+), commit radii for everything (`--radius-modify: 9999px; --radius-contain: var(--radius-xl)`) — pilling the fields is a *category* change, not an inversion, so it stays coherent against the 12px containers
- **Semantic:** colorful intent-subtle backgrounds, softer borders
- **Interaction:** bouncy easing, all mint effects, generous durations (300ms+)
- **Composition:** visual variety, Cards with color accents, generous spacing, illustrations over icons

### Glassmorphism
Translucent, layered, modern. Blurred backgrounds, glass surfaces.
- **Foundation:** moderate radii (`--radius-contain: var(--radius-lg)`), prominent shadows
- **Semantic:** surface tokens use `oklch(... / 0.7)` transparency
- **Interaction:** smooth easing, glow mint, standard durations
- **Composition:** layered Cards, depth via shadow + transparency, minimal borders (use shadow for separation)
- **How far the tokens carry it:** transparency and colour are token work and cost nothing.
  The blur is not, except behind overlays: `--blocks-overlay-backdrop-blur` (default `8px`)
  is read by the Dialog, Drawer and Sidebar backdrops, and raising it to `12px` gives those
  the heavier glass. Blurring a *surface* — a Card, a panel — has no token; add
  `backdrop-blur-*` through `class`/`slotClasses` on the components that need it. That is
  deliberate: a resting blur/glow token set was weighed in 2026-08 and not built, because
  shipping an aesthetic skin was decided against.

## Anti-Patterns

- Never use raw Tailwind color classes (`bg-blue-500`). Always use semantic tokens (`bg-primary`, `bg-surface-base`).
- Never add `dark:` overrides. Dark mode resolves automatically via `light-dark()`.
- Never override individual component CSS. Use `slotClasses`, `presets`, prop-conditional `overrides`, or `BlocksProvider` `defaults`.
- Never hardcode z-index values. Use token variables (`z-[var(--z-modal)]`).
- Never set `border-radius` to break one component out of its tier's rhythm. A consistent, project-wide radius choice is *good* — make it by overriding the semantic tier tokens (`--radius-commit`/`-modify`/`-contain`) together, which moves the whole families at once, not by rounding a lone component out of step with its peers. The one legitimate per-surface deviation is the optical one (`bridge`: a small tinted content surface, a panel under a pill trigger) — and `BlocksProvider` `defaults` is how you apply it to every instance of a component instead of repeating a class.
- Never mix paradigms within a single app. Pick one and apply it consistently across all layers.
