/**
 * The hand-maintained CSS design-token reference — the Knowledge-plane text behind
 * the local `urbicon css-reference` command and the remote `get_css_reference` MCP
 * tool. It lives in the engine (not the content bundle) because it is authored
 * prose, not a docs-gen artifact — and inlined as TS strings because both consumers
 * ship standalone (no blocks CSS at runtime), the same constraint that keeps the
 * linter's `VALID_TOKEN_CORES` inline. Drift is guarded by `css-reference.test.ts`,
 * which re-derives the token families from the real blocks CSS when run in-repo.
 */

export const CSS_REFERENCE_OVERVIEW = `# Urbicon UI — CSS Design Tokens

## Architecture
Three CSS layers, imported in order:
1. \`foundation.css\` — Raw OKLCH color scales (neutral, warm-neutral, primary, secondary, success, warning, danger, info)
2. \`semantic.css\` — Purpose-based tokens that reference foundation (\`--color-surface-base\`, \`--color-text-primary\`, etc.)
3. \`interaction.css\` — Animation timing, easing, shadows, focus rings

## Naming Convention
ALL semantic tokens use the \`--color-*\` CSS variable prefix.
Tailwind utilities map directly:

| Tailwind Utility | CSS Variable |
|---|---|
| \`bg-surface-base\` | \`var(--color-surface-base)\` |
| \`text-text-primary\` | \`var(--color-text-primary)\` |
| \`border-border-default\` | \`var(--color-border-default)\` |
| \`bg-primary\` | \`var(--color-primary)\` |
| \`text-success\` | \`var(--color-success)\` |

## Theme Override
Override tokens in your app CSS using Tailwind's \`@theme\` block:
\`\`\`css
@theme {
  --color-surface-base: #080818;
  --color-surface-elevated: #0e0e2a;
  --color-text-primary: #e0e0ff;
}
\`\`\`

## Dark Mode
Mechanism: semantic tokens use the CSS \`light-dark()\` function; \`:root\` declares \`color-scheme: light dark\` so the browser resolves the matching branch automatically (following the OS \`prefers-color-scheme\`). No \`dark:\` overrides.
Manual override: add a \`.light\` or \`.dark\` class to \`<html>\` (via the \`ThemeSwitcher\` component) — the class only flips \`color-scheme\`, and \`light-dark()\` re-resolves on its own.

To override a token for ALL modes (light, dark, and manual overrides):
\`\`\`css
@theme {
  --color-surface-base: #080818;
}
:root, :root.light, :root.dark {
  --color-surface-base: #080818;
}
\`\`\`
The \`@theme\` block sets the Tailwind utility value. The \`:root\` rule overrides the runtime value for all theme modes.

## Available Sections
- \`surfaces\` — 11 surface background tokens
- \`text\` — 9 text *color* tokens (for fonts/sizes/weights see \`typography\`)
- \`borders\` — 5 border color tokens
- \`intents\` — 6 component intents + the \`info\` status colour, feedback + interactive tokens + the \`live\` ("now") accent
- \`shadows\` — 5 shadow tokens + z-index scale + the **radius tiers** (\`radius\` resolves here)
- \`typography\` — Font families, size scale, weights, leading/tracking, and how to override them
- \`theming\` — How to create custom themes, available presets

Fetch a section with \`urbicon css-reference <section>\` (local CLI) or \`get_css_reference(section="<section>")\` (MCP).
`;

const SURFACES = `# Surface Tokens

12 tokens for background colors. All auto-switch in dark mode.

| CSS Variable | Tailwind Utility | Purpose |
|---|---|---|
| \`--color-surface-base\` | \`bg-surface-base\` | Page background |
| \`--color-surface-quiet\` | \`bg-surface-quiet\` | Softly tinted in-page zone |
| \`--color-surface-subtle\` | \`bg-surface-subtle\` | Resting tint only — resolves to \`surface-elevated\`, so never use it as a hover step. Prefer \`surface-quiet\` for a tinted in-page zone |
| \`--color-surface-elevated\` | \`bg-surface-elevated\` | Cards, panels (floating with shadow) |
| \`--color-surface-overlay\` | \`bg-surface-overlay\` | Modals, popovers |
| \`--color-surface-interactive\` | \`bg-surface-interactive\` | Interactive element backgrounds |
| \`--color-surface-interactive-hover\` | \`bg-surface-interactive-hover\` | Hover step for an element resting on \`surface-interactive\` (\`surface-hover\` is the step for elements on a reading surface, and resolves to the same value as \`surface-interactive\` itself) |
| \`--color-surface-hover\` | \`bg-surface-hover\` | Hover state |
| \`--color-surface-active\` | \`bg-surface-active\` | Active/pressed state |
| \`--color-surface-disabled\` | \`bg-surface-disabled\` | Disabled elements |
| \`--color-surface-selected\` | \`bg-surface-selected\` | Selected items (uses primary-50) |
| \`--color-surface-inverted\` | \`bg-surface-inverted\` | Inverted surfaces (tooltips) |

Light → Dark mapping examples:
- \`surface-base\`: neutral-0 (white) → neutral-900 (near-black)
- \`surface-quiet\`: neutral-25 → neutral-850
- \`surface-elevated\`: neutral-50 → neutral-800
- \`surface-hover\`: neutral-100 → neutral-750

Override example (dark neon theme):
\`\`\`css
@theme {
  --color-surface-base: #080818;
  --color-surface-quiet: #0a0a20;
  --color-surface-elevated: #0e0e2a;
  --color-surface-overlay: #12123a;
}
\`\`\`
`;

