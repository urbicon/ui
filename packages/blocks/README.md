# @urbicon-ui/blocks

Svelte 5 UI component library with Tailwind CSS 4 — zero runtime dependencies, part of the Urbicon UI monorepo.

## Installation

This package ships inside the Urbicon UI monorepo. Install from the repo root:

```bash
bun install
```

Peer dependencies: `svelte` (^5), `@sveltejs/kit`, `@urbicon-ui/i18n`.

## Components

### Primitives (35)

Accordion, Alert, Avatar, Badge, Breadcrumb, Button, ButtonGroup, Card, Checkbox, Collapsible, Combobox, ConfirmDialog, Dialog, Drawer, FormField, Input, Menu, Pagination, Popover, Progress, RadioGroup, SegmentGroup, Select, Separator, Sidebar, Skeleton, Slider, Spinner, Stepper, Tab, Textarea, Toast, Toggle, Toolbar, Tooltip

### Components (10)

Calendar, CommandPalette, CompositionBar, CurrencyInput, DatePicker, EmptyState, FileUpload, LocaleSwitcher, Sankey, ThemeSwitcher

### System

Portal, ClickOutside, ContextIsolation — low-level primitives used by overlay components.

All primitives and components support `unstyled` + `slotClasses` + `preset` for full style control. See the [Component API Conventions](../../docs/COMPONENT-API-CONVENTIONS.md) for `intent`, `variant`, `size`, callbacks, and styling patterns.

## Styling

Components use a **custom `tv()` variant engine** (`src/lib/utils/variants.ts`, ~600 LoC, zero-dependency replacement for `tailwind-variants`). Design tokens live in `src/lib/style/` as a three-layer OKLCH system (foundation → semantic → interaction). See the [Architecture Overview](../../docs/ARCHITECTURE.md) for details.

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

156 hand-rolled SVG icons in `src/lib/icons/`, registered via `IconProvider`. Metadata (`ICON_METADATA`) enables search by name, keyword, or category. See the icon-design rules in [AGENTS.md → Icon Design Rules](../../AGENTS.md#icon-design-rules).

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

For the provider/hook API, typed keys, SSR locale resolution, and opt-in lazy loading see the [@urbicon-ui/i18n](../i18n/) package.

## Development

```bash
bun install
bun --filter='@urbicon-ui/blocks' run dev    # Dev mode
bun --filter='@urbicon-ui/blocks' run build  # Build
bun run check                                 # Type check (from root)
bun run test                                  # Run tests (from root)
```

## Related

- [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) — Token system, Mint, Preset-System, i18n
- [docs/COMPONENT-API-CONVENTIONS.md](../../docs/COMPONENT-API-CONVENTIONS.md) — Props, callbacks, styling patterns
- [docs/ComponentStructureStandard.md](../../docs/ComponentStructureStandard.md) — File structure, index.ts, variants.ts
