# Documentation Site

The Urbicon UI documentation site ([ui.urbicon.de](https://ui.urbicon.de)) — a SvelteKit app
that consumes the workspace packages the same way an external project would.

It is a **private, never-published app**: it keeps its own `package.json` version rather
than tracking the library version, and `bun run bump` deliberately skips `apps/*`.

## Running it locally

The site renders from the packages' build output, so a fresh worktree needs them built
once:

```bash
bun install
bun run build            # or: bun run build:packages
bun run docs:gen:all     # generates api.ts per page + the catalogs (git-ignored)
bun --filter='@urbicon-ui/docs-app' run dev
```

`docs:gen:all` matters: every page imports a generated `./api.ts`, and those files are
git-ignored. Without the run, `svelte-check` reports hundreds of missing-module errors and
the dev server fails to resolve half the routes.

Only ever run **one** Vite server per worktree — two of them racing on the same
`.svelte-kit` directory produces confusing, unrelated failures.

## What lives here

| Area | Route | Notes |
| --- | --- | --- |
| Component pages | `/blocks/primitives/*`, `/blocks/components/*` | Structure and section order: [DocsPageGuide.md](../../docs/DocsPageGuide.md) |
| Recipes | `/recipes/*` | Production-ready compositions; the canonical list is `src/lib/navigation.ts` |
| Showcase | `/showcase` | A realistic project-management interface exercising many components together |
| Theme builder | `/customization/theme-builder` | Visual OKLCH theme generator |
| Figma tokens | `/customization/figma-tokens` | Token export, see below |
| Tier system | `/customization/tier-system` | Live demo of the radius tiers incl. the bridge token |
| Rooms theme | `/customization/rooms-theme` | Full Color Rooms catalogue (see below) |
| Changelog | `/changelog` | Loaded from the root `CHANGELOG.md` via the `virtual:changelog` Vite module |

Three registration points are **hand-maintained** and easy to forget — the sidebar
(`src/lib/navigation.ts`), `componentLinks`, and the recipes cookbook. Forgetting one fails
silently: the page never appears in the sidebar, `@related` chips to it are dropped without
a word, recipe chips fall back to `#`. `bun run registry:lint` gates all three.

## Recipes

Each recipe lives in its own folder under `src/routes/recipes/` with `+page.svelte` (live
preview), `meta.ts` (structured metadata), and a `recipeCode` template literal for the
side-by-side code view. Recipes are addressable via the MCP `get_recipe` tool and the
`urbicon recipe` CLI command.

Categories currently covered: authentication, layout/dashboards, planning, forms and
wizards, marketing, display, notifications, and trace/diagnostics. The navigation map is
the authoritative list — do not maintain a second one here.

## Figma token export

`generateFigmaTokensJSON()` in `packages/blocks/src/lib/utils/figma-token-export.ts`
exports the full design-token system as Tokens Studio-compatible JSON (categories: `color`
— six OKLCH palettes, `semantic` — surface/text/border, `spacing`, `borderRadius`,
`shadow`). Available programmatically and as download/copy on the `/customization/figma-tokens`
page.

## Theme builder

`/customization/theme-builder` is a visual OKLCH theme generator: hue, chroma and lightness
sliders, eight colour presets, a matched **neutral chassis** control (hue + tint strength,
auto-following the brand hue), live component preview, and CSS `@theme` export. The chassis
control re-tints `--color-neutral-*` so generated themes keep surfaces, text and borders in
the accent's temperature family instead of a fixed cool grey.

---

# The Color Rooms theme

The docs site opts into the **Color Rooms theme** — Schibsted Grotesk on a warm cream-paper
palette whose accent is the **room you are in**, and a room is a component **family**. A
component's doc page wears its family's channel: `action` orange, `navigation` teal, `form`
blue, `display` azure, `overlay` purple, `data` cyan, `feedback` red, `ai` magenta, `layout`
ink. Pages documenting no single component fall back to their product area (`/blocks`
orange, `/table` cyan, `/ai` magenta, `/auth` blue, everything else orange).

It is the same channel register the landing page runs on, so a component's row in the
landing index and its doc page carry the same colour.

**Library consumers keep the library defaults — Color Rooms is private to the docs site.**
It replaced an earlier fixed-green "Editorial" theme.

## How it activates

Color Rooms is a **pure token-override layer**, not a parallel component tree:

```html
<html lang="en" class="docs-rooms"></html>
```

The class sits on `<html>` (not `<body>`) so the `app.html` head script can flip it before
first paint. The per-route room is stamped as `data-room="<channel>"` on a
`.docs-room-scope` wrapper in `+layout.svelte`, and mirrored onto `<html>` after mount for
portaled popovers. Everything below applies only within that scope.

Both halves of the mapping are **generated** by `scripts/channels-gen.ts`:

- route → channel into `src/lib/landing/route-channel.gen.ts` (read from the docs-gen catalogues)
- channel → accent triple into `src/lib/style/rooms-channels.gen.css` (read from the channel register)

## Private tokens (`--docs-*`, `--room-*`)

`src/lib/style/rooms-docs.css` defines a private token namespace for docs-specific concerns
that don't belong in the library:

| Token | Purpose |
| --- | --- |
| `--room-accent`, `--room-accent-fg`, `--room-accent-text` | Active room colour, its on-accent ink, and the same channel one step deeper. Two colour steps because there are two WCAG thresholds: `--room-accent` clears 3:1 (fills, lines, marks, the header field), `--room-accent-text` clears 4.5:1 (small body text). |
| `--docs-bg`, `--docs-paper` | Page ground (cream) and content surface (lighter cream). Inverts to warm dark in dark mode. |
| `--docs-lifted`, `--docs-floating` | L·2 (dropdowns, popovers, selects) and L·3 (modals, sheets, command menus) — the cream ladder above paper. |
| `--docs-ink`, `--docs-soft`, `--docs-softer` | Three-stop ink hierarchy (primary text `#17150f`, meta/body-soft, decoration). |
| `--docs-hair`, `--docs-line` | Hairline (8 % alpha) and line (14 % alpha) — ink-on-paper in light, cream-on-paper in dark. |
| `--docs-accent` | Docs accent (active markers, links, sidebar logo mark). Couples to `--color-primary` so the room colour re-uses it. |
| `--docs-radius-pill`, `--docs-radius-card`, `--docs-shadow-page` | Docs geometry — TOC crumbs, Bento cards, Recipe-stage lift. |
| `--font-display`, `--font-sans` | Schibsted Grotesk — one grotesk for display and body. |
| `--font-mono` | JetBrains Mono for meta (section markers, mono kickers, prop labels). |

All `--docs-*` tokens use `light-dark()`, so the canvas is first-class light **and** dark:
the cream-paper / warm-ink shape inverts to warm-dark-paper / cream-ink without losing
identity. The room accent is orthogonal to the mode — it repaints primary, not the paper.

## Library-token overrides

Inside `.docs-rooms` the scope re-binds the most-consumed library tokens:

- **Primary:** `--color-primary` → `light-dark(var(--room-accent-text), var(--room-accent))`,
  `--color-text-on-primary` → `light-dark(#fbfaf6, var(--room-accent-fg))`
- **Surface ladder:** `--color-surface-base/-quiet/-elevated/-overlay` → `--docs-paper/-bg/-lifted/-floating`
- **Borders:** `--color-border-hairline` → `--docs-hair`. The architectural borders
  (`-subtle/-default/-emphasis/-strong`) route through the library's `--color-warm-neutral-*`
  ramp (Hue 45) so they shed the cool-grey bias against cream.
- **Text:** `--color-text-primary/-secondary/-tertiary/-quaternary` → the ink hierarchy.
- **Surface mid-states** (`-hover/-active/-disabled/-interactive/-subtle/-inverted`) and
  `--color-text-disabled` / `--color-interactive-disabled` also route through `warm-neutral`.
- `--blocks-shadow-tint` shifts to `oklch(0.22 0.04 70)` so shadows blend with cream instead
  of reading as cool smudges.

## Room accent + intent retuning

Instead of a single fixed primary, Color Rooms **re-derives the entire 11-step
`--color-primary-*` ramp from the room** via `color-mix(in oklab, …)`, off two anchors:
stops 50–500 hang off `--room-accent` and mix toward cream (the surface/line half), stops
600–950 hang off `--room-accent-text` and mix toward ink (the text half).

The eleven rooms are the channels of the shared register (`src/lib/landing/channels.ts`).
Each contributes a channel's **accent step** (the lightest step still clearing 3:1 against
the paper), its dark on-colour, and its **text step** (the lightest step clearing 4.5:1).
Nine are reached by a component family, the rest only by an area fallback:

| Family | Channel | Family | Channel |
| --- | --- | --- | --- |
| `action` | orange | `overlay` | purple |
| `data` | cyan | `feedback` | red |
| `ai` | magenta | `layout` | ink |
| `form` | blue | `display` | azure |
| `navigation` | teal | | |

Because every accent step sits on one lightness step (L ≈ 0.65), the on-field numbers stay
tight: the title clears 5.5–5.6:1 on its own fill, the 88 % lede 4.7–4.9:1, the 72 %
tertiary 3.6–3.8:1. The achromatic `ink` channel is the one exception the generator handles
explicitly — its register accent *is* its near-black solid, which would vanish on the dark
docs paper (1.4:1), so the docs room uses a neutral step computed by the same rule
(3.0:1 light / 5.1:1 dark).

### Why two colour steps and not one

`--color-primary` is a **dual-role token** — it is both `bg-primary` (button, toggle,
progress) and `text-primary` (body link, active nav entry, Tab label, Menu checkmark),
inside the library components as much as in the docs app. So it has to carry the sharper of
the two thresholds, 4.5:1: a 3:1 accent renders a 16 px link at 3.13:1.

What the split buys is that only the *token* takes the deeper step. The header bands, hero
fields, register rail, wordmark cursor and playground tint read `var(--room-accent)`
directly and stay fresh, as do `--color-interactive-focus` and `--color-chart-*` (both
non-text marks, governed by the 3:1 rule).

The cost is that a light-mode primary fill sits one step deeper than the band above it —
which is also what the library's default theme does (`primary-600` under white text). The
text role is itself a `light-dark()` pair because no single colour is AA on both papers:
4.5:1 against `#fbfaf6` needs relative luminance ≤ 0.173, against `#232220` ≥ 0.247. The
generator guards the *role*: the text step against the light paper, the accent step
(4.85–4.87:1 there) against the dark one.

### The intent palette is room-independent

Retuned once (warm) so Success / Warning / Danger / Secondary sit naturally on cream and
stay distinct from the room primary:

| Intent | Hue | Why |
| --- | --- | --- |
| Secondary | 15 (burgundy/mahogany) | Warm complementary; the library default Hue 280 (violet) reads cool on cream. |
| Success | 150, darker / lower chroma | Library Hue 140 sits next to the register's green — would read as a second room button. Sage reads as "completed/verified". |
| Warning | 55 (amber) | Library Hue 80 is yellow-green-adjacent; amber harmonises with cream. |
| Danger | 22 (maroon) | Library Hue 25 vivid red sits aggressively on cream; maroon keeps the alert reading. |
| Info | 220 (teal) | **Unchanged.** Cool blue against the warm palette is deliberate — info banners read as informational chrome. |

## Why semantic tokens are re-declared in the docs scope

A subtle CSS detail: when a custom property is defined as
`--color-primary: light-dark(var(--color-primary-600), var(--color-primary-500))` at
`:root`, the `var()` resolves **at the cascade level where the property is defined**.
Overriding the ramp later in `.docs-rooms` does *not* re-trigger that substitution — the
inherited value is the already-resolved library string.

Color Rooms therefore re-declares all derived semantic tokens (`--color-primary`, `-hover`,
`-active`, `-subtle`, `-emphasis`, `--color-surface-selected`,
`--color-interactive-hover/-active/-focus`) inside the scope, one-to-one mirroring the
library shapes in `semantic.css`. The re-declarations look redundant but they are
load-bearing: without them the room ramp stops at the raw stops and components still pick up
the library blue.

Because portaled popovers mount **outside** the `.docs-room-scope` wrapper, the derivation
is declared on both the wrapper (content — SSR-correct, no flash) and `.docs-rooms` on
`<html>` (portals — mirrored after mount).

## Docs hooks on shared components

Components in `packages/docs` carry small `data-docs-*` hooks that the docs scope styles.
The namespace is that package's **published theming contract**: skins target these
attributes (never internal class names or test ids), and renames are breaking changes for
skins.

- `[data-docs-header]` — the `DocsLayout` hero header, becomes the room colour field. A
  **full-width band**: a direct child of the layout container (not the body column), so it
  spans everything right of the app sidebar and the on-this-page TOC drops below it.
  Alignment with the body column is re-imposed by an inner wrapper sharing `main`'s `maxWidth`.
- `[data-docs-sticky-bar]` — the sticky breadcrumb strip, shares the header's accent fill.
  On scroll the title collapses under it, leaving a low ribbon in the room colour. Inside
  it, `[data-docs-sticky-hairline]` is hidden (the colour edge is the separator) and
  `[data-docs-scrollspy]` flips to a translucent-foreground inlay.
- `[data-room-hero]` — hand-rolled section-landing heroes (`/blocks`, `/ai`,
  `/getting-started`, `/recipes`, `/showcase`): the same full-width band flush to the app
  sidebar, with the page nesting an inner `max-w-* mx-auto px-*` wrapper for alignment.
  `[data-room-chip]` flips a room-tinted chip so it reads on the fill.
- `[data-docs-stage="example|playground"]` / `[data-docs-stage-frame]` — on `CodeExample`
  and `PlaygroundConfigurator`; backgrounds flatten to transparent in the scope.
- `[data-docs-subtitle]` — the `DocsLayout` sub-headline, hidden on component pages (the
  colour field is title-first).

The consumer-facing summary of these hooks lives in
[COMPONENT-API-CONVENTIONS.md § Docs Theme Hooks](../../docs/COMPONENT-API-CONVENTIONS.md#docs-theme-hooks).

## Full catalogue

The complete Color Rooms token catalogue, the room table, activation steps, light/dark
modes and override recipes are documented on the site itself at `/customization/rooms-theme`.
