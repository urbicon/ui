# Tailwind CSS 4 – Caveats

Key differences from Tailwind 3 and project-specific patterns for Urbicon UI.

## @theme and CSS Variables

Tailwind 4 replaces `theme()` with CSS variables. Custom tokens are defined in `@theme` blocks and automatically generate utility classes:

```css
@theme {
  --color-surface-base: oklch(1 0 0);     /* → bg-surface-base, text-surface-base */
  --color-primary: oklch(0.5 0.2 230);    /* → bg-primary, text-primary */
}
```

Our token architecture in `blocks/src/lib/style/`:
- `foundation.css` – OKLCH color palette, z-index, spacing, radii
- `semantic.css` – `surface-*`, `text-*`, `border-*` tokens with automatic dark mode (via the CSS `light-dark()` function)
- `interaction.css` – Hover/focus/active states, animations

## CSS Variable Access

```css
/* Tailwind 3 */  background-color: theme(colors.gray.100);
/* Tailwind 4 */  background-color: var(--color-gray-100);
```

Standard variables: `--color-{name}-{shade}`, `--text-{size}`, `--spacing`, `--shadow-{size}`, `--radius-{size}`, `--breakpoint-{size}`.

## Svelte 5 Integration

### :global() for Nested Selectors

Svelte scoped styles require `:global()` for Tailwind selectors:

```svelte
<style>
  .container :global(:is(.header, .footer)) {
    @apply bg-blue-100;
  }
</style>
```

### Dynamic Classes

Tailwind 4 requires class names to be known at build time. Dynamic interpolation like `` `bg-${color}-500` `` only works if all possible classes appear in the content scan. For dynamic colors: use CSS custom properties.

## @source and Monorepo Packages

Tailwind 4 only scans explicitly configured source directories for class names. In a monorepo, packages that use Tailwind utility classes in their templates must be registered as `@source` in the consuming app:

```css
/* apps/docs/src/app.css */
@source "./lib";
@source "./routes";
@source "../../../packages/blocks/dist";     /* published blocks */
@source "../../../packages/docs/src/lib";    /* docs component library */
@source "../../../packages/table/src/lib";   /* table package */
```

Without this directive, responsive classes like `lg:block` or transform classes like `rotate-90` that only appear in package components will not be included in the generated CSS. The Vite plugin follows the module graph for content detection but does not reliably capture all classes from external workspace packages.

**This applies to in-repo consumption only** — `apps/docs` sources the packages straight from `packages/*/src`/`dist`, so it registers them itself. A **published-package consumer does not write `@source` directives**: the shipped `packages/blocks/src/lib/style/index.css` already carries `@source '../primitives'` + `@source '../components'` (and `table/style/index.css` carries `@source '../variants'`), which Tailwind resolves relative to the imported file inside `node_modules`. The consumer's entire CSS setup is therefore just `@import 'tailwindcss';` followed by `@import '@urbicon-ui/blocks/style/index.css';`. Importing the `foundation`/`semantic`/`interaction` subfiles instead drops those `@source` directives — which is the usual root cause when a consumer believes they must add `@source "../node_modules/@urbicon-ui/blocks/dist"` by hand. They don't; importing `index.css` is sufficient. The consumer-facing setup surfaces (`get_css_reference`, `get_implementation_checklist`, `find_components`, the `llms-full.txt` template) must reflect this.

## Library CSS must not import Tailwind

The CSS files exported from this monorepo (`packages/blocks/src/lib/style/index.css`, `packages/table/src/lib/style/index.css`, `packages/docs/src/lib/style/index.css`) **must not** start with `@import 'tailwindcss';`. That directive belongs in the consumer app's CSS only.

Why this matters: Tailwind 4 collects every `@theme {}` block from all imported CSS files into one consolidated `:root {}` block per Tailwind compilation. With one compilation (the consumer app's), the consumer's `@theme` is processed last and wins the cascade. The moment a *second* `@import 'tailwindcss';` shows up — e.g. inside a library CSS file that gets pulled into the consumer bundle as a side-effect of importing a component — Tailwind runs a *second* compilation. That second compilation does **not** see the consumer's overrides, so it emits the library defaults. Both compilations land in `@layer theme`, and the later one wins; the consumer's `@theme` overrides silently flip back to the library defaults.

This shows up dramatically with `@urbicon-ui/table` because `packages/table/src/lib/style/index.ts` side-effect-imports `./index.css`, so the second Tailwind compilation enters the consumer's DOM as soon as a Table is mounted — or even just hover-preloaded by SvelteKit (`data-sveltekit-preload-data="hover"`).

The fix is structural: only the consumer app writes `@import 'tailwindcss';`. Library CSS files import design tokens (`@theme {}`, `:root {}`) and Tailwind source directives (`@source './…';`) — never Tailwind itself.

## Project-Specific Conventions

Use semantic tokens instead of primitive Tailwind classes – see [COMPONENT-API-CONVENTIONS.md](COMPONENT-API-CONVENTIONS.md). Avoid hardcoded `dark:` overrides; semantic tokens handle dark mode automatically via the CSS `light-dark()` function (which follows `color-scheme` / the user's `prefers-color-scheme`).