const TEXT = `# Text Tokens

12 tokens for text colors. All auto-switch in dark mode except \`text-on-warning\`,
which is deliberately mode-invariant (warning's fill is light amber in both modes,
so its label is a warm dark in both).

| CSS Variable | Tailwind Utility | Purpose |
|---|---|---|
| \`--color-text-primary\` | \`text-text-primary\` | Main text |
| \`--color-text-secondary\` | \`text-text-secondary\` | Supporting text |
| \`--color-text-tertiary\` | \`text-text-tertiary\` | Muted text, metadata |
| \`--color-text-quaternary\` | \`text-text-quaternary\` | Most subtle text |
| \`--color-text-disabled\` | \`text-text-disabled\` | Disabled text |
| \`--color-text-inverted\` | \`text-text-inverted\` | Text on inverted surfaces |
| \`--color-text-on-fill\` | \`text-text-on-fill\` | Text on any solid intent fill (all intents except warning) — reach for this one |
| \`--color-text-on-primary\` | \`text-text-on-primary\` | Text on the **primary** fill specifically; an alias of \`on-fill\` |
| \`--color-text-on-warning\` | \`text-text-on-warning\` | Text on the warning fill — warm dark (warning-950) in both modes |
| \`--color-text-on-dark\` | \`text-text-on-dark\` | Text on dark surfaces |
| \`--color-text-on-surface\` | \`text-text-on-surface\` | Text on any surface (auto-contrast) — never on intent fills |
| \`--color-text-link\` | \`text-text-link\` | Link ink on reading surfaces; follows the primary intent's AA text step |

Light → Dark mapping:
- \`text-primary\`: neutral-900 (dark) → neutral-100 (light)
- \`text-secondary\`: neutral-700 → neutral-300
- \`text-tertiary\`: neutral-500 → neutral-400
`;

const BORDERS = `# Border Tokens

5 tokens for border colors. All auto-switch in dark mode.

| CSS Variable | Tailwind Utility | Purpose |
|---|---|---|
| \`--color-border-hairline\` | \`border-border-hairline\` | Faintest divider — translucent (alpha), not a neutral step |
| \`--color-border-subtle\` | \`border-border-subtle\` | Gentle grouping |
| \`--color-border-default\` | \`border-border-default\` | Standard borders |
| \`--color-border-emphasis\` | \`border-border-emphasis\` | Emphasized borders |
| \`--color-border-strong\` | \`border-border-strong\` | High-contrast borders |

Light → Dark mapping:
- \`border-hairline\`: black 8% → white 6% (translucent, blends onto any surface)
- \`border-subtle\`: neutral-200 → neutral-700
- \`border-default\`: neutral-300 → neutral-600
- \`border-emphasis\`: neutral-400 → neutral-500
- \`border-strong\`: neutral-500 → neutral-400

Also available for intent-colored borders:
\`border-primary\`, \`border-success\`, \`border-warning\`, \`border-danger\`, \`border-secondary\`, \`border-neutral\`
`;

