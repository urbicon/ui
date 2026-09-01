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

The live index with a playground per entry is [ui.urbicon.de/blocks](https://ui.urbicon.de/blocks); the names below are the top-level exports, without the compound children (`TabItem`, `MenuItem`, `ChatMessage`, …).

### Primitives (39)

Accordion, Alert, Avatar, Badge, Breadcrumb, Button, ButtonGroup, Card, Checkbox, Collapsible, Combobox, ConfirmDialog, Dialog, Drawer, FormField, Input, JourneyTimeline, Kbd, Menu, Pagination, Popover, Progress, RadioGroup, Scroller, SegmentGroup, Select, Separator, Sidebar, Skeleton, Slider, Spinner, SplitPane, Stepper, Tab, Textarea, Toast, Toggle, Toolbar, Tooltip

### Components (27)

AreaChart, AvatarGroup, BarChart, Calendar, ChartFrame, Chat, CommandPalette, CompositionBar, CopyButton, CurrencyInput, DatePicker, DonutChart, EmptyState, FileUpload, Guide, LineChart, LocaleSwitcher, NumberInput, PinInput, Planner, QRCode, ResourceTimeline, Sankey, SidebarLayout, Sparkline, ThemeSwitcher, TimeInput

### System

Portal, ClickOutside, ContextIsolation — low-level primitives used by overlay components.

All primitives and components support `unstyled` + `slotClasses` + `preset` for full style control. `unstyled` on a composing component (`DatePicker`, `ChatMessage`, `CommandPalette`, …) also strips the blocks components it renders itself; components you hand in as `children` keep their look — `<BlocksProvider unstyled>` covers a whole subtree. See the [Component API Conventions](../../docs/COMPONENT-API-CONVENTIONS.md) for `intent`, `variant`, `size`, callbacks, and styling patterns.

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

Opt-in micro-interactions, used via prop — no setup required (unknown names demand-load the built-in set on first use):

```svelte
<Button mint="scale">Hover me</Button>
<Card mint={['scale', 'ripple']}>Interactive card</Card>
```

Built-in effects: `scale`, `translate`, `rotate`, `glow`, `pulse`, `wiggle` (hover — held while the pointer stays), `bounce`, `shake`, `ripple` (click — one-shot). Configurable per entry (`duration`, `easing`, `intensity` for scale); respects `prefers-reduced-motion` and applies hover effects only on hover-capable devices. Apps that need first-interaction guarantees on slow networks can still call `registerDefaultMints()` at startup to skip the demand-load. Full contract: `src/lib/mint/README.md`.

## Presets & Defaults

`BlocksProvider` registers project-wide defaults, named presets, and prop-conditional `overrides`. Override hierarchy (conflict-resolved per Tailwind bucket — a later source wins):

```
tv() defaults → defaults.slotClasses → defaults.overrides → preset.slotClasses → preset.overrides → instance slotClasses → instance class
```

Every arrow resolves, the last one included: an instance `class="py-4"` strips a
`slotClasses={{ base: 'py-8' }}` in the same bucket instead of both landing on the element.
`unstyled` changes what is left to resolve, not how — the same two inputs give the same
answer with the flag on.

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

A rule is matched against the component's **effective** variants — the axes that component carries, at their value, or at its config's default where the call site wrote nothing. So a rule keyed on an axis you never set still fires at that axis's default, and both sides of a boolean work, which is what makes a house rule expressible in one entry:

```svelte
<BlocksProvider
  defaults={{ Input: { overrides: [{ disabled: false, class: { base: 'cursor-text' } }] } }}
>
  <!-- every input that is NOT disabled; `{ disabled: true }` is the other half -->
</BlocksProvider>
```

The keys are the component's variant axes. For most axes that is the prop you already write (`variant`, `size`, `intent`, `disabled`); a few are computed rather than received and are listed with each component's variants — `hasRightIcon` and `messageType` on the fields, `open` on the overlays, `interactive` on Card (the axis `clickable`, `onclick` and `href` all resolve to, so one rule covers a card made operable by any of the three).

Two kinds of axis are deliberately not addressable. A component whose look carries no axes at all — `Chat`, `ChatMessageList`, the `Guide*` parts — has nothing to match on; style those with unconditional `slotClasses` or a preset. And an axis that belongs to a *part* rather than the component is only addressable where the state lives: a rule on `{ disabled: … }` under `SegmentItem` selects the item that is disabled, but the same key under `Menu` selects nothing, because Menu's rows carry their own `disabled` per row.

## Icons

358 hand-rolled SVG icons in `src/lib/icons/`, registered via `IconProvider`. Metadata (`ICON_METADATA`) enables search by name, keyword, or category. Discover them with `urbicon icons <query>`.

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

<!-- typecheck -->
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

- [docs/MIGRATION.md](./docs/MIGRATION.md) — breaking changes and what to do about them, newest first. Ships in this package.
- [docs/GUIDE.md](./docs/GUIDE.md) — Guide system (help panel, hints, UI↔guide linking, guided tour): architecture + as-built contract. Ships in this package.
- [docs/VARIANT-CONTRACT.md](./docs/VARIANT-CONTRACT.md) — what each `variant` value means: the surface ladder, Card / Alert / Accordion / Table variants, border tokens, and the naming history. Ships in this package.
- [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) — Token system, Mint, Preset-System, i18n (monorepo only)
- [docs/COMPONENT-API-CONVENTIONS.md](../../docs/COMPONENT-API-CONVENTIONS.md) — Props, callbacks, styling patterns (monorepo only)
- [docs/ComponentStructureStandard.md](../../docs/ComponentStructureStandard.md) — File structure, index.ts, variants.ts (monorepo only)
