# @urbicon-ui/blocks

Svelte 5 UI component library with Tailwind CSS 4 — zero runtime dependencies, part of the Urbicon UI monorepo.

## Installation

In a SvelteKit project the [`sv` add-on](https://www.npmjs.com/package/@urbicon-ui/sv) (beta) installs the packages and wires the stylesheet in one step — from an empty directory or inside an existing app:

```bash
bunx sv create my-app --add @urbicon-ui   # new project
bunx sv add @urbicon-ui                   # existing project
```

The components themselves need no SvelteKit — they import neither `$app/*` nor `@sveltejs/kit`, so any Svelte 5 project with Vite and Tailwind 4 works (the add-on is the SvelteKit-only part). By hand it is one install plus two CSS imports. Tailwind must come first — the token sheet depends on it and overrides its defaults:

```bash
bun add @urbicon-ui/blocks
```

```css
/* app.css */
@import 'tailwindcss';
@import '@urbicon-ui/blocks/style/index.css';
```

That one import carries the design tokens **and** the Tailwind `@source` directives that make the components' classes reachable — no consumer-side `@source` needed. Import `style/index.css`, never the `foundation`/`semantic`/`interaction` subfiles: they omit those directives, which is the usual cause of responsive utilities going missing in production.

Peer dependencies: `svelte` (^5), `@urbicon-ui/i18n`. Load the stylesheet wherever your app loads CSS — `+layout.svelte` in SvelteKit, `main.js` in a plain Vite + Svelte app.

Agents get the component grammar, the token rules and an edit-time design gate from `bunx urbicon init --hook` ([`@urbicon-ui/design`](https://ui.urbicon.de/ai)).

## Components

### Primitives (36)

Accordion, Alert, Avatar, Badge, Breadcrumb, Button, ButtonGroup, Card, Checkbox, Collapsible, Combobox, ConfirmDialog, Dialog, Drawer, FormField, Input, JourneyTimeline, Menu, Pagination, Popover, Progress, RadioGroup, SegmentGroup, Select, Separator, Sidebar, Skeleton, Slider, Spinner, Stepper, Tab, Textarea, Toast, Toggle, Toolbar, Tooltip

### Components (19)

AreaChart, BarChart, Calendar, ChartFrame, CommandPalette, CompositionBar, CurrencyInput, DatePicker, DonutChart, EmptyState, FileUpload, Guide, LineChart, LocaleSwitcher, Planner, Sankey, SidebarLayout, Sparkline, ThemeSwitcher

### System

Portal, ClickOutside, ContextIsolation — low-level primitives used by overlay components.

All primitives and components support `unstyled` + `slotClasses` + `preset` for full style control. See the [Component API Conventions](../../docs/COMPONENT-API-CONVENTIONS.md) for `intent`, `variant`, `size`, callbacks, and styling patterns.

## Styling

Components use a **custom `tv()` variant engine** (`src/lib/utils/variants.ts`, ~600 LoC, zero-dependency replacement for `tailwind-variants`). Design tokens live in `src/lib/style/` as a three-layer OKLCH system (foundation → semantic → interaction). See the [Architecture Overview](../../docs/ARCHITECTURE.md) for details.

## Theming

Import a shipped theme after the base styles — `neutral`, `ocean`, `forest`, `rose`, `sunset`:

```css
@import 'tailwindcss';
@import '@urbicon-ui/blocks/style/index.css';
@import '@urbicon-ui/blocks/style/themes/forest.css';
```

Rolling your own: **a brand colour alone is not a theme.** `surface-*`, `text-*` and `border-*` derive from the neutral chassis (`--color-neutral-*`), not from primary — so re-tint the chassis to your accent's temperature too, or the brand button ends up on cool blue-grey cards. Typography themes the same way (`--text-*`, `--font-*`) in the same `@theme` block.

Full walkthrough: [/customization/themes](https://ui.urbicon.de/customization/themes) · canonical reference: `urbicon css-reference theming` (and `typography`).

## Mint System (Micro-Interactions)

Opt-in micro-interactions. Call `registerDefaultMints()` at app startup, then use via prop:

```svelte
<Button mint="scale">Hover me</Button>
<Card mint={['scale', 'ripple']}>Interactive card</Card>
```

Available effects: `scale`, `ripple`, `translate`, `glow`, `bounce`, `pulse`, `shake`, `wiggle`. Respects `prefers-reduced-motion` automatically.

## Presets & Defaults

`BlocksProvider` registers project-wide defaults, named presets, and prop-conditional `overrides`. Override hierarchy (conflict-resolved per Tailwind bucket — a later source wins):

```
tv() defaults → defaults.slotClasses → defaults.overrides → preset.slotClasses → preset.overrides → instance slotClasses → instance class
```

```svelte
<BlocksProvider
  presets={{
    Button: { overlay: { slotClasses: { base: 'bg-black/20 hover:bg-black/30 text-white' } } }
  }}
>
  <Button preset="overlay">Weiter</Button>
</BlocksProvider>
```

Use `overrides` for **prop-conditional** rules an unconditional `slotClasses` cannot express (e.g. only the `outlined` variant). Each entry is a `compoundVariant`-shaped matcher; the tv() conflict resolver strips the library's conflicting class:

```svelte
<BlocksProvider
  defaults={{ Badge: { overrides: [{ variant: 'outlined', class: { base: 'border' } }] } }}
>
  <!-- outlined badges get a 1px border; other variants untouched -->
</BlocksProvider>
```

## Icons

315 hand-rolled SVG icons in `src/lib/icons/`, registered via `IconProvider`. Metadata (`ICON_METADATA`) enables search by name, keyword, or category. Discover them with `urbicon icons <query>`.

## i18n

Re-exports `@urbicon-ui/i18n`. Components with text content (Pagination, Menu, Combobox, Dialog) use internal package-scoped translation keys, resolved against the request-scoped locale from `<I18nProvider>` — or the base locale (`en`) when no provider is mounted. Mount one provider at your app root; switch with `<LocaleSwitcher>` (or `useI18n().setLocale`).

```svelte
<script>
  import { I18nProvider } from '@urbicon-ui/i18n';
  import { LocaleSwitcher } from '@urbicon-ui/blocks';

  let { data, children } = $props();
</script>

<I18nProvider locale={data.locale}>
  <LocaleSwitcher />
  {@render children()}
</I18nProvider>
```

**English is bundled eagerly; German is lazy.** The `de` catalog is a dynamic-import chunk, so an English-only app never bundles it. Before that chunk loads, `de` keys resolve to the English fallback (never the raw key). The provider loads `de` client-side on mount, which means a **server-rendered German app** would paint English first and flip on hydration. Fix it by registering `de` eagerly once at server start:

```ts
// src/hooks.server.ts (evaluated once at server start — SSR-safe, static data)
import { registerBlocksLocale } from '@urbicon-ui/blocks';
import de from '@urbicon-ui/blocks/i18n/de';

registerBlocksLocale('de', de);
```

For the provider/hook API, typed keys, SSR locale resolution, and the code-splitting + eager-register details see the [@urbicon-ui/i18n](../i18n/) package.

## Development

```bash
bun install
bun --filter='@urbicon-ui/blocks' run dev    # Dev mode
bun --filter='@urbicon-ui/blocks' run build  # Build
bun run check                                 # Type check (from root)
bun run test                                  # Run tests (from root)
```

## Related

- [docs/GUIDE.md](./docs/GUIDE.md) — Guide system (help panel, hints, UI↔guide linking, guided tour): architecture + as-built contract. Ships in this package.
- [docs/VARIANT-CONTRACT.md](./docs/VARIANT-CONTRACT.md) — what each `variant` value means: the surface ladder, Card / Alert / Accordion / Table variants, border tokens, and the naming history. Ships in this package.
- [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) — Token system, Mint, Preset-System, i18n (monorepo only)
- [docs/COMPONENT-API-CONVENTIONS.md](../../docs/COMPONENT-API-CONVENTIONS.md) — Props, callbacks, styling patterns (monorepo only)
- [docs/ComponentStructureStandard.md](../../docs/ComponentStructureStandard.md) — File structure, index.ts, variants.ts (monorepo only)