const INTENTS = `# Intent Color System

6 component intents (primary, secondary, success, warning, danger, neutral) plus a status \`info\` colour — each a full palette with 5 semantic variants + 11 foundation steps.

## Semantic Intent Tokens (auto dark mode)

Each intent has these variants (example: \`primary\`):

| CSS Variable | Tailwind Utility | Purpose | Light | Dark |
|---|---|---|---|---|
| \`--color-primary\` | \`bg-primary\` | Base intent color — a FILL, never a text colour | primary-600 | primary-500 |
| \`--color-primary-hover\` | \`bg-primary-hover\` | Hover state | primary-700 | primary-400 |
| \`--color-primary-active\` | \`bg-primary-active\` | Pressed state | primary-800 | — |
| \`--color-primary-subtle\` | \`bg-primary-subtle\` | Soft background | primary-50 | primary-900 |
| \`--color-primary-text\` | \`text-primary-text\` | Intent-coloured text on a surface (AA-clean) | primary-700 | primary-400 |
| \`--color-primary-emphasis\` | \`bg-primary-emphasis\` / \`text-primary-emphasis\` | Near-ink text tier / strong fill | primary-900 | primary-200 |

Same pattern applies to: \`success-*\`, \`warning-*\`, \`danger-*\`, \`secondary-*\`, \`neutral-*\`
— except that \`neutral\` has no \`-text\` role: its base already clears AA as text on
every ground (the chassis ramp is text-tuned), so \`text-neutral\` is fine as it is.

**Intent-coloured text takes \`-text\`, never the base.** The base token is tuned as a
*fill* — a surface with \`text-text-on-fill\` sitting on it — and as text on a calm
ground it misses AA: measured across all six themes the base stops bottom out at
4.08:1 (primary, dark, \`surface-elevated\`) and 2.05:1 (warning, light — yellow on
white). \`text-primary-text\` is the same hue at the nearest stop that clears AA 4.5 on
every reading surface AND on the intent's own \`-subtle\` (an Alert's ground), in both
modes, in every shipped theme — held by the library's contrast gate. Two text tiers on
purpose, mirroring Radix's steps 11/12: \`-text\` still reads as the colour (danger text
stays red); \`-emphasis\` is the near-ink tier for strong statements and doubles as a
fill. (Not to be confused with \`text-text-primary\`, the body-copy token.)

\`info-*\` has the identical shape (\`--color-info\`, \`-hover\`, \`-active\`, \`-subtle\`, \`-text\`, \`-emphasis\` → \`bg-info\`, \`text-info-text\`, \`bg-info-subtle\`, …) — the status/feedback blue (hue 220) behind Alert and Toast's info state, \`--color-feedback-info\`, and \`--color-chart-5\`. It is NOT in the global \`ComponentIntent\` union above: only the feedback components (Alert, Toast) accept \`intent="info"\`, because only there does "informational" name a status. Everything else — Button, Badge, Tooltip, … — takes the six-value union, so reach for the \`bg-info\`/\`text-info-text\` utilities rather than \`intent="info"\`. (Tooltip carried \`info\` until v6.42; it rendered one hue step from \`primary\` and implied a distinction it could not show.)

## Labels on Filled Intents

Text sitting ON a solid intent fill takes \`text-text-on-fill\` — mode-aware (white in light mode, near-black in dark mode, where the fills resolve to their lighter stops). The one exception is \`warning\`: its fill stays light amber in BOTH modes, so its label is \`text-text-on-warning\` — a warm dark (the ramp's own 950 stop) that deliberately does NOT switch with the mode and follows theme re-hues. Never use \`text-text-on-surface\` on an intent fill — it tracks the page background, not the fill. \`text-text-on-primary\` still exists and resolves to the same value; it is scoped to the primary fill so that a theme retuning the primary label does not repaint success/danger/neutral along with it.

## Categories are not statuses — the chart ramp

An intent says *how severe*, not *which kind*. Workflow stages, types, priorities, owners and
tags carry no severity, so mapping them onto intents (\`roasting\` → warning, \`normal\` → info)
paints an interface that shouts about a problem that does not exist — measured repeatedly on
generated pages, and the most common colour defect there is.

- One category, no ranking → a neutral label: \`<Badge purpose="tag" intent="neutral">\`.
- Several categories that must be told apart at a glance → the chart ramp, built for exactly
  this and re-tinted by every theme:

| CSS Variable | Tailwind | Derived from |
|---|---|---|
| \`--color-chart-1\` | \`bg-chart-1\` / \`text-chart-1\` | primary |
| \`--color-chart-2\` | \`bg-chart-2\` | success |
| \`--color-chart-3\` | \`bg-chart-3\` | warning |
| \`--color-chart-4\` | \`bg-chart-4\` | secondary |
| \`--color-chart-5\` | \`bg-chart-5\` | info |
| \`--color-chart-6\` | \`bg-chart-6\` | danger |

The ramp borrows the intent *hues* (so a theme retint carries through) but names a **series
position**, not a meaning — \`chart-3\` is "the third series", never "warning". Charts consume it
in order; reuse it for categorical fills, legends and category dots. Anything with a genuine
severity keeps its intent.

## Foundation Intent Scales

Each intent has 11 numbered steps (50–950) for granular control:
\`\`\`
--color-primary-50   through  --color-primary-950
--color-success-50   through  --color-success-950
--color-warning-50   through  --color-warning-950
--color-danger-50    through  --color-danger-950
--color-secondary-50 through  --color-secondary-950
--color-neutral-50   through  --color-neutral-950
--color-info-50      through  --color-info-950
\`\`\`

Two ramps carry stops beyond the standard 50–950:
- \`neutral\` adds finer steps — \`--color-neutral-0\` (pure white), \`-25\`, \`-650\`, \`-750\`, \`-850\` — so \`bg-neutral-650\` and friends are real tokens (they drive the surface/border light↔dark mappings), not hallucinations.
- \`--color-warm-neutral-50\` through \`-950\` is a separate warm-tinted greyscale ramp; the \`neutral\` intent borrows its lightness profile (see the theming section) rather than exposing it as a surface.

Tailwind usage: \`bg-primary-500\`, \`text-danger-700\`, \`border-success-300\`, etc.

## Feedback Tokens (for status messages)

| CSS Variable | Tailwind Utility | Maps to |
|---|---|---|
| \`--color-feedback-info\` | \`bg-feedback-info\` / \`text-feedback-info\` | info-500 |
| \`--color-feedback-info-subtle\` | \`bg-feedback-info-subtle\` | info-50 |
| \`--color-feedback-success\` | \`bg-feedback-success\` / \`text-feedback-success\` | success-500 |
| \`--color-feedback-success-subtle\` | \`bg-feedback-success-subtle\` | success-50 |
| \`--color-feedback-warning\` | \`bg-feedback-warning\` / \`text-feedback-warning\` | warning-500 |
| \`--color-feedback-warning-subtle\` | \`bg-feedback-warning-subtle\` | warning-50 |
| \`--color-feedback-error\` | \`bg-feedback-error\` / \`text-feedback-error\` | danger-500 |
| \`--color-feedback-error-subtle\` | \`bg-feedback-error-subtle\` | danger-50 |

## Interactive Tokens

| CSS Variable | Tailwind Utility | Purpose |
|---|---|---|
| \`--color-interactive-hover\` | \`bg-interactive-hover\` | 10% primary overlay |
| \`--color-interactive-active\` | \`bg-interactive-active\` | 20% primary overlay |
| \`--color-interactive-focus\` | \`ring-interactive-focus\` | Focus ring color (primary-500) |
| \`--color-interactive-disabled\` | \`bg-interactive-disabled\` | Disabled state (neutral-200) |

## Live / "Now" Accent

| CSS Variable | Tailwind Utility | Purpose |
|---|---|---|
| \`--color-live\` | \`border-live\` / \`bg-live\` | Live/now markers — the Calendar current-time line and dot, recording/live indicators. Red by convention (defaults to danger-500 light / danger-400 dark) but semantically distinct from \`danger\`: override \`--color-live\` alone to restyle live markers without touching error styling. |

## Override Example: Custom Intent
\`\`\`css
@theme {
  --color-primary-50: oklch(0.95 0.03 280);
  --color-primary-100: oklch(0.9 0.06 280);
  --color-primary-200: oklch(0.82 0.09 280);
  --color-primary-300: oklch(0.74 0.12 280);
  --color-primary-400: oklch(0.66 0.14 280);
  --color-primary-500: oklch(0.58 0.14 280);
  --color-primary-600: oklch(0.52 0.14 280);
  --color-primary-700: oklch(0.44 0.12 280);
  --color-primary-800: oklch(0.36 0.1 280);
  --color-primary-900: oklch(0.28 0.07 280);
  --color-primary-950: oklch(0.18 0.04 280);
}
\`\`\`
Semantic tokens (\`--color-primary\`, \`--color-primary-hover\`, etc.) automatically reference the new scale.
`;

