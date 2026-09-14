# Urbicon UI

> Zero-dependency Svelte 5 + Tailwind CSS 4 component library built for LLM-assisted development — a custom `tv()` variant engine, an OKLCH design-token system with automatic dark mode, and production-ready primitives and patterns across `blocks`, `table` and `auth`.

## Install

```bash
bun add @urbicon-ui/blocks
```

Then two CSS imports — Tailwind first, then the token sheet (it also carries the `@source`
directives that make the components' classes reachable):

```css
@import 'tailwindcss';
@import '@urbicon-ui/blocks/style/index.css';
```

`@urbicon-ui/table` and `@urbicon-ui/auth` each ship a stylesheet of their own — import it after
blocks, or their classes compile to nothing. Import it where your app loads CSS (`+layout.svelte`
under SvelteKit, `main.js` in a plain Vite + Svelte app). Requirements: Svelte 5, Vite and
Tailwind 4 — SvelteKit is **not** required for `blocks`, `table` or `i18n`. In a SvelteKit
project, `bunx sv add tailwindcss=plugins:none @urbicon-ui` does the install and the CSS wiring
in one non-interactive step (see the Full API Reference below for the complete flow).

## Resources

{{RESOURCES}}

{{COMPONENTS}}
