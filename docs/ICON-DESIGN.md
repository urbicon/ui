# Icon Design Language

The single source of truth for **building new icons and reworking existing ones** so the set
reads as one family. The hard, machine-checkable rules here are enforced by
`bun run icons:lint` (`packages/blocks/scripts/icons-lint.ts`); the soft rules are judgement
calls the linter surfaces as warnings and a reviewer (or you) decides on.

> These values are not invented — they codify what the existing 156 icons already do in the
> majority. When in doubt, **copy the geometry of the named reference icon** for that shape class
> and adapt it; do not start from a blank 24×24.

## Where icons live

- Geometry: `packages/blocks/src/lib/icons/svg/<name>.svg` — a **valid standalone SVG** (so it
  previews in editors). This file is the source of truth for the drawing.
- Component: `packages/blocks/src/lib/icons/<Name>Icon.svelte` — a thin wrapper that does
  `import content from './svg/<name>.svg?raw'` and hands it to `IconWrapper`, which re-emits the
  geometry inside its own `<svg>` with the runtime props (`size`, `strokeWidth`, `rotate`, …).
- The `<svg>` wrapper attributes in the file are stripped at runtime — but they **must still be
  correct** (the linter checks them, and they drive editor preview).

## Icon resolution & tree-shaking

How a component renders a _default_ icon decides whether a consumer who imports that component
drags in **one** icon or **all ~156**. Two resolvers exist (`icons/icon.context.ts`); pick by call
site:

- **`resolveIcon(name, FallbackIcon)` — use this in every component.** The component imports its
  default icon directly, so the bundler sees a static edge to exactly that one icon. The
  `IconProvider` override still wins when present; the direct import is only the fallback.

  ```svelte
  import { resolveIcon } from '$lib/icons';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';   // ← the static edge

  const CloseIcon = resolveIcon('close', CloseIconDefault);
  <!-- render unchanged: <CloseIcon class="h-4 w-4" /> -->
  ```

  From outside the package, icons are named exports, so the fallback import becomes
  `import { CloseIcon as CloseIconDefault } from '@urbicon-ui/blocks'` — this is how
  `@urbicon-ui/table` resolves its icons.

- **`getIcon(name)` — only for the dynamic `<Icon name="…" />` component.** It looks the icon up in
  the `DEFAULT_ICONS` registry by a runtime string. Because the registry maps every name to every
  icon and is indexed dynamically (`DEFAULT_ICONS[name]`), **importing `getIcon` pulls the whole
  icon set into the bundle** — unavoidable for a genuinely by-name component, wrong everywhere else.

**Why it matters.** `DEFAULT_ICONS` statically imports all ~156 icons and `getIcon` reads it via a
runtime key — a dynamic property access no bundler can tree-shake. A single `getIcon('close')` in
`Input` therefore used to drag all 156 icons into any app that imports `<Input>`. `resolveIcon`
never references the registry, so the bundler drops `DEFAULT_ICONS` (and its 156 imports) whenever
no `<Icon>` is in the graph. Measured on the built `dist`: `<Input>` bundles **1** icon, `<Select>`
3, `<Toaster>` 5 — down from 156 each.

**Rule for new components.** Resolve every built-in icon via `resolveIcon(name, …Default)` with a
direct import. Never call `getIcon` in a component — the lone exception is `Icon.svelte`. The
override contract (`IconProvider` / `setIcons`) is identical for both resolvers.

Grep target — a `getIcon(` call outside `icons/Icon.svelte` / `icons/icon.context.ts` is a
regression:

```sh
rg "getIcon\(" packages/*/src --glob '!**/icon.context.ts' --glob '!**/Icon.svelte'
```

## 1 · The hard contract (enforced — errors)