const SHADOWS = `# Shadow & Z-Index Tokens

## Shadow Tokens

| CSS Variable | Tailwind Utility | Purpose |
|---|---|---|
| \`--blocks-shadow-scale-xs\` | \`shadow-[var(--blocks-shadow-xs)]\` | Minimal shadow |
| \`--blocks-shadow-scale-sm\` | \`shadow-[var(--blocks-shadow-sm)]\` | Buttons, small elements |
| \`--blocks-shadow-scale-base\` | \`shadow-[var(--blocks-shadow-base)]\` | Default elevation |
| \`--blocks-shadow-scale-md\` | \`shadow-[var(--blocks-shadow-md)]\` | Hover states, menus |
| \`--blocks-shadow-scale-lg\` | \`shadow-[var(--blocks-shadow-lg)]\` | Modals, popovers |

Shadows automatically increase opacity in dark mode (0.05 → 0.2 for xs, etc.).

## Z-Index Scale

| CSS Variable | Value | Purpose |
|---|---|---|
| \`--z-hide\` | -1 | Hidden |
| \`--z-base\` | 0 | Default |
| \`--z-docked\` | 10 | Docked elements |
| \`--z-sticky\` | 1100 | Sticky headers |
| \`--z-dropdown\` | 1150 | Menus, listboxes, floating panels (above sticky, below banner) |
| \`--z-banner\` | 1200 | Banners |
| \`--z-overlay\` | 1300 | Overlays |
| \`--z-sidebar\` | 1350 | Sidebars |
| \`--z-modal\` | 1400 | Modals |
| \`--z-popover\` | 1500 | Popovers |
| \`--z-toast\` | 1700 | Toasts |
| \`--z-tooltip\` | 1800 | Tooltips |

Usage: \`z-[var(--z-modal)]\`

## Border Radius — decide it at the tier, not per element

Shape is a property of what a component *does*, not of where it sits. Every component already
sits in the right tier and rounds itself correctly; you change the look of a whole family by
overriding its token — never by rounding one component out of step with its peers.

| Tier | Token | Default | The family | Utility |
|---|---|---|---|---|
| Commit | \`--radius-commit\` | \`9999px\` (pill) | Button, ButtonGroup, Badge, Toggle, SegmentGroup | \`rounded-commit\` |
| Modify | \`--radius-modify\` | \`--radius-sm\` (4px) | Input, Textarea, Select, Combobox, Tab, Menu item | \`rounded-modify\` |
| Contain | \`--radius-contain\` | \`--radius-xs\` (2px) | Card, Dialog, Drawer, Alert, Popover, Tooltip, Toolbar surface | \`rounded-contain\` |
| Bridge | \`--radius-bridge\` | \`--radius-md\` (6px) | small tinted content surfaces — see below | \`rounded-bridge\` |

\`\`\`css
/* app-theme.css — ONE project-wide shape decision; every component of the family follows */
@theme {
  --radius-commit: var(--radius-xl);   /* less playful actions */
  --radius-contain: var(--radius-md);  /* friendlier containers */
}
\`\`\`

The tiers rank **roles, not nesting**: actions softest (committing should feel inviting), fields
in between (they read as tap areas), containers tightest (architecture should read as precise). A
pill Button inside a hairline-edged Card is the point of the system, not a defect — and
\`--radius-commit: var(--radius-lg)\` with \`--radius-contain: var(--radius-sm)\` is the same ranking
in a quieter voice. Move the families **together** so a reader can state the rule; re-ordering them
deliberately (containers softer than actions) is allowed, but then carry it everywhere.

**Bridge — the sanctioned exception, in two cases.** (1) *Optical size*: radius scales with the
area it turns, so 2px on a 600px Card reads as a precise edge while the same 2px on a ~200px tile
reads as a plain rectangle — a small tinted surface is *content*, not architecture, and takes the
middle tier (\`<Card tier="bridge">\`, the ChatMessage bubble). (2) *Adjacency*: a floating panel
anchored to a pill trigger reads disconnected at 2px and over-sized at pill radius, which is why
a Menu panel under a commit-tier trigger is bridge by default. Anything that genuinely is a panel,
dialog or container stays on \`contain\`.

A 2px edge only reads as a decision when the surface is big enough to show its edge — and when
something else on the page (a pill action, a circular avatar) carries the contrast.

Project-wide but only for one component? \`BlocksProvider\` \`defaults\`
(\`Card: { slotClasses: { base: 'rounded-bridge' } }\`) moves every instance at once. A hand-set
\`border-radius\` (\`class="rounded-*"\`) on a single element is the last resort, for a surface
that genuinely falls out of its family — and it should be obvious from the markup why.

### The raw scale the tiers are built from

Use it for your own markup (an icon chip, a hand-built tile) — not to overrule a component tier.

| CSS Variable | Tailwind | Value |
|---|---|---|
| \`--radius-xs\` | \`rounded-xs\` | 0.125rem |
| \`--radius-sm\` | \`rounded-sm\` | 0.25rem |
| \`--radius-md\` | \`rounded-md\` | 0.375rem |
| \`--radius-lg\` | \`rounded-lg\` | 0.5rem |
| \`--radius-xl\` | \`rounded-xl\` | 0.75rem |
| \`--radius-2xl\` | \`rounded-2xl\` | 1rem |
| \`--radius-3xl\` | \`rounded-3xl\` | 1.5rem |
| \`--radius-4xl\` | \`rounded-4xl\` | 2rem |

## Duration & Easing Tokens

| CSS Variable | Value |
|---|---|
| \`--blocks-duration-instant\` | 75ms |
| \`--blocks-duration-fast\` | 150ms |
| \`--blocks-duration-normal\` | 250ms |
| \`--blocks-duration-slow\` | 350ms |
| \`--blocks-duration-slower\` | 500ms |
| \`--blocks-ease-confident\` | Standard transitions |
| \`--blocks-ease-springy\` | Bouncy animations |
| \`--blocks-ease-smooth\` | Gentle animations |
| \`--blocks-ease-snappy\` | Quick, decisive |
`;

