# Urbicon UI – Full API Reference for LLMs

> This file is optimized for LLM consumption. It contains everything needed to correctly generate code using Urbicon UI.

## Installation

Urbicon UI packages are published to a private registry. Create a `bunfig.toml` in your project root:

```toml
# bunfig.toml
[install.scopes]
"@urbicon-ui" = { url = "https://npm.urbicon.de/" }
```

Then install the packages:

```bash
bun add @urbicon-ui/blocks @urbicon-ui/i18n
```

CSS setup (in your app's root layout or entry CSS). Your app owns the Tailwind
import and it MUST come first; the Urbicon UI CSS that follows depends on it and
overrides its defaults:
```css
@import 'tailwindcss';
@import '@urbicon-ui/blocks/style/index.css'; /* tokens + @source directives */
@import '@urbicon-ui/table/style/index.css';  /* only if you use @urbicon-ui/table */
```

Import the single `style/index.css` — **not** the `foundation`/`semantic`/`interaction`
subfiles. `index.css` ships the design tokens, global classes (`.sr-only`, mint styles),
and the Tailwind `@source` directives that make Tailwind scan the component classes inside
`node_modules`. You do **not** need to add any manual `@source` directives; importing the
subfiles (which omit those directives) is the usual cause of responsive utilities like
`lg:hidden` going missing in production.

## Import Pattern

ALWAYS import from the package root:
```svelte
<script>
  import { Button, Input, Card, Dialog, Badge } from '@urbicon-ui/blocks';
</script>
```

NEVER import from internal paths like `@urbicon-ui/blocks/primitives/Button`.

---

## Shared API Grammar

Every component follows a predictable API. Learn once, apply everywhere.

### `intent` – Semantic Color

Values: `primary` | `secondary` | `success` | `warning` | `danger` | `neutral`
Default: `neutral` (action elements), `primary` (form/decorative elements)

### `variant` – Visual Weight

Values: `filled` | `outlined` | `ghost` | `text` (component-dependent)
- `filled`: Solid background, highest emphasis
- `outlined`: Border only, transparent background
- `ghost`: No border, no background
- `text`: Minimal, text-only (Button only)

### `size` – Dimensions

Standard scale: `xs` | `sm` | `md` | `lg` | `xl`
Default: `md` for all components.

| Size | Height | Font     |
|------|--------|----------|
| xs   | h-6    | text-xs  |
| sm   | h-8    | text-sm  |
| md   | h-10   | text-base|
| lg   | h-12   | text-lg  |
| xl   | h-14   | text-xl  |

### `unstyled` – Strip All Default Styles

```svelte
<Button unstyled class="my-custom-classes">Custom</Button>
```

### `slotClasses` – Override Specific Slots

Each component documents its slots. Override without losing other styles:
```svelte
<Card slotClasses={{ header: 'bg-primary-subtle', footer: 'border-t-2' }}>
  ...
</Card>
```

### `mint` – Micro-Interactions (opt-in)

Requires `registerDefaultMints()` call at app startup.
Values: `'scale'` | `'ripple'` | `'translate'` | `'glow'` | `'none'` | array

```svelte
<Button mint="scale">Hover me</Button>
<Card mint={['scale', 'glow']}>Interactive</Card>
```

### `preset` – Apply a Named Project Style

Values: any preset name registered via `<BlocksProvider presets={{...}}>` (project-specific).

Presets are the correct escape hatch when you need a look **outside the semantic intent palette**
(`primary | secondary | success | warning | danger | neutral`) — e.g. a dark translucent overlay
button on top of an image, a brand-colored button, or a "glass" surface. They keep hover/active/
dark-mode logic coherent AND make the custom look reusable across the project.

```svelte
<Button preset="overlay">Reinholen</Button>
<Card preset="glass">...</Card>
```

Registration happens once at the app root — see `Customization` → `Level 2: Presets` below.

**DO NOT** reach for `class="bg-…! hover:bg-…! active:bg-…!"` when the intent palette doesn't fit.
That pattern defeats the component's hover/active/dark-mode cascade and leaks visual decisions
into every call site. Register a preset instead.

### `class` – Additional CSS Classes

Merged with variant classes. Always available on every component.

---

## Component Families

Every primitive belongs to exactly one of six families. The family decides ARIA role, tier-system membership, and border-token source. Pick the right family up-front to avoid categorical bugs (button that looks like an input, menu that doubles as a listbox, avatar that mutates when commit-radii flatten).

### Family table

| Family | Members | ARIA role | Tier default | Border source |
|---|---|---|---|---|
| Action | Button, ButtonGroup, Menu, Toolbar, Toggle | `button`, `menu`, `menuitem`, `toolbar`, `switch` | `commit` (tier-aware) | Intent (`border-neutral` etc.) |
| Form | Input, Select, Combobox, Textarea, Checkbox, RadioGroup, Slider, FormField | `textbox`, `listbox`, `combobox`, `checkbox`, `radio`, `slider` | `modify` (tier-aware) | Surface (`border-border-subtle`) |
| Navigation | Breadcrumb, Pagination, SegmentGroup, Stepper, Tab | `navigation`, `tablist`, `tab` | per-component (tier-aware) | mixed |
| Container | Card, Alert, Accordion, Collapsible, Dialog, Drawer, Popover, Tooltip, Sidebar, Separator, ConfirmDialog | `dialog`, `tooltip`, `region`, `aside` | `contain` (tier-aware) | Surface or Hairline |
| Feedback / Ambient | Toast, Spinner, Progress, Skeleton, Badge | `status`, `alert`, `progressbar` | **not tier-aware** (Badge is the documented edge case) | Intent (status-tinted) or none |
| Identity | Avatar | `img` or `button` | **not tier-aware** — own shape axis (`circle` / `rounded` / `square`) | none |

### Action — interactive triggers

- ARIA: items dispatch `onSelect` / `onclick`; never hold a value.
- Border: must read as interactive even in `intent="neutral"` — uses Intent tokens (~neutral-500 in light).
- Industry analogue: Radix DropdownMenu, Headless UI Menu.
- Pick `Menu` for one-off action lists; `Button` for single triggers; `ButtonGroup` for grouped triggers; `Toolbar` for free-form bars; `Toggle` for bistable switches.

### Form — value holders

- ARIA: control owns a value, emits `onValueChange` / `bind:value`.
- Border: must read as a container, not a button — uses Surface tokens (~neutral-200 in light).
- Industry analogue: Radix Select / Combobox, Headless UI Listbox / Combobox.
- Pick `Select` for value pickers; `Combobox` for searchable Select; `Select multiple` for multi-select (NOT `Menu multiple`); `Menu` (Action family) for one-off action lists.

### Navigation — section / route selection

- ARIA: `<nav aria-label>`, `role="tablist"` + `role="tab"`, `aria-current` for breadcrumbs / pagination.
- Border: per-component; SegmentGroup indicator uses Intent (active item reads as action-like).
- Pick `Tab` for sectioned content; `SegmentGroup` for inline pickers (holds value, unlike ButtonGroup); `Stepper` for linear progress; `Breadcrumb` for route context; `Pagination` for list paging.

### Container — content surfaces

- ARIA: `<dialog>`, `role="tooltip"`, `<aside>`, `<details>` / `aria-expanded`.
- Border: never Intent in default state — Surface or Hairline. If a container border reads as a button, family mismatch.
- Pick `Card` / `Alert` for in-page surfaces; `Dialog` / `Drawer` / `ConfirmDialog` for modal overlays; `Popover` for anchored floating; `Tooltip` for hover-described inline targets; `Sidebar` for persistent app-shell; `Accordion` / `Collapsible` for disclosure.

### Feedback / Ambient — status communication

- ARIA: `role="alert"`, `role="status"`, `role="progressbar"`. Spinner inherits `aria-busy` from host.
- Tier: NOT tier-aware. Geometry is per-component (e.g. Spinner is always `rounded-full`, Toast is always `rounded-contain`). A wrapping `<Toolbar tier="modify">` does NOT flatten a Toast.
- Badge exception: Badge DOES expose a `tier` prop (`commit` default, `modify` opt-in for inline Toolbar strips) — but the family rule remains: Feedback geometry is per-component, not per-context.
- Pick `Toast` for system notifications; `Alert` for in-page banners; `Spinner` / `Progress` / `Skeleton` for loading states; `Badge` for status tags / counters (see Badge Patterns section for the 5 use cases).

### Identity — Avatar only

- Avatar lives outside the tier system. Its `variant` axis (`circle` / `rounded` / `square`) is identity-shape, not layout-tier. A brand that flattens `--radius-commit` (squared pill buttons) keeps circular avatars.
- Avatar uses no border in its default render; `ring` is the only border-adjacent affordance.

### Cross-family disambiguation

- `Menu` vs `Select` — Menu for one-off actions (Action), Select for value pickers (Form). Different ARIA, different border family.
- `ButtonGroup` vs `SegmentGroup` — ButtonGroup dispatches actions, SegmentGroup holds a value. If you `bind:value` on a ButtonGroup, switch to SegmentGroup.
- `Sidebar` vs `Drawer` — Sidebar for persistent layout (`<aside>`, no backdrop by default), Drawer for transient modal (`<dialog>`, always backdrop + focus-trap).
- `Popover` vs `Tooltip` — Popover hosts a focus-trapped panel for click-interactions, Tooltip is non-focusable for hover-descriptions.
- `Alert` vs `Toast` — Alert is in-page (`role="alert"`), Toast is system-level + stacking.

### Tier-aware components (read context from `<TierContext>`)

Seven primitives expose a `tier` prop AND inherit from a wrapping context when unset:

| Component | Default tier | Family |
|---|---|---|
| Button | `commit` | Action |
| Toggle | `commit` | Action |
| SegmentGroup | `commit` | Navigation |
| Stepper | `commit` | Navigation |
| RadioGroup | `commit` | Form |
| Checkbox | `modify` | Form |
| Tab | `modify` | Navigation |

All other primitives use a fixed tier per family (see family table above) — Container components are `contain`, Form components are `modify`, Action components are `commit`, Feedback / Identity components are not tier-aware at all.

---

## Components

{{COMPONENTS}}

---

## Design Token System

This is the COMPLETE list of available semantic tokens. Use ONLY these — do not invent token names.

### Surface Tokens (backgrounds)

```
bg-surface-base          /* page background */
bg-surface-quiet         /* softly tinted in-page zone */
bg-surface-subtle        /* resting tint ONLY — equals surface-elevated, so never `hover:bg-surface-subtle` */
bg-surface-elevated      /* floating surfaces (paired with shadow) */
bg-surface-overlay       /* modals, popovers */
bg-surface-interactive   /* interactive backgrounds */
bg-surface-interactive-hover /* hover step for something resting on surface-interactive */
bg-surface-hover         /* hover state (for elements on a reading surface) */
bg-surface-active        /* active/pressed state */
bg-surface-disabled      /* disabled elements */
bg-surface-selected      /* selected items (uses primary-50) */
bg-surface-inverted      /* inverted surfaces (tooltips) */
```

### Text Tokens

```
text-text-primary        /* main text */
text-text-secondary      /* supporting text */
text-text-tertiary       /* muted text, metadata */
text-text-quaternary     /* most subtle text */
text-text-disabled       /* disabled text */
text-text-inverted       /* text on inverted surfaces */
text-text-on-primary     /* text on intent-colored fills (all intents except warning) */
text-text-on-warning     /* text on the warning fill — warm dark in both modes */
text-text-on-dark        /* text on dark surfaces */
text-text-on-surface     /* text on any surface (auto-contrast) — never on intent fills */
```

### Border Tokens

```
border-border-subtle     /* gentle grouping */
border-border-default    /* standard borders */
border-border-emphasis   /* emphasized borders */
border-border-strong     /* high-contrast borders */
```

### Intent Tokens (available for ALL intents: primary, secondary, neutral, success, warning, danger)

Each intent has 5 variants. Example with `success`:
```
bg-success               /* base intent color */
bg-success-hover         /* hover state */
bg-success-active        /* pressed state */
bg-success-subtle        /* soft background (e.g. success-50) */
bg-success-emphasis      /* strong/dark variant */
text-success             /* intent-colored text */
text-success-hover       /* hover text */
text-success-subtle      /* subtle intent text */
border-success           /* intent-colored border */
```

Same pattern for: `primary-*`, `secondary-*`, `neutral-*`, `warning-*`, `danger-*`

### Feedback Tokens (status messages)

```
bg-feedback-info            text-feedback-info            /* maps to primary */
bg-feedback-info-subtle                                   /* soft info background */
bg-feedback-success         text-feedback-success         /* maps to success */
bg-feedback-success-subtle                                /* soft success background */
bg-feedback-warning         text-feedback-warning         /* maps to warning */
bg-feedback-warning-subtle                                /* soft warning background */
bg-feedback-error           text-feedback-error           /* maps to danger */
bg-feedback-error-subtle                                  /* soft error background */
```

### DON'T invent token names — common mistakes:

```
/* WRONG — these don't exist */
text-status-danger       bg-status-warning       border-l-status-*
text-feedback-success-fg text-feedback-danger-fg

/* CORRECT equivalents */
text-danger              bg-warning              border-l-danger
text-feedback-success    text-feedback-error
```

### DON'T use primitive colors with dark: overrides:

```
/* WRONG */
bg-white dark:bg-neutral-900

/* CORRECT */
bg-surface-base
```

### Shadow Tokens

```
shadow-[var(--blocks-shadow-xs)]   /* minimal */
shadow-[var(--blocks-shadow-sm)]   /* buttons */
shadow-[var(--blocks-shadow-md)]   /* hover states */
shadow-[var(--blocks-shadow-lg)]   /* menus, popovers */
```

### Z-Index Tokens

```
z-[var(--z-dropdown)]  /* 1150 */
z-[var(--z-overlay)]   /* 1300 */
z-[var(--z-modal)]     /* 1400 */
z-[var(--z-popover)]   /* 1500 */
z-[var(--z-tooltip)]   /* 1800 */
```

### Duration Tokens

```
duration-[var(--blocks-duration-instant)]  /* 75ms */
duration-[var(--blocks-duration-fast)]     /* 150ms */
duration-[var(--blocks-duration-normal)]   /* 250ms */
duration-[var(--blocks-duration-slow)]     /* 350ms */
```

### Easing Tokens

```
var(--blocks-ease-confident)  /* standard transitions */
var(--blocks-ease-springy)    /* bouncy animations */
var(--blocks-ease-smooth)     /* gentle animations */
var(--blocks-ease-snappy)     /* quick, decisive */
```

### Border Radius Scale

```
rounded-xs    /* 0.125rem */    rounded-sm    /* 0.25rem */
rounded-md    /* 0.375rem */    rounded-lg    /* 0.5rem */
rounded-xl    /* 0.75rem */     rounded-2xl   /* 1rem */
rounded-3xl   /* 1.5rem */      rounded-4xl   /* 2rem */
```

---

## Design Quality

These guidelines help you create interfaces with genuine visual identity. They are framed as
"AVOID → INSTEAD" patterns because knowing what NOT to do is more effective than abstract principles.

### Vary Visual Weight

Don't give every element the same visual importance. Vary `variant`, `padding`, and grid span to reflect content hierarchy.

```
/* AVOID — uniform grid, all cards identical */
<div class="grid grid-cols-4 gap-4">
  <Card variant="elevated" padding="md">Metric A</Card>
  <Card variant="elevated" padding="md">Metric B</Card>
  <Card variant="elevated" padding="md">Metric C</Card>
  <Card variant="elevated" padding="md">Metric D</Card>
</div>

/* INSTEAD — weight reflects importance */
<div class="grid grid-cols-4 gap-4">
  <Card variant="elevated" padding="lg" class="col-span-2">Hero metric</Card>
  <Card variant="outlined" padding="md">Secondary</Card>
  <Card variant="outlined" padding="md">Secondary</Card>
</div>
```

### Color = Meaning, Not Decoration

Neutral surfaces should dominate (80–90%). Use `intent` and semantic color tokens ONLY for
their semantic meaning — status, severity, actions — never as visual flair.

```
/* AVOID — color without purpose */
<Card class="bg-primary-subtle">             <!-- why primary? -->
<Badge intent="primary">Active</Badge>       <!-- "Active" isn't a primary action -->

/* INSTEAD — color communicates state */
<Card variant="elevated">                    <!-- neutral default -->
<Badge intent="success" variant="soft">Healthy</Badge>   <!-- green = healthy -->
<Badge intent="danger" variant="filled">Critical</Badge>  <!-- red = critical -->
```

### Spacing Signals Relationships

Don't use the same gap everywhere. Tight spacing groups related items; generous spacing
separates distinct sections.

```
/* AVOID — uniform spacing */
<div class="space-y-4">
  <section>...</section>    <!-- same gap between sections -->
  <section>...</section>
</div>

/* INSTEAD — spacing hierarchy */
<div class="space-y-10">                      <!-- generous between sections -->
  <section class="space-y-3">...</section>    <!-- tight within sections -->
  <section class="space-y-3">...</section>
</div>
```

### Commit to a Shape Language

Choose a border-radius philosophy and apply it consistently. Override component defaults
with `class` or `slotClasses` when your design requires it.

| Strategy | Radius | Personality |
|----------|--------|-------------|
| Sharp | `rounded-sm` / `rounded` | Technical precision, data-dense |
| Soft | `rounded-lg` / `rounded-xl` | Professional, approachable |
| Round | `rounded-2xl` / `rounded-3xl` | Friendly, modern |

Use larger radii for hero/prominent elements, smaller radii for compact/data-dense elements.
Don't rely on component defaults alone — make a deliberate choice:

```svelte
<!-- Override Card radius for a softer design -->
<Card class="rounded-2xl" padding="lg">...</Card>

<!-- Or set globally via BlocksProvider -->
<BlocksProvider defaults={{
  Card: { slotClasses: { base: 'rounded-2xl' } }
}}>
```

### Data-Driven Styling

Let the data shape the presentation. Different states, severities, or categories should look
visually distinct — not just carry a different label.

```
/* AVOID — identical rows regardless of content */
{#each alerts as alert}
  <div class="py-3 border-b border-border-subtle">
    <Badge>{alert.severity}</Badge> {alert.message}
  </div>
{/each}

/* INSTEAD — severity drives visual weight */
{#each alerts as alert}
  {@const critical = alert.severity === 'critical'}
  <div class="border-b border-border-subtle {critical ? 'py-4 font-medium' : 'py-2.5'}">
    <Badge intent={severityIntent(alert.severity)}
           variant={critical ? 'filled' : 'soft'}>
      {alert.severity}
    </Badge>
    <span class={critical ? 'text-text-primary' : 'text-text-secondary'}>
      {alert.message}
    </span>
  </div>
{/each}
```

### Don't Copy, Compose

Recipes and examples show ONE possible interpretation. Use them for API understanding,
not as visual templates. Your implementation should:

- Vary Card `variant` across the page based on content importance (not all `elevated`)
- Use different density (padding, gap, text size) for different page sections
- Make one element per section clearly dominant — if everything is emphasized, nothing is
- Use `text-text-secondary` and `text-text-tertiary` generously to push supporting content back
- Choose your OWN spacing rhythm, radius strategy, and color distribution

---

## Customization

Four levels of customization, from simple color swaps to fully custom designs.
**Pick the lowest level that solves your problem** — lower levels preserve more of the
design system's behavior (dark mode, hover/active cascade, focus rings).

### Level 1: CSS Token Themes

Import a theme CSS file after base styles to override the color palette:
```css
@import '@urbicon-ui/blocks/style/index.css';
@import '@urbicon-ui/blocks/style/themes/ocean.css';
```

Built-in themes: `ocean.css`, `forest.css`, `sunset.css`, `rose.css`, `neutral.css`.

Create custom themes with a `@theme` block:
```css
@theme {
  --color-primary-50: oklch(0.95 0.03 YOUR_HUE);
  --color-primary-500: oklch(0.58 0.13 YOUR_HUE);
  --color-primary-900: oklch(0.26 0.06 YOUR_HUE);
  /* ... full 50–950 scale */
}
```

### Level 2: Presets – Named Project-Defined Styles

**Use this when the built-in `intent` palette doesn't fit.** Presets are named, reusable
`slotClasses` bundles you register once at the app root, then apply per component via
a `preset="…"` prop. They are the **preferred alternative** to ad-hoc `class="bg-…!"`
overrides at call sites.

Register once at the app root:
```svelte
<script>
  import { BlocksProvider } from '@urbicon-ui/blocks';
</script>

<BlocksProvider
  presets={{
    Button: {
      overlay: {
        slotClasses: {
          base: 'bg-black/20 hover:bg-black/30 active:bg-black/40 text-white border-transparent'
        }
      },
      brand: {
        slotClasses: {
          base: 'bg-[#FF5A1F] hover:bg-[#E04C15] active:bg-[#C53F0D] text-white border-transparent'
        }
      }
    },
    Card: {
      glass: {
        slotClasses: {
          base: 'bg-white/10 backdrop-blur-xl border-white/20'
        }
      }
    }
  }}
>
  <slot />
</BlocksProvider>
```

Then use across the project:
```svelte
<Button preset="overlay">Reinholen</Button>
<Button preset="brand">Jetzt kaufen</Button>
<Card preset="glass">Heads-up display</Card>
```

**Why presets over inline `class` overrides?**

```svelte
<!-- ❌ AVOID: Defeats hover/active cascade, leaks decisions into every call site,
     requires `!` to out-specify tv() defaults, inconsistent across the project. -->
<Button intent="primary" class="bg-black/20! hover:bg-black/30! active:bg-black/40!">
  Reinholen
</Button>

<!-- ✅ PREFER: Intent-less, cohesive cascade, reusable across the codebase. -->
<Button preset="overlay">Reinholen</Button>
```

When defining a preset, specify **all interactive states explicitly** (`hover:`, `active:`,
and `focus-visible:` where applicable). The preset's `slotClasses.base` is merged *after*
the `tv()` defaults, so conflicting Tailwind utilities are resolved by the built-in bucket
conflict resolver (last source wins) — no `!` needed.

An unknown preset name emits a dev-only console warning, so typos are discoverable.

### Level 3: BlocksProvider – Global Component Defaults

Use `defaults` (distinct from `presets`) to set **project-wide baseline styles** that
apply to *every* instance of a component — e.g. "all Buttons should be rounded-full in this app":

```svelte
<BlocksProvider
  defaults={{
    Button: { slotClasses: { base: 'rounded-full font-bold uppercase' } },
    Card: { slotClasses: { base: 'rounded-3xl shadow-2xl' } },
    Input: { slotClasses: { base: 'rounded-full' } }
  }}
>
  <slot />
</BlocksProvider>
```

`defaults` vs. `presets` vs. `overrides` — when to use which:
- **`defaults.slotClasses`**: blanket project style applied to every instance (no opt-in required)
- **`presets`**: named alternative look, opt-in via `preset="…"` prop at the call site
- **`defaults.overrides` / `presets[…].overrides`**: prop-conditional rules targeting only a specific
  variant/intent/state (e.g. only `variant="outlined"`) — what unconditional `slotClasses` cannot express

```svelte
<!-- Only outlined badges get a 1px border; the conflict resolver strips the variant's border-2. -->
<BlocksProvider defaults={{ Badge: { overrides: [{ variant: 'outlined', class: { base: 'border' } }] } }}>
  <slot />
</BlocksProvider>
```

Each `overrides` entry is a `compoundVariant`-shaped matcher (`string` = equals, `string[]` = one-of →
per-slot `class`); it matches active prop *values*, so it works regardless of whether the library
defines the conflicting class in a `variant` or a `compoundVariant`.

Merge priority (lowest → highest), conflict-resolved per Tailwind bucket (a later source wins):
1. `tv()` variant styles (library default)
2. `defaults.slotClasses` (global baseline)
3. `defaults.overrides[match]` (prop-conditional)
4. `presets[Component][name].slotClasses` (when `preset` prop is set)
5. `presets[Component][name].overrides[match]`
6. Instance `slotClasses` prop
7. Instance `class` prop

### Level 4: Global Unstyled Mode

Strip all default styles from every component, then apply your own:
```svelte
<BlocksProvider unstyled defaults={{
  Button: { slotClasses: { base: 'inline-flex items-center border-2 px-6 py-3 font-mono' } }
}}>
  <slot />
</BlocksProvider>
```

---

## Style Patterns

Urbicon UI components are designed to be radically reskinned. Do NOT default to the standard
look from examples — choose a visual style that fits the project's identity. Every component
supports `unstyled` (strips all defaults) and `slotClasses` (targeted sub-element overrides).

### Slot Reference

| Component | Slots |
|-----------|-------|
| Button | `base`, `content`, `spinner` |
| Card | `base`, `header`, `content`, `footer` |
| Input | `wrapper`, `container`, `base`, `label`, `message`, `iconContainer` |
| Badge | `base`, `content`, `removeButton`, `removeIcon` |
| Dialog | `base`, `overlay`, `header`, `body`, `footer` |
| Alert | `base`, `icon`, `content`, `title`, `description`, `actions` |
| Tooltip | `base`, `arrow` |

### Pattern: Glassmorphism

```svelte
<BlocksProvider defaults={{
  Card: {
    slotClasses: {
      base: 'bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl'
    }
  },
  Button: {
    slotClasses: {
      base: 'bg-white/15 backdrop-blur-md border border-white/25 hover:bg-white/25 rounded-xl text-white shadow-lg'
    }
  },
  Input: {
    slotClasses: {
      base: 'bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 rounded-xl',
      label: 'text-white/80'
    }
  }
}}>
```

Combine with a gradient or image background on the page container.

### Pattern: Brutalist / Raw

```svelte
<BlocksProvider unstyled defaults={{
  Card: {
    slotClasses: {
      base: 'border-4 border-black bg-white p-0 shadow-[8px_8px_0_black]'
    }
  },
  Button: {
    slotClasses: {
      base: 'border-3 border-black bg-yellow-300 px-6 py-3 font-black uppercase tracking-widest hover:bg-black hover:text-yellow-300 active:translate-x-1 active:translate-y-1 active:shadow-none shadow-[4px_4px_0_black]'
    }
  },
  Input: {
    slotClasses: {
      base: 'border-3 border-black bg-white font-mono text-lg',
      label: 'font-black uppercase tracking-widest text-xs'
    }
  },
  Badge: {
    slotClasses: {
      base: 'border-2 border-black bg-lime-400 font-black uppercase text-black rotate-[-2deg]'
    }
  }
}}>
```

### Pattern: Terminal / Hacker

```svelte
<BlocksProvider unstyled defaults={{
  Card: {
    slotClasses: {
      base: 'border border-green-500/30 bg-black/90 font-mono text-green-400 rounded-none'
    }
  },
  Button: {
    slotClasses: {
      base: 'border border-green-500/50 bg-green-500/10 font-mono text-green-400 rounded-none hover:bg-green-500/20 hover:text-green-300 px-4 py-2 uppercase tracking-wider text-xs'
    }
  },
  Input: {
    slotClasses: {
      base: 'border border-green-500/30 bg-black font-mono text-green-400 rounded-none caret-green-400 placeholder:text-green-800',
      label: 'font-mono text-green-600 uppercase text-[10px] tracking-[0.2em]'
    }
  },
  Badge: {
    slotClasses: {
      base: 'border border-green-500/40 bg-green-500/10 font-mono text-green-400 text-[10px] uppercase rounded-none'
    }
  }
}}>
```

### Pattern: Soft / Organic

```svelte
<BlocksProvider defaults={{
  Card: {
    slotClasses: {
      base: 'rounded-[2rem] bg-amber-50 border-0 shadow-sm'
    }
  },
  Button: {
    slotClasses: {
      base: 'rounded-full bg-stone-800 text-amber-50 hover:bg-stone-700 px-8 font-light tracking-wide border-0 shadow-none'
    }
  },
  Input: {
    slotClasses: {
      base: 'rounded-2xl border-stone-200 bg-stone-50 font-light',
      label: 'font-light text-stone-500'
    }
  }
}}>
```

### Override Interaction Tokens

Change the feel of all components at once:
```css
:root {
  --blocks-ease-confident: cubic-bezier(0.22, 1, 0.36, 1);
  --blocks-duration-normal: 300ms;
  --blocks-scale-hover: 1.00;    /* disable scale on hover */
  --blocks-scale-press: 0.98;
  --blocks-focus-ring-width: 3px;
  --blocks-focus-ring-color: oklch(0.7 0.15 var(--primary-hue, 240));
}
```

### Per-Instance Override

For one-off customizations without changing the global style:
```svelte
<Card unstyled slotClasses={{ base: 'my-custom-card-class', header: 'my-header' }}>
  ...
</Card>

<Button class="rounded-full px-12 tracking-widest uppercase">
  Custom Button
</Button>
```

`class` merges with defaults; `unstyled` + `slotClasses` replaces them entirely.

---

## Callback Naming Convention

Native DOM events: lowercase (`onclick`, `onfocus`)
Custom state callbacks: `on` + PascalCase (`onCheckedChange`, `onValueChange`, `onPageChange`)

Always pass the NEW STATE VALUE, not the raw event:
```svelte
<Checkbox onCheckedChange={(checked) => ...} />
<Menu onValueChange={(value) => ...} />
<Pagination onPageChange={(page) => ...} />
```

---

## i18n Integration

```svelte
<script>
  import { T, LocaleSwitcher } from '@urbicon-ui/blocks';
</script>

<T key="blocks.button.loading" />
<LocaleSwitcher />
```

Supported locales: `en`, `de`. Components auto-translate their internal text.

---

## Common Patterns

### Form with validation
```svelte
<form onsubmit={handleSubmit}>
  <Input label="Email" type="email" bind:value={email} error={errors.email} required />
  <Input label="Password" type="password" bind:value={password} error={errors.password} required />
  <Checkbox label="Remember me" bind:checked={remember} />
  <Button intent="primary" type="submit" loading={submitting}>Sign In</Button>
</form>
```

### Confirmation dialog
```svelte
<Dialog bind:open={showConfirm} title="Delete Item?" intent="danger" size="sm">
  <p>This action cannot be undone.</p>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => showConfirm = false}>Cancel</Button>
    <Button intent="danger" onclick={handleDelete} loading={deleting}>Delete</Button>
  {/snippet}
</Dialog>
```

### Data display card
```svelte
<Card variant="outlined" padding="lg">
  {#snippet header()}
    <div class="flex items-center justify-between">
      <h3 class="text-text-primary font-semibold">Revenue</h3>
      <Badge intent="success" variant="soft">+12%</Badge>
    </div>
  {/snippet}
  <p class="text-3xl font-bold text-text-primary">$48,200</p>
  <p class="text-text-tertiary text-sm">vs. $43,000 last month</p>
</Card>
```

### Navigation tabs
```svelte
<Tab
  tabs={[
    { label: 'Overview', value: 'overview' },
    { label: 'Analytics', value: 'analytics' },
    { label: 'Settings', value: 'settings', disabled: true }
  ]}
  bind:value={activeTab}
  variant="pills"
/>

{#if activeTab === 'overview'}
  <OverviewPanel />
{:else if activeTab === 'analytics'}
  <AnalyticsPanel />
{/if}
```

### Menu with custom items
```svelte
<Menu
  items={users}
  getItemLabel={(u) => u.name}
  getItemValue={(u) => u.id}
  placeholder="Assign to..."
  bind:value={assignee}
>
  {#snippet customItem(user, isSelected, toggle)}
    <div class="flex items-center gap-2 p-2" onclick={toggle}>
      <Avatar name={user.name} size="xs" />
      <span>{user.name}</span>
    </div>
  {/snippet}
</Menu>
```

### Loading skeleton
```svelte
{#if loading}
  <div class="flex items-center gap-3">
    <Skeleton variant="circular" size="md" />
    <div class="flex-1 flex flex-col gap-2">
      <Skeleton variant="text" size="sm" />
      <Skeleton variant="text" size="xs" class="w-2/3" />
    </div>
  </div>
{:else}
  <UserCard {user} />
{/if}
```

### Breadcrumb navigation
```svelte
<Breadcrumb items={[
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Settings', href: '/dashboard/settings' },
  { label: 'Profile' }
]} size="sm" />
```

---

## Auth Reference

The complete `@urbicon-ui/auth` reference — architecture, staged consumer setup,
federation (SSO), the adapter contract, the error contract, and the known
limitations & production-readiness checklist. Extracted at build time from the
package's canonical, tarball-shipped `docs/AUTH.md` (one source, all channels —
see docs/DOCS-SURFACES.md); the same document renders at
https://ui.urbicon.de/auth/guide.

{{GUIDE:auth}}
