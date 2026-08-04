# Icon Set Expansion

Record of the icon-set expansion from **156 icons to the current set of 358**, added in four
prioritised waves following [ICON-DESIGN.md](ICON-DESIGN.md) and verified by `bun run icons:lint`.

**The expansion is complete**; what remains open is the polish backlog at the bottom. The live
source of truth for what exists is `ICON_METADATA` in
`packages/blocks/src/lib/icons/icon-registry.ts` (and the `urbicon icons` command); this file
records the *rationale* and that backlog.

Since P4 the *admission* question has an answer of its own —
[ICON-DESIGN.md](ICON-DESIGN.md) → "What belongs in the set". Read it before proposing a wave
five: it is what stops the set from drifting into a general-purpose library.

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

**P4 · Symmetrie-Nachlese & UI-Vokabular (43)** — the three earlier waves named family symmetry as
their motive but left the reverse direction missing in a dozen places, and a year of new components
arrived without their glyphs. Series completions (`upload` `export` `wifi-off` `cloud-off`
`user-minus` `file-x/-minus` `folder-x` `mail-x` `align-justify` `pin-off` `git-pull-request`
`panel-top/-bottom` `chevrons-up-down`); glyphs a shipped feature was missing (`command` `option`
`arrow-big-up` `corner-down-left` for `Kbd`/CommandPalette, `languages` for `LocaleSwitcher`,
`history` `timer` `hourglass` `loader` `accessibility` `sliders-horizontal` `layout-grid`
`layout-list` `calendar-check/-x/-plus`; `loader` is drawn **to be rotated** — render it as
`<LoaderIcon animation="spin" />`, and keep its gap off-centre so it still reads as a ring with a
gap when it stands still, rather than as the letter U); breadth with a caller (`file-image` `file-code`
`subscript` `superscript` `remove-formatting` `play-circle` `pause-circle` `volume-low` `braces`
`cpu` `download-cloud` `dollar-sign`).

Five candidates were **dropped by the admission rules** rather than drawn: `volume2` and
`cloudUpload` duplicate `volume` / `uploadCloud`, `hardDrive` is a near-duplicate of `server`,
`fileJson` is covered by `braces` + `fileCode`, and `fileArchive` (covered by `archive` / `package`)
had no zipper motif that survives 16px. The same wave replaced the last hand-inlined SVGs in
CommandPalette, table's Empty/Error/Link cells, CodePanel and the docs nav with real icons.

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