const TYPOGRAPHY = `# Typography

Type is themeable exactly like color, through the same \`@theme\` block. There is no separate
Urbicon typography token layer: sizes, weights, leading, tracking and families are Tailwind's own
theme variables, and overriding them retunes every component at once.

## Font families

The library **never sets \`font-sans\`** — body type inherits from your page, so you already own the
font decision without overriding anything. It *does* use \`font-mono\` in a few meta surfaces
(CommandPalette shortcut keys, JourneyTimeline meta), so \`--font-mono\` is worth setting.

\`\`\`css
@theme {
  --font-sans: 'Inter Variable', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
\`\`\`

\`apps/docs/src/lib/style/rooms-docs.css\` is a live example: it rethemes the whole library's type by
setting \`--font-mono\`, \`--font-sans\` and \`--font-display\`.

## Size scale — know where the leverage is

Tailwind's built-in sizes each have a **paired \`--text-*--line-height\`**. Change the size without
it and the vertical rhythm goes subtly wrong everywhere that size is used. Always set both:

\`\`\`css
@theme {
  --text-sm: 0.9375rem;
  --text-sm--line-height: calc(1.375 / 0.9375);
}
\`\`\`

The library's usage is steep and lopsided — overriding the wrong end of the scale does nothing:

| Variable | Utility | Default | Reach in the library |
|---|---|---|---|
| \`--text-3xs\` | \`text-3xs\` | 0.625rem / 10px | library-added, size-only; the sub-xs floor — chart axis + donut sub-labels, Progress \`xs\`, Kbd \`sm\`, CommandPalette, Sankey, Planner, ResourceTimeline, CompositionBar, Calendar year view (9 components) |
| \`--text-2xs\` | \`text-2xs\` | 0.6875rem / 11px | library-added, size-only; dense chrome — Calendar (the heaviest user, but under half), CommandPalette, JourneyTimeline, Kbd, PromptInput, ResourceTimeline, CompositionBar |
| \`--text-xs\` | \`text-xs\` | 0.75rem / 12px | heavy |
| \`--text-sm\` | \`text-sm\` | 0.875rem / 14px | **the highest-leverage override** |
| \`--text-base\` | \`text-base\` | 1rem / 16px | heavy |
| \`--text-lg\` | \`text-lg\` | 1.125rem / 18px | moderate |
| \`--text-xl\` | \`text-xl\` | 1.25rem / 20px | light |
| \`--text-2xl\` and above | — | — | **unused by the library** |

So \`--text-sm\` reshapes the library; \`--text-6xl\` is a no-op (nothing above \`text-xl\` is used).
Sizes above \`xl\` still work for *your* markup — they just don't move any component.

\`--text-2xs\` / \`--text-3xs\` are the library's own additions to Tailwind's scale and are
**deliberately size-only** (no paired line-height): Tailwind emits \`line-height\` for a scale entry
only when the paired key exists, so they inherit it from the cascade instead of injecting one at
every call site. Add the paired key in your own \`@theme\` if you want one.

## Weights, leading, tracking

\`\`\`css
@theme {
  --font-weight-medium: 550;   /* the library's most-used weight */
  --font-weight-semibold: 650;
  --leading-tight: 1.3;
  --tracking-wide: 0.02em;
}
\`\`\`

## Why this works (and when it stops)

Overrides win because the library deliberately does **not** \`@import 'tailwindcss'\` — there is
exactly one Tailwind compilation (yours), processed last. If your tooling introduces a second
Tailwind compilation, typography overrides silently revert — exactly like color overrides do. See
\`docs/TailwindCaveats.md\` → "Library CSS must not import Tailwind".
`;

