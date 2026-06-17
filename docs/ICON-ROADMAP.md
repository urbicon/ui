# Icon Set Expansion (P1–P3)

Record of the icon-set expansion from **156 → 315 icons**, added in three prioritised waves
following [ICON-DESIGN.md](ICON-DESIGN.md) and verified by `bun run icons:lint`. The live source
of truth for what exists is `ICON_METADATA` in `packages/blocks/src/lib/icons/icon.context.ts`
(and the MCP `find_icons` tool); this file records the *rationale* and the open backlog.

## Why these icons

The pre-expansion set was strong on `action`/`data` but thin on **family symmetry** (a `bell`
without `bell-off`, a `user` without `user-plus/-x/-check`) and on the **domain depth** the
consumer apps need (real estate, energy/utility, finance, auth). The waves close exactly those
gaps — domain depth is the differentiator vs. generic sets like Lucide.

## Method

Geometry was drawn by parallel per-family agents (isolated `svg/<name>.svg` writes), then
integrated centrally (wrappers + `IconName` + `DEFAULT_ICONS` + `ICON_METADATA` + `index.ts`) so
parallel work never collided in the shared registry files. Every wave passed `icons:lint`
(contract + 0.5 grid + radius scale + registry integrity) and a visual contact-sheet review at
44px and 16px.

## Waves (shipped)

**P1 · Grundlücken & Symmetrie (54)** — grundformen/status (`square` `triangle` `hexagon`
`octagon` `plus-circle` `minus-circle` `alert-circle` `ban` `badge-check` `circle-dot`), navigation
(`chevrons-up/down` `arrow-left-right` `arrow-up-down` `corner-down-right` `corner-up-left` `move`
`expand`), editor (`strikethrough` `heading` `quote` `list-checks` `table` `indent` `outdent`
`unlink` `type` `highlighter`), files (`file-plus` `file-text` `files` `folder-open/-plus/-minus`
`paperclip` `import` `clipboard-list/-check` `book-open`), comms (`bell-off` `bell-ring` `mail-open`
`mail-check` `message-square` `at-sign` `reply` `megaphone`), user (`user-plus/-x/-check/-cog`
`id-card` `contact` `circle-user`).

**P2 · Domänen-Tiefe (70)** — real estate (`house` `building-2` `door` `door-open` `bed` `bath`
`sofa` `stairs` `parking` `warehouse` `store` `tree` `leaf` `fence` `hard-hat` `hammer`), energy/
climate (`battery` `battery-charging` `battery-low` `plug` `plug-zap` `solar-panel` `wind`
`snowflake` `radiator` `recycle` `waves` `oil-can` `trending-up/-down` `sun-snow` `gauge-circle`),
finance (`euro` `percent` `coins` `banknote` `piggy-bank` `landmark` `scale` `hand-coins` `repeat`
`file-signature` `badge-euro` `wallet-cards` `circle-percent` `calendar-clock`), auth
(`fingerprint` `shield-check/-alert/-x/-off` `scan` `scan-face` `smartphone` `lock-keyhole`
`key-round` `passkey` `badge-alert`), analytics (`line-chart` `area-chart` `scatter-chart`
`table-2` `columns-3` `rows-3` `git-commit` `git-merge` `workflow` `network` `list-filter`
`calendar-days`).

**P3 · Breite (35)** — media (`skip-forward/-back` `rewind` `fast-forward` `stop-circle` `shuffle`
`music` `film` `aperture` `gallery`), weather (`cloud-rain/-snow/-sun/-lightning` `umbrella`
`sunrise` `sunset` `wind-arrow`), transport/geo (`car` `bike` `plane` `map` `navigation` `route`
`anchor`), objects (`coffee` `shopping-bag` `watch` `glasses` `graduation-cap` `heart-pulse`
`smile` `gamepad` `pill` `flashlight`).

## Non-goals

- **Brand / social logos** (GitHub, Google, X, …). They violate the "original geometry only" rule,
  age badly, and carry trademark constraints. If OAuth buttons ever need them, that belongs in a
  separate, clearly-scoped `brand` namespace — not this stroke set.

## Polish backlog (optional)

Functional and on-contract, but worth a second design pass if time allows:

- `badge-check` / `badge-euro` — the scalloped seal is the densest glyph (~16-pt path); confirm it
  holds at 16px or drop to a 6-point seal.
- `fingerprint` — parallel arcs sit near the 2px detail floor at 16px.
- `quote` / `strikethrough` — readable but the letter-suggestion is subtle.
- `sun-snow`, `fence` — `sun-snow` is busy; `fence` can read as a hash at small sizes.
