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
- \`text\` — 9 text color tokens
- \`borders\` — 5 border color tokens
- \`intents\` — 6 component intents + the \`info\` status colour, feedback + interactive tokens
- \`shadows\` — 5 shadow tokens + z-index scale
- \`theming\` — How to create custom themes, available presets

Fetch a section with \`urbicon css-reference <section>\` (local CLI) or \`get_css_reference(section="<section>")\` (MCP).
`;

const SURFACES = `# Surface Tokens

11 tokens for background colors. All auto-switch in dark mode.

| CSS Variable | Tailwind Utility | Purpose |
|---|---|---|
| \`--color-surface-base\` | \`bg-surface-base\` | Page background |
| \`--color-surface-quiet\` | \`bg-surface-quiet\` | Softly tinted in-page zone |
| \`--color-surface-subtle\` | \`bg-surface-subtle\` | Subtle differentiation |
| \`--color-surface-elevated\` | \`bg-surface-elevated\` | Cards, panels (floating with shadow) |
| \`--color-surface-overlay\` | \`bg-surface-overlay\` | Modals, popovers |
| \`--color-surface-interactive\` | \`bg-surface-interactive\` | Interactive element backgrounds |
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

9 tokens for text colors. All auto-switch in dark mode.

| CSS Variable | Tailwind Utility | Purpose |
|---|---|---|
| \`--color-text-primary\` | \`text-text-primary\` | Main text |
| \`--color-text-secondary\` | \`text-text-secondary\` | Supporting text |
| \`--color-text-tertiary\` | \`text-text-tertiary\` | Muted text, metadata |
| \`--color-text-quaternary\` | \`text-text-quaternary\` | Most subtle text |
| \`--color-text-disabled\` | \`text-text-disabled\` | Disabled text |
| \`--color-text-inverted\` | \`text-text-inverted\` | Text on inverted surfaces |
| \`--color-text-on-primary\` | \`text-text-on-primary\` | Text on intent-colored backgrounds |
| \`--color-text-on-dark\` | \`text-text-on-dark\` | Text on dark surfaces |
| \`--color-text-on-surface\` | \`text-text-on-surface\` | Text on any surface (auto-contrast) |

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
| \`--color-primary\` | \`bg-primary\` / \`text-primary\` | Base intent color | primary-600 | primary-500 |
| \`--color-primary-hover\` | \`bg-primary-hover\` | Hover state | primary-700 | primary-400 |
| \`--color-primary-active\` | \`bg-primary-active\` | Pressed state | primary-800 | — |
| \`--color-primary-subtle\` | \`bg-primary-subtle\` | Soft background | primary-50 | primary-900 |
| \`--color-primary-emphasis\` | \`bg-primary-emphasis\` | Strong/dark variant | primary-900 | — |

Same pattern applies to: \`success-*\`, \`warning-*\`, \`danger-*\`, \`secondary-*\`, \`neutral-*\`.

\`info-*\` has the identical shape (\`--color-info\`, \`-hover\`, \`-active\`, \`-subtle\`, \`-emphasis\` → \`bg-info\`, \`text-info\`, \`bg-info-subtle\`, …) — the status/feedback blue (hue 220) behind Alert/Toast/Tooltip's info state, \`--color-feedback-info\`, and \`--color-chart-5\`. It is NOT in the global \`ComponentIntent\` union above: the feedback components with a built-in info state (Alert, Toast, Tooltip) do accept \`intent="info"\`, but generic components (Button, Badge, …) take the six-value union, so on those reach for the \`bg-info\`/\`text-info\` utilities rather than \`intent="info"\`.

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
| \`--color-shadow-xs\` | \`shadow-[var(--blocks-shadow-xs)]\` | Minimal shadow |
| \`--color-shadow-sm\` | \`shadow-[var(--blocks-shadow-sm)]\` | Buttons, small elements |
| \`--color-shadow-base\` | \`shadow-[var(--blocks-shadow-base)]\` | Default elevation |
| \`--color-shadow-md\` | \`shadow-[var(--blocks-shadow-md)]\` | Hover states, menus |
| \`--color-shadow-lg\` | \`shadow-[var(--blocks-shadow-lg)]\` | Modals, popovers |

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

## Border Radius Scale

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

Pick an accent hue (0–360) and a chassis hue in the same temperature family (often the accent hue itself, or pulled slightly toward grey). Generate matched OKLCH ramps — the Theme Builder at \`/customization/theme-builder\` does this for you:
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
  /* ...and the same for any neutral-derived surface/text/border tokens you rely on */
}
\`\`\`
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

Tailwind 4 does not scan \`node_modules\` by default, so the responsive utilities (\`lg:hidden\`, \`md:grid-cols-2\`, etc.) used inside Urbicon UI components must be registered as content sources. **The library does this for you:** \`@urbicon-ui/blocks/style/index.css\` ships the \`@source\` directives that point Tailwind at the component classes, and \`@urbicon-ui/table/style/index.css\` does the same for the Table.

So the only requirement is to import \`index.css\` (your app owns the Tailwind import; it comes first):
\`\`\`css
@import 'tailwindcss';
@import '@urbicon-ui/blocks/style/index.css'; /* tokens + @source directives */
@import '@urbicon-ui/table/style/index.css';  /* if using Table */
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
  'theming'
] as const;

export type CssReferenceSection = (typeof CSS_REFERENCE_SECTION_NAMES)[number];

export const CSS_REFERENCE_SECTIONS: Record<CssReferenceSection, string> = {
  surfaces: SURFACES,
  text: TEXT,
  borders: BORDERS,
  intents: INTENTS,
  shadows: SHADOWS,
  theming: THEMING
};

/** Render the reference: a known section's text, or the overview when omitted/unknown. */
export function renderCssReference(section?: string): string {
  if (section && section in CSS_REFERENCE_SECTIONS) {
    return CSS_REFERENCE_SECTIONS[section as CssReferenceSection];
  }
  return CSS_REFERENCE_OVERVIEW;
}