const THEMING = `# Theming Guide

## Built-in Themes

Import AFTER base styles:
\`\`\`css
@import '@urbicon-ui/blocks/style/index.css';
@import '@urbicon-ui/blocks/style/themes/ocean.css';
\`\`\`

Available: \`ocean.css\` (blue-teal), \`forest.css\` (green), \`sunset.css\` (orange-amber), \`rose.css\` (pink), \`neutral.css\` (grayscale)

Each theme overrides three foundation ramps: \`--color-primary-*\`, \`--color-secondary-*\`, and \`--color-neutral-*\`. The neutral ramp is the chassis — surfaces, text and borders all derive from it (see below), so each theme re-tints it to match the accent's temperature (Sunset shifts it warm, Ocean cool). Each colored theme additionally re-tunes only the intent ramps that would collide with its accent (e.g. Forest pushes success/warning off its green/lime, Ocean moves info off the brand blue), sets a matching \`--blocks-shadow-tint\`, and re-tints the NEUTRAL intent (\`bg-neutral\` / \`text-neutral\` / neutral borders) to its temperature via \`--neutral-chrome-hue\`. Other non-colliding intents (success/warning/danger/info) stay at the library defaults. The Neutral theme inherits the cool default chrome and leaves those intents + shadow tint untouched.

The neutral intent is special: it keeps the \`--color-warm-neutral-*\` ramp's lightness profile (tuned so white-on-\`bg-neutral\` AND \`text-neutral\`-on-surface both stay legible across light/dark) and only swaps the hue via \`--neutral-chrome-hue\`. Set that token (default 240) in a \`:root\` rule to re-tint neutral controls without touching contrast — e.g. \`:root { --neutral-chrome-hue: 50; }\` for a warm theme. Do NOT repoint the neutral intent onto the chassis \`--color-neutral-*\` ramp: its surface-tuned lightness breaks the white-text / neutral-text contrast balance.

## The neutral ramp IS the chassis — match its temperature to your accent

This is the single most common theming mistake: recolor \`--color-primary-*\` only, ship it, and the warm brand button ends up sitting on cool blue-grey cards. Reason: \`surface-*\`, \`text-*\` and \`border-*\` do NOT derive from primary — they derive from \`--color-neutral-*\`, which defaults to a cool Hue 240. A warm accent on a Hue-240 chassis reads broken.

Fix: when you change the accent hue, re-tint the neutral ramp to the same temperature family. Keep each stop's lightness and chroma identical to the foundation ramp (chroma stays tiny, ≤0.017) and shift only the hue — this keeps the chassis near-grey, preserves WCAG contrast, and the warmth/coolness flows automatically to every surface, text and border token via \`semantic.css\`. No per-token surface overrides needed.

## Creating a Custom Theme

Pick an accent hue (0–360) and a chassis hue in the same temperature family (often the accent hue itself, or pulled slightly toward grey). Generate matched OKLCH ramps — the Theme Builder at \`/customization/theme-builder\` does this for you: it emits the accent ramps, the matched chassis, and (for a tinted chassis) the \`:root\` \`--blocks-shadow-tint\` + \`--neutral-chrome-hue\` knobs, and it warns when your accent collides with an intent hue. It does NOT re-tune the colliding intent ramp — that call is yours:
\`\`\`css
/* my-theme.css — warm brand on a warm chassis */
@theme {
  /* Primary: hue 280 (purple) */
  --color-primary-50: oklch(0.95 0.03 280);
  --color-primary-100: oklch(0.9 0.06 280);
  --color-primary-200: oklch(0.82 0.09 280);
  --color-primary-300: oklch(0.74 0.12 280);
  --color-primary-400: oklch(0.66 0.14 280);
  --color-primary-500: oklch(0.58 0.14 280);
  --color-primary-600: oklch(0.52 0.14 280);
  --color-primary-700: oklch(0.44 0.12 280);
  --color-primary-800: oklch(0.36 0.1 280);
  --color-primary-900: oklch(0.28 0.07 280);
  --color-primary-950: oklch(0.18 0.04 280);

  /* Secondary: hue 320 (magenta) */
  --color-secondary-50: oklch(0.95 0.03 320);
  /* ... same pattern with hue 320 ... */
  --color-secondary-950: oklch(0.18 0.04 320);

  /* Chassis: neutral ramp re-tinted to hue 290 (matches the purple accent).
     Same L + C as the foundation neutral ramp — only the hue moves. */
  --color-neutral-25: oklch(0.99 0.002 290);
  --color-neutral-50: oklch(0.98 0.005 290);
  --color-neutral-100: oklch(0.95 0.008 290);
  --color-neutral-200: oklch(0.89 0.012 290);
  --color-neutral-300: oklch(0.83 0.014 290);
  --color-neutral-400: oklch(0.7 0.015 290);
  --color-neutral-500: oklch(0.55 0.016 290);
  --color-neutral-600: oklch(0.42 0.017 290);
  --color-neutral-650: oklch(0.38 0.016 290);
  --color-neutral-700: oklch(0.32 0.016 290);
  --color-neutral-750: oklch(0.28 0.014 290);
  --color-neutral-800: oklch(0.23 0.015 290);
  --color-neutral-850: oklch(0.18 0.014 290);
  --color-neutral-900: oklch(0.15 0.012 290);
  --color-neutral-950: oklch(0.08 0.008 290);
}
\`\`\`
For a temperature-free, true grayscale chassis (content-focused UIs), set chroma to 0 on every neutral stop instead of shifting the hue.

## Intent-hue collisions

If your accent hue lands near an intent hue, the two become hard to tell apart. The library intents sit at: success 140, warning 80, danger 25, info 220, secondary 280. A green brand (~140) collides with success; an amber brand (~80) collides with warning. When that happens, re-tune the colliding intent ramp away from the accent (push the hue ±15–25° and/or drop its lightness so it reads as "status", not "brand"). \`apps/docs/src/lib/style/rooms-docs.css\` is a worked example (green brand → success pushed to 150 + darkened, warning pulled to amber 55).

## Overriding Semantic Tokens

To override semantic tokens directly (e.g. a fully art-directed dark theme, or custom surface stops beyond what re-tinting the neutral ramp gives you):
\`\`\`css
@theme {
  --color-surface-base: #080818;
  --color-surface-elevated: #0e0e2a;
  --color-text-primary: #e0e0ff;
}
\`\`\`

If your override should apply regardless of light/dark mode, also set:
\`\`\`css
:root, :root.light, :root.dark {
  --color-surface-base: #080818;
  --color-surface-elevated: #0e0e2a;
  --color-text-primary: #e0e0ff;
}
\`\`\`

## Gotcha: SCOPED themes must re-declare derived tokens

This trap only applies when you scope a theme to a CLASS (e.g. \`.theme-sunset { ... }\` toggled at runtime) instead of a global \`@theme\`/\`:root\` block.

Custom-property substitution happens per element at computed-value time, and inheritance passes the ALREADY-substituted value. \`semantic.css\` defines derived tokens at \`:root\`, e.g.
\`\`\`css
:root { --color-primary: light-dark(var(--color-primary-600), var(--color-primary-500)); }
\`\`\`
That \`var(--color-primary-600)\` resolves against the \`:root\` ramp. If you override \`--color-primary-600\` only inside \`.theme-sunset\`, the element inherits the already-resolved (default) \`--color-primary\` — your new ramp is ignored for every derived token.

Fix: inside the scoped block, re-declare the derived tokens too, so substitution re-runs at that level:
\`\`\`css
.theme-sunset {
  --color-primary-600: oklch(0.55 0.15 55);
  /* ...rest of the ramp... */

  /* re-declare so the derived tokens re-substitute against the new ramp */
  --color-primary: light-dark(var(--color-primary-600), var(--color-primary-500));
  --color-primary-hover: light-dark(var(--color-primary-700), var(--color-primary-400));
  --color-primary-subtle: light-dark(var(--color-primary-50), var(--color-primary-900));
  --color-primary-text: light-dark(var(--color-primary-700), var(--color-primary-400));
  /* ...and the same for any neutral-derived surface/text/border tokens you rely on */
}
\`\`\`
The \`-text\` role is the easiest one to forget and the most visible when forgotten: every
intent-coloured label in the scope silently keeps the DEFAULT palette while its fills take
yours. The role and its ramp always move together — a theme that re-points only
\`--color-primary\` (the minimal rebrand) must re-point \`--color-primary-text\` in the same
block, or links render in the old brand's colour next to buttons in the new one.
A global \`@theme\` block (the built-in themes, the Theme Builder output) does NOT hit this — everything lands on \`:root\`, the same element where the derived tokens compute, so re-declaration is unnecessary. Prefer global themes unless you genuinely need multiple themes live on one page. \`apps/docs/src/lib/style/rooms-docs.css\` is the canonical scoped example.

## Component-Level Overrides

Use \`BlocksProvider\` to style components project-wide — unconditional \`defaults\`, named \`presets\` (opt-in via the \`preset\` prop), and prop-conditional \`overrides\`:
\`\`\`svelte
<BlocksProvider defaults={{
  Card: { slotClasses: { base: 'rounded-2xl shadow-lg' } },
  Button: { slotClasses: { base: 'rounded-full font-bold uppercase' } },
  // prop-conditional: style ONLY the outlined variant — what an unconditional slotClasses cannot express
  Badge: { overrides: [{ variant: 'outlined', class: { base: 'border' } }] }
}}>
\`\`\`
Cascade (conflict-resolved per Tailwind bucket, later wins): \`defaults.slotClasses → defaults.overrides → preset.slotClasses → preset.overrides → instance slotClasses → instance class\`.

Or override per-instance:
\`\`\`svelte
<Card class="rounded-2xl" padding="lg">...</Card>
<Button unstyled slotClasses={{ base: 'custom-button-class' }}>...</Button>
\`\`\`

## Tailwind 4 — Scanning Component Classes

Tailwind 4 does not scan \`node_modules\` by default, so the responsive utilities (\`lg:hidden\`, \`md:grid-cols-2\`, etc.) used inside Urbicon UI components must be registered as content sources. **The library does this for you:** \`@urbicon-ui/blocks/style/index.css\` ships the \`@source\` directives that point Tailwind at the component classes, and \`@urbicon-ui/table/style/index.css\` / \`@urbicon-ui/auth/style/index.css\` do the same for the Table and the auth components.

So the only requirement is to import \`index.css\` (your app owns the Tailwind import; it comes first):
\`\`\`css
@import 'tailwindcss';
@import '@urbicon-ui/blocks/style/index.css'; /* tokens + @source directives */
@import '@urbicon-ui/table/style/index.css';  /* if using Table */
@import '@urbicon-ui/auth/style/index.css';   /* if using Auth */
\`\`\`

**Do NOT add manual \`@source\` directives, and do NOT import the \`foundation\`/\`semantic\`/\`interaction\` subfiles instead of \`index.css\`** — the subfiles omit the \`@source\` directives (and global classes), which is the usual cause of "responsive layouts break in production".
`;