Every `.svg`'s root element is exactly:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
```

- **24×24 viewBox.** No exceptions.
- **`stroke-width="2"`** on the root, and **never** overridden on a child. Strokes scale with the
  icon; a 1.5px stroke anywhere breaks the family weight.
- **`fill="none"`** on the root; **no child carries `fill` other than `none`.** Icons are *pure
  stroke* — shapes are described by their outline, never by a filled body.
- **`stroke-linecap="round"` and `stroke-linejoin="round"`** — every terminal and corner is round.
  This is the single biggest contributor to the "one family" feel.
- **`stroke="currentColor"`** on the root; no child overrides `stroke`. Colour comes from the
  consumer's text colour / token.
- **Original geometry only.** Do not copy path data from Lucide, Heroicons, Feather, etc. Match
  *our* construction rules; draw the shape yourself.

Elements: use `<path>`, `<circle>`, `<rect>`, `<line>`, `<ellipse>`. A `<g>` is allowed **only**
to carry a local `transform` (see `ruler.svg`, which draws an axis-aligned ruler then rotates it
−45° — so its geometry stays on-grid). A `<g>` must not carry styling.

## 2 · Construction grid

- **0.5px grid (hard for axis-aligned geometry).** Every coordinate on an *attribute* —
  `x y width height cx cy r rx ry x1 y1 x2 y2` — is a multiple of `0.5`. The whole set currently
  honours this with zero violations; keep it that way.
- **Organic / diagonal paths (soft).** Bézier control points and diagonal vertices inside a
  `d="…"` may use finer values when the shape demands it (`star`, `sun`, `eye-off`, `link`).
  Prefer 0.5 for start/end points; the linter only *warns* on off-grid path numbers so genuinely
  organic curves aren't forced onto a grid that would distort them.
- **Dot idiom.** A "dot" (the `i` of info, the `?` tail, a status pip) is drawn as a zero-length
  round-capped segment: `<path d="M12 17h.01" />`. The `.01` is intentional and exempt from the
  grid rule.

### Live area & trim

The drawing sits in a **~20×20 live area** centred in the 24×24 box, leaving a **≥1.5px trim
margin** to the edge so icons never feel cramped and align optically when placed in a row.

- **Round full-bleed shapes** use `r="9.5"` at `cx/cy="12"` (outer stroke edge ≈ 10.5 → 1.5px
  trim). This is the canonical status-ring size — see the whole circle family.
- **Rectangular containers** span roughly `3 … 21` (≈17–18 per side).
- **Optical centring beats geometric centring.** A shape's visual mass should sit at the centre,
  which is *not* always its bounding-box centre (a play triangle, a teardrop, a cloud lean
  slightly off-centre on purpose). Match the reference icon rather than forcing the bbox to 12,12.
- Keep optical *size* consistent: a new icon should fill about as much of the live area as its
  neighbours. Compact glyphs (`droplet`, `flame`) are the floor; don't go smaller without reason.

## 3 · Corner radius (enforced — errors)

`rect` corners come from a small discrete scale, chosen by the rect's **shorter edge**, or are a
**capsule** (fully rounded on the short axis). Anything else is an error.

| Shorter edge | `rx` | Use | Reference |
| --- | --- | --- | --- |
| ≥ 10 | **2.5** | large container / card / screen | `calendar`, `credit-card`, `inbox`, `terminal` |
| 6 – 9 | **1.5** | mid body | `server`, `printer`, `qr-code` finder squares |
| ≤ 5 | **0.5** | small detail module | `qr-code` modules, `list-ordered` counters, `archive` lid |
| any | **`min(w,h) / 2`** | capsule / pill (intentionally round) | `mic`, `pause` bars, `bug` body, `headphones` ears |
| any | **`0` or `0.5`** | intentionally angular | `building` (architecture reads as crisp) |

Allowed discrete values: **`{0, 0.5, 1.5, 2.5}`**. The in-between values `1` and `2` are *not*
allowed — they're the source of the "same shape, different rounding" drift. `database`'s `rx="8"`
is an **`<ellipse>` radius** (a cylinder), not a corner, and is out of scope.

## 4 · Canonical motifs

Reuse one shape for one idea so repeated elements are pixel-consistent:

| Motif | Canonical form | Notes |
| --- | --- | --- |
| Status ring | `<circle cx="12" cy="12" r="9.5" />` | every `*-circle` status icon |
| Checkmark (in-circle) | `<path d="M8.5 12l2.5 3L16 9" />` | `check-circle` **and** `success-circle` share it |
| Checkmark (standalone) | `<path d="M5.5 12l4.5 5L18.5 6.5" />` | the larger `check`; same ~0.5 arm ratio, scaled up |
| Dot | `<circle r="1" />` | grip dots, `more-horizontal/vertical`, list bullets |
| Small node / hub | `<circle r="1.5" />` | dial hubs (`gauge`, `meter`), `tag` eyelet |
| Graph node | `<circle r="2.5" />` | `git-branch`, `share` endpoints |
| Head / lens | `<circle r="4.5" />` (person) · `r="3.5"` (lens) | `user`, `eye`, `camera` |
| Pip / "i" dot | `<path d="M12 8h.01" />` | info, help, warning |

Two glyphs may be **intentionally identical** when they're semantic aliases (`check-circle` vs
`success-circle`): same drawing, different name and colour token. That's fine — don't introduce a
gratuitous geometric difference to tell them apart.

## 5 · Detail budget (small-size legibility)

Icons must stay readable at **16px**. At 16px a 2px stroke renders ~1.3px, so detail that's too
dense smears into a blob.

- **Minimum ~2px between parallel strokes** in the 24-space. Tighter than that and they merge at
  16px (the failure mode behind dense bullseyes and stacked waves).
- **≤ 20 coordinate pairs per `<path>`** (linter warns above). Prefer splitting distinct shapes
  into separate primitives over one dense compound path. Genuinely complex single glyphs (a gear
  — `settings`, ~24 pts) are an accepted, *documented* exception, not a licence for density.
- If a concept can't survive 16px, simplify the concept, don't shrink the strokes.

## 6 · Path style (soft — warnings)

- **Compact notation:** `M12 3C9 7 6 11 6 14.5` — no spaces between a command letter and its
  numbers. The set is 95% compact; the spaced minority (`droplet`, `fuel`, `rocket`, …) are
  warned, not blocked. New icons should be compact.
- **Multi-element over compound:** distinct sub-shapes are separate `<path>/<circle>/<rect>/<line>`
  elements, not crammed into one `d`. (A single outline that happens to be complex, like a file
  with a folded corner, is still one path — that's correct.)

## 7 · Reference icons by shape class

When drawing a new icon, find its class and start from that file's geometry:

| Class | Reference(s) | Construction cue |
| --- | --- | --- |
| Round / status | `circle`, `info-circle`, `check-circle` | `r=9.5` ring + inner glyph |
| Triangle / warning | `warning-triangle` | `M12 3.5L2.5 20h19z` |
| Large container | `calendar`, `credit-card`, `monitor` | `rect rx=2.5`, ~17 per side |
| Mid container | `server`, `printer` | `rect rx=1.5` |
| Capsule | `mic`, `pause` | `rx = short/2` |
| Document | `file`, `file-check` | folded-corner outline; one path |
| Teardrop | `droplet`, `flame` | shared `M12 3 C9 7 6 11 6 14.5 a6 6 0 0 0 12 0 …` |
| Inline meter | `meter`, `water-meter` | `r=6` dial + side flanges at `x=3/21` |
| Person | `user`, `users` | `r=4.5` head + shoulder arc |
| Arrow | `arrow-right` | shaft `M4.5 12h15` + head |
| Chevron | `chevron-right` | `M9.5 7l5 5-5 5` |
| Bars / chart | `bar-chart`, `pellet` | parallel strokes ≥2px apart |
| Toggle pair | `eye`/`eye-off`, `mic`/`mic-off` | base glyph + diagonal slash `M…l…` |

## 8 · Adding a new icon — touch ALL of these

Missing any of steps 2–5 means the icon draws but is unreachable through the registry, the icon
picker, or `find_icons`. `icons:lint` checks every link in this chain.

1. Create `svg/<name>.svg` (the drawing) **and** `<Name>Icon.svelte` (copy an existing wrapper;
   it just imports `./svg/<name>.svg?raw`).
2. Add `'<name>'` to the `IconName` union in `icon.context.ts`.
3. Register the component in `DEFAULT_ICONS`.
4. Add an `ICON_METADATA` entry (`label`, `categories`, `keywords`) — this feeds the MCP
   `find_icons` tool and the docs icon browser.
5. Add a named export in `index.ts`.

Semantic aliases are allowed: a `DEFAULT_ICONS` key may map to a differently-named component
(`info: InfoCircleIcon`). The linter follows the component, not the name.

## 9 · The linter

```bash
bun run icons:lint            # errors fail (exit 1); warnings are informational
bun run icons:lint --strict   # warnings fail too — use when tightening the set
```

**Errors (must fix):** root-attribute contract, child `fill`/`stroke`/`stroke-width` overrides,
off-grid axis-aligned coordinates, illegal `rect` `rx`, and registry integrity
(svg ↔ `.svelte` ↔ `index.ts` ↔ `DEFAULT_ICONS` ↔ `ICON_METADATA` ↔ `IconName`).

**Warnings (judgement):** off-grid numbers inside organic paths, dense paths (>20 pts), spaced
path notation, unusual elements. These are the deliberately-soft rules from §2, §5 and §6.

The constants in `icons-lint.ts` (`RECT_RADII`, `POINT_BUDGET`, `GRID`, `REQUIRED_ROOT`) mirror
this document — change them together.

---

See also: `CLAUDE.md` → *Icon Design Rules* (summary + pointer here),
`packages/blocks/src/lib/icons/icon.context.ts` (registry & metadata).