/** Section names, in presentation order — reuse for CLI validation and MCP enum schemas. */
export const CSS_REFERENCE_SECTION_NAMES = [
  'surfaces',
  'text',
  'borders',
  'intents',
  'shadows',
  'typography',
  'theming'
] as const;

export type CssReferenceSection = (typeof CSS_REFERENCE_SECTION_NAMES)[number];

/**
 * Names an agent reaches for before it finds the real section — measured, not
 * guessed. In a recorded run the model called `css-reference z-index` and
 * `css-reference shadow` (both failures) before landing on `shadows`, *while the
 * section was already in its primer*: the z-index scale lives under the
 * "Shadow & Z-Index Tokens" heading inside `shadows`, and nobody looking for
 * z-index looks under shadows.
 *
 * Aliases deliberately stay out of CSS_REFERENCE_SECTION_NAMES — that list is the
 * canonical set behind `--help` and the MCP enum, and an alias is a second door to
 * one room, not a room of its own. Everything not listed here still fails loud.
 */
export const CSS_REFERENCE_SECTION_ALIASES: Readonly<Record<string, CssReferenceSection>> = {
  'z-index': 'shadows',
  zindex: 'shadows',
  shadow: 'shadows',
  // Same trap as z-index, one section later: the radius tiers live under
  // "Shadow & Z-Index Tokens", and nobody looking for radius looks under shadows.
  radius: 'shadows',
  'border-radius': 'shadows',
  rounded: 'shadows',
  shape: 'shadows',
  tier: 'shadows'
};

/**
 * Resolve a user-supplied section name to a canonical one, or `undefined` if it is
 * neither a section nor an alias — the caller decides how loudly to fail.
 */
export function resolveCssReferenceSection(section: string): CssReferenceSection | undefined {
  if (section in CSS_REFERENCE_SECTIONS) return section as CssReferenceSection;
  return CSS_REFERENCE_SECTION_ALIASES[section];
}

export const CSS_REFERENCE_SECTIONS: Record<CssReferenceSection, string> = {
  surfaces: SURFACES,
  text: TEXT,
  borders: BORDERS,
  intents: INTENTS,
  shadows: SHADOWS,
  typography: TYPOGRAPHY,
  theming: THEMING
};

/** Render the reference: a known section's text (aliases included), or the overview when omitted/unknown. */
export function renderCssReference(section?: string): string {
  const resolved = section ? resolveCssReferenceSection(section) : undefined;
  return resolved ? CSS_REFERENCE_SECTIONS[resolved] : CSS_REFERENCE_OVERVIEW;
}
