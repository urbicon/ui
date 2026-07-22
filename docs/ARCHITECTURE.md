# Urbicon UI – Architecture Overview

Technical architecture of the Urbicon UI monorepo. For API conventions see [COMPONENT-API-CONVENTIONS.md](COMPONENT-API-CONVENTIONS.md), for component file structure see [ComponentStructureStandard.md](ComponentStructureStandard.md), for the six-family taxonomy that drives ARIA / tier / border decisions see [COMPONENT-FAMILIES.md](COMPONENT-FAMILIES.md).

> **Strategic context (2026-04):** Urbicon is a vertically integrated zero-dependency platform covering UI primitives, data tables, auth, i18n, docs, and AI-native DX — all packages share unified versioning and zero external runtime dependencies. Current focus is **consolidation for v1.0** ("harden before extend").

## Design Token System

Three-layer CSS custom property architecture in `packages/blocks/src/lib/style/`:

| Layer       | File              | Purpose                                                                                                                                                                                                                             |
| ----------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation  | `foundation.css`  | OKLCH color palette, spacing, radii, z-index scale, breakpoints                                                                                                                                                                     |
| Semantic    | `semantic.css`    | Context-aware tokens (`surface-*`, `text-*`, `border-*`) with automatic dark mode via the CSS `light-dark()` function                                                                                                               |
| Interaction | `interaction.css` | Hover/focus/active states, duration tokens (`--blocks-duration-fast`, `--blocks-duration-normal`), easing tokens (`--blocks-ease-confident`, `--blocks-ease-springy`), shadow tokens (`--blocks-shadow-sm` .. `--blocks-shadow-lg`) |

Foundation tokens define raw OKLCH values. Semantic tokens map those to UI purposes and handle light/dark switching automatically. Interaction tokens define motion and visual feedback.

All tokens are registered in Tailwind 4 `@theme` blocks so they generate utility classes automatically (e.g. `bg-surface-base`, `text-text-primary`). See [TailwindCaveats.md](TailwindCaveats.md) for Tailwind 4 integration details.

## Tier System

Radius semantics across the library follow a three-tier model. Each tier maps to a foundation token; a component picks the tier whose semantics match its purpose, not a fixed pixel value. Brands can re-tune the physical radius of a tier without touching component code.

| Tier      | Token              | Purpose                                                                                                 | Default geometry                 |
| --------- | ------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `commit`  | `--radius-commit`  | Action surfaces — buttons, menu triggers, toolbar items, toggle tracks. Declares identity ("press me"). | Pill (`9999px` at brand default) |
| `modify`  | `--radius-modify`  | Tap surfaces — inputs, selects, checkboxes, tabs. Reads as editable, not as a commit-decision.          | Soft (`var(--radius-sm)`)        |
| `contain` | `--radius-contain` | Architectural surfaces — cards, dialogs, drawers, popovers, sidebars. Reads as a frame holding content. | Subtle (`var(--radius-xs)`)      |

**Tier-aware components** (commit-default): `Button`, `ButtonGroup`, `Menu`, `Toolbar`, `Toggle`, `Stepper`, `SegmentGroup`, `RadioGroup`. **Modify-default**: `Checkbox`, `Tab`. **Contain-default**: `Card`, `Dialog`, `Drawer`, `Popover`, `Accordion`, `Collapsible`. Other primitives are not tier-aware — Feedback / Ambient (Toast, Spinner, Progress, Skeleton, Badge) have fixed per-component geometry; Identity (Avatar) lives on a separate `shape` axis. See [COMPONENT-FAMILIES.md](COMPONENT-FAMILIES.md) for the full family taxonomy.

**Context propagation.** Tier-aware primitives read their effective tier from `<TierContext>` (`packages/blocks/src/lib/utils/tier-context.ts`). A wrapping container can set the tier for all descendants:

```svelte
<Toolbar tier="modify">
  <Button />
  <!-- now `rounded-modify` instead of the commit pill -->
  <Toggle />
  <!-- same -->
</Toolbar>
```

Standard pattern inside a tier-aware component:

```ts
const tierCtx = getTierContext();
const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'commit'); // or 'modify'
```

The per-instance `tier` prop wins over context; context wins over the family default.

**Bridge token (`--radius-bridge`).** A fourth _adjacency_ token (not a tier) used solely by the `Menu` panel container: the trigger is a pill (`commit`) but the panel sits between the pill edge and the `contain`-tier surface beneath. `--radius-bridge` lives in `foundation.css` and defaults to `var(--radius-md)`. No other component uses it as a primary surface radius. Live demo: `apps/docs/src/routes/customization/tier-system/+page.svelte`.

## Component Styling

Components use a **custom `tv()` variant engine** (in `packages/blocks/src/lib/utils/variants.ts`, ~600 LoC, zero-dependency replacement for `tailwind-variants`) for all variant logic. Each component has a `*.variants.ts` file defining slots, variants, sizes, intents, compound variants, and default values.

Key patterns:

- **Semantic tokens only** – no `dark:` overrides anywhere in primitives (dark mode via the CSS `light-dark()` function in `semantic.css`, driven by `color-scheme`)
- **Surface tier semantics** (XC-13, Lighter v5). Four tints sit on top of `surface-base` (= the page background). Every container-shaped primitive should pick the tier whose semantics match its purpose:

  | Token              | Purpose                                                                                                                                                                                                                     | Lift relative to base                       |
  | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
  | `surface-base`     | Page background                                                                                                                                                                                                             | —                                           |
  | `surface-quiet`    | Softly tinted in-page zones that signal "own zone" without border or shadow (Card `quiet`, Toolbar `quiet`, Accordion items, Table `striped` row alternation and `surface` variant). The Lighter default.                    | ~1 % darker in light, ~3 % lighter in dark  |
  | `surface-subtle`   | Visible tinted zones for grouped content (Stepper indicators, Auth list items with a border).                                                                                                                               | ~2 % darker in light, ~5 % lighter in dark  |
  | `surface-elevated` | Floating overlays that sit _above_ the page with their own stacking context (Popover, Menu, Tooltip, Toast, Combobox listbox, Card `elevated`, Toolbar `elevated`). Pair with `shadow-md`/`shadow-lg` and a real `z-index`. | Same lift as `subtle` plus shadow + z-index |
  | `surface-overlay`  | Backdrop layer for modals — translucent, draws focus from page content.                                                                                                                                                     | n/a (translucency)                          |

  The v5 variant contract follows this hierarchy: `quiet` consumes `surface-quiet` (Lighter default — no border, no shadow), `outlined` is `bg-transparent border-default` (in-page chrome), `elevated` is `surface-elevated + shadow-md` (lifted via shadow alone, no border), `floating` is `surface-elevated + shadow-lg` (popover-weight). The `filled` and `glass` Card variants were removed in v5 — `quiet` replaces `filled` semantically, `glass` can be rebuilt via `unstyled`.

- **Duration tokens** for transitions (`duration-[var(--blocks-duration-fast)]`)
- **Easing tokens** for animations (`var(--blocks-ease-confident)`, `var(--blocks-ease-springy)`)
- **Shadow tokens** for elevation (`shadow-[var(--blocks-shadow-sm)]`)
- **Z-index tokens** for layering (`z-[var(--z-modal)]`, `z-[var(--z-popover)]`)
- **`unstyled` + `slotClasses` + `preset`** props on every component for full style override control
- **`focus-visible:`** exclusively (not `focus:`) for keyboard-only focus rings

### Form field wiring — `useFormField()`

Every form primitive (Input, Textarea, Select, Combobox, Checkbox, Toggle, RadioGroup, Slider) routes its ARIA wiring through a single hook in `packages/blocks/src/lib/utils/use-form-field.svelte.ts`:

```ts
const propsId = $props.id();
const ff = useFormField(() => ({
  fieldId: idProp ?? `prefix-${propsId}`,
  hint: helper,
  error,
  required,
  disabled
}));

// In markup:
<input
  id={ff.fieldId}
  aria-invalid={ff.invalid ? 'true' : undefined}
  aria-describedby={ff.describedBy}
/>
{#if ff.errorId}<div id={ff.errorId} role="alert">{error}</div>
{:else if ff.hintId}<div id={ff.hintId}>{helper}</div>
{/if}
```

The hook derives `errorId`, `hintId`, `describedBy` (error-first), `invalid`, plus pass-through `required` / `disabled`. Hint and error are mutually exclusive — when an error is set the hint is suppressed (Material / Carbon / Polaris convention). `fieldId` is supplied by the caller because Svelte's `$props.id()` rune is only valid at component top-level; routing it through the hook input keeps the hook itself runable from tests and non-Svelte contexts.

Pure logic lives in `computeFormFieldAria()` and is unit-tested directly. The reactive wrapper is one line of `$derived` glue. The standalone `<FormField>` component uses the same hook internally — its public API is unchanged.

### `tv()` engine — explicit trade-offs

The zero-dependency replacement is intentionally narrower than `tailwind-variants`:

- **Built-in conflict resolver** (since v0.31.0 XC-3; per-source fold + dominance since v6.19.x XC-10). The pipeline is an ordered list of sources — `slot-base → each variant axis in declaration order → each matching compoundVariant in array order → call-site class` — folded sequentially: every later source **strips** conflicting Tailwind utilities from everything accumulated before it. `slotClasses={{ box: 'rounded-full' }}` deterministically defeats a base `rounded-sm`; an active-state compound's `bg-neutral` defeats an outlined-variant's `bg-transparent`; and two axes or two compounds that touch the same bucket resolve deterministically too — **axis and compound order are semantic**: declare the axis that must win a shared bucket later (e.g. `variant.underline`'s `rounded-none` after the `tier` radius axis). Within a single source (one class string), ordering is preserved and same-bucket pairs fall through to the CSS cascade, so intentional pairings like `rounded-md rounded-t-none` stay intact. The resolver works on **bucket equality**: two classes conflict only if they normalize to the same key (`bg-color`, `border-t-width`, `text-size`, `opacity`, …). Modifier prefixes (`hover:`, `focus-visible:`, `md:`, `dark:`, `!`-important, negative-sign) are part of the bucket key, so they isolate naturally — `hover:bg-red` and `bg-blue` coexist. The modifier/base split is bracket-aware (colons inside `[]`/`()` don't split), and **arbitrary properties** bucket per CSS property name: `[gap:inherit]` shares the `gap` utility bucket (alias table), `[--spinner-speed:1s]` conflicts only with the same custom property. Unknown classes (e.g. component-internal hooks like `blocks-menu--open`) return no bucket and never participate in stripping. Catalogued utility families live in `BUCKET_PATTERNS` in `packages/blocks/src/lib/utils/variants.ts`; uncatalogued utilities pass through untouched. Add new buckets when audits surface real conflicts, not preemptively.
- **Directional shorthand dominance** (subset of `twMerge`'s conflict map). A later shorthand strips the longhands it fully covers — `p-0` defeats an earlier `px-4`/`pl-10`, `rounded-none` defeats `rounded-t-*`, `inset-0` defeats `top-*`, `size-8` defeats `w-*`/`h-*`, `gap` defeats `gap-x/y`, border width/color their per-side forms, `translate`/`scale` their axes. The reverse never strips: a later `pl-2` refines an earlier `p-4` (Tailwind's cascade resolves the left side), matching what override authors mean in both directions. Deliberately absent: `text-size` → `line-height` — the library pairs slot-base `leading-*` with axis-supplied text sizes across sources by design, and `leading-*` wins Tailwind's own cascade (a pinned negative test documents this).
- **Type-safe, fail-loud configs** (since the v7 API tightening). Slot-map keys in variant values and compound classes are compile-checked against the declared slots (`ValidSlotVariants` — a `wrapeer` typo is a type error at that key), and every config is validated once at module init: unknown slot keys, unknown compound axes/values, undeclared `defaultVariants` values, a no-slot slot-map and `base`+`slots` together all **throw** with precise messages instead of degrading silently. Half-declared boolean axes (`loading: { true: … }` matched with `loading: false`) stay idiomatic. `className` is gone (Svelte has one class prop); slot-mode resolve calls take no top-level `class` (overrides belong to the slot functions). Call-site `class` inputs and `cx()` accept Svelte 5's full `ClassValue` shape including `{ class: condition }` records; config-side an object is always a slot map. Every resolver exposes its config as `.config` — `bun run variants:lint` replays all configs through the engine over the pairwise variant matrix and fails on dead tokens (classes a reachable source contributes that never survive the fold).

**Coverage caveats for the conflict resolver:**

- Classes outside `BUCKET_PATTERNS` (component-internal hooks like `blocks-menu--open`, ad-hoc data-attribute selectors, project-specific utilities) return no bucket and **never participate in stripping** — they always pass through.
- `decoration-*` is split across three orthogonal buckets (`text-decoration-style`, `text-decoration-thickness`, `text-decoration-color`). Overriding the color does not strip thickness or style — that mirrors how the underlying CSS properties relate. The same property-orthogonality drives the `text-overflow` vs `text-wrap` split, `divide-*` width/style/color, `border-collapse`/`border-spacing` (table properties, not colors), `bg-image`/`bg-size`/`bg-position` vs `bg-color` (a gradient overlay never strips the color underneath), and `transition-behavior` vs `transition-property`.
- Longhand-after-shorthand pairs (`p-4` default, `pl-2` override) both survive; the cascade settles the shared side by Tailwind's own source order. Only the shorthand-after-longhand direction strips (see dominance above).
- Compounds strip earlier compounds and all variant axes; axes strip earlier axes and the base. Order both intentionally — later definitions win in the fold, no longer via stylesheet luck.

If a future change needs full `twMerge` semantics or slot typing, extend `variants.ts` rather than re-introducing `tailwind-variants`.

## Preset System (since v0.8.0)

Project-defined, named style presets registered through `BlocksProvider`, plus prop-conditional `overrides`. The full override hierarchy, conflict-resolved per Tailwind bucket so a later source wins:

```
defaults.slotClasses → defaults.overrides[match] → preset.slotClasses → preset.overrides[match] → instance.slotClasses → instance.class
```

`slotClasses` (unconditional) and `presets` (opt-in, named) are registered via `BlocksProvider`; a preset is consumed via the `preset` prop on any component:

```svelte
<BlocksProvider
  presets={{
    Button: {
      overlay: {
        slotClasses: { base: 'bg-black/20 hover:bg-black/30 text-white' }
      }
    }
  }}
>
  <Button preset="overlay">Weiter</Button>
</BlocksProvider>
```

### Conditional `overrides` (since v6.2.0)

Unconditional `slotClasses` apply to every instance regardless of variant. For a rule that must target a specific variant/intent/state — e.g. "give the `outlined` Badge a 1 px border instead of 2 px" — add `overrides` to `defaults.<Component>` or `presets.<Component>.<name>`. Each entry is a `compoundVariant`-shaped matcher (prop conditions → per-slot classes); on a match its classes join the cascade, where the tv() conflict resolver then strips the library's conflicting class (`border-2`):

```svelte
<BlocksProvider defaults={{ Badge: { overrides: [{ variant: 'outlined', class: { base: 'border' } }] } }}>
  <!-- every outlined Badge gets a 1px border; filled / soft / dot untouched -->
</BlocksProvider>
```

Entries match active **prop values** (via `matchesCompound`), not the library's internal variant/compound structure — so it is irrelevant whether `border-2` lives in a `variant` or a `compoundVariant`. `string` conditions match by equality, `string[]` as "one of"; multiple matching entries merge additively. Unconditional-vs-conditional conflicts in the same bucket resolve deterministically (later source wins) via `resolveClassChain` — not left to stylesheet order.

Key files: `packages/blocks/src/lib/provider/BlocksProvider.svelte`, `blocks-context.ts` (`resolveSlotClasses`, `resolveOverrideSlotClasses`, `resolvePresetSlotClasses`), `utils/variants.ts` (`matchesCompound`, `resolveClassChain`). Dev-only `console.warn()` on unregistered preset names. The preset system reaches all primitives and components (rolled out v0.8.0); as of v6.3.0 every component family resolves its slot classes through the shared `resolveSlotClasses(config, name, preset, activeProps, instanceSlotClasses)` helper — each feeding its active `variantProps` as the match input — so `overrides` applies library-wide, not just to Badge.

## Mint System (Micro-Interactions)

The Mint system (`packages/blocks/src/lib/mint/`) provides opt-in micro-interactions.

- **Effects**: `scale`, `translate`, `rotate`, `glow`, `bounce`, `pulse`, `shake`, `ripple` (composable via array; `composite` bundles several)
- **Opt-in**: Call `registerDefaultMints()` explicitly at app startup
- **Accessibility**: Automatically respects `prefers-reduced-motion`
- **Usage**: `<Button mint="scale">` or `<Card mint={['scale', 'ripple']}>`

Key files: `compose.ts` (effect composition), `presets.ts` (default effects), `ripple.ts` (ripple effect), `micro-interactions.ts` (CSS-based effects).

### Mint stylesheet + intent-aware tokens (XC-12)

Mint effects share a single stylesheet (`packages/blocks/src/lib/mint/styles.css`, imported once by `style/index.css`). Components that use a mint apply the `blocks-mint-*` class on the affected element — they never inline the keyframes themselves. This keeps mint specificity uniform across the library: a single `.blocks-mint-scale` rule wins in source order, and consumer overrides don't need to fight per-component duplicates.

The `glow` effect reads its color from `--blocks-mint-glow-color`. The token is set by **intent hooks** on the root element:

| Hook class                 | Resolves `--blocks-mint-glow-color` to               |
| -------------------------- | ---------------------------------------------------- |
| `.blocks-intent-primary`   | `color-mix(var(--color-primary) 50%, transparent)`   |
| `.blocks-intent-secondary` | `color-mix(var(--color-secondary) 50%, transparent)` |
| `.blocks-intent-success`   | `color-mix(var(--color-success) 50%, transparent)`   |
| `.blocks-intent-warning`   | `color-mix(var(--color-warning) 50%, transparent)`   |
| `.blocks-intent-danger`    | `color-mix(var(--color-danger) 50%, transparent)`    |
| `.blocks-intent-neutral`   | `color-mix(var(--color-neutral) 40%, transparent)`   |
| _no hook_                  | primary (the `:root` default)                        |

Components that propagate `intent` to their root (e.g. Button, Avatar, Badge) attach the matching `.blocks-intent-{name}` class — the glow then picks up the correct color via the cascade with no per-component `box-shadow` definitions. **Do not** redefine `--blocks-mint-glow-color` in component-local variants; that re-introduces the pre-XC-12 duplication (Button/Avatar/Badge each owning a private definition) that the central tokens replaced.

## Overlay motion tokens (XC-11)

The **modal / panel overlays** (Dialog, Drawer, ConfirmDialog, Toast) share a single Svelte-transition-driven motion contract. The tokens live in `packages/blocks/src/lib/style/interaction.css` and are mirrored as JS constants in `packages/blocks/src/lib/utils/overlay-tokens.ts`:

| CSS custom property                        | Default                                     | Purpose                                 |
| ------------------------------------------ | ------------------------------------------- | --------------------------------------- |
| `--blocks-overlay-enter-duration`          | `200ms`                                     | Panel enter                             |
| `--blocks-overlay-exit-duration`           | `180ms`                                     | Panel exit                              |
| `--blocks-overlay-backdrop-enter-duration` | `200ms`                                     | Backdrop fade-in                        |
| `--blocks-overlay-backdrop-exit-duration`  | `180ms`                                     | Backdrop fade-out                       |
| `--blocks-overlay-easing`                  | `cubic-bezier(0.83, 0, 0.17, 1)` (quintOut) | Shared easing                           |
| `--blocks-overlay-panel-scale-start`       | `0.96`                                      | Scale-in start value (1 disables scale) |
| `--blocks-overlay-panel-fly-distance`      | `320px`                                     | Fly-in distance along placement axis    |
| `--blocks-overlay-backdrop-blur`           | `4px`                                       | Backdrop `backdrop-filter`              |

`prefers-reduced-motion: reduce` collapses every duration to `1ms`, scale to `1`, and fly-distance to `0px` in a single media-query block — components never check the media query themselves.

Svelte transitions need numeric inputs at the call site, so components call `getOverlayMotion(override?)` from `utils/overlay-tokens.ts` instead of hard-coding numbers. The reader resolves the live CSS values via `getComputedStyle`, parses ms/s/px, and falls back to the JS defaults on the server. The optional `override` argument carries the component's per-instance `transitionDuration` / `transitionEasing` props through — Dialog and Drawer expose this surface today; other overlays can opt in by accepting the same props and forwarding them.

The **anchored, native-popover surfaces** deliberately do NOT run Svelte transitions — their show/hide is owned by `showPopover()`/`hidePopover()` (and native light dismiss, which no JS transition can animate). They run **CSS-native motion** on their own faster token pairs, both defaulting through `--blocks-duration-fast` so reduced motion collapses them for free:

- **Tooltip** — `--blocks-tooltip-duration` / `--blocks-tooltip-easing`, opacity fade.
- **Popover (and Menu / DatePicker through it)** — `--blocks-popover-duration` / `--blocks-popover-easing`, fade + scale. Mechanism: `@starting-style` supplies the enter before-state, `transition-behavior: allow-discrete` on `display`/`overlay` keeps the exit painted through the native hide, and the component lags its children-teardown to the computed transition duration (`maxTransitionDurationMs`). The panel stamps `data-state="open" | "closed"` as the styling hook; `popoverMotion` (popover.variants.ts) is the reference fragment — Menu re-applies it verbatim on its unstyled inner Popover.

**Don't** hard-code 200/250ms or panel-scale numbers in new overlay components. Use the tokens (or `getOverlayMotion()` when you need numbers in JS). Adding a new modal overlay means picking up the `--blocks-overlay-*` tokens; a new anchored native-popover surface follows the Popover mechanism instead — in both cases, don't mint parallel tokens.

## i18n System

Runes-based internationalization in `packages/i18n/`, re-exported through `packages/blocks/`.

- **SSR-correct**: The active locale lives in a request-scoped **context** (`<I18nProvider>` / `provideI18n`), not a module-global singleton — concurrent SSR requests with different locales don't leak. Static translation data stays module-global (request-identical).
- **Package-based**: Each package (blocks, table, auth) registers its own namespaced keys via `createPackageI18n` and exports a `use<Package>I18n()` hook.
- **Read-tolerant, write-strict**: Reading without a provider resolves the base locale (`en`, SSR-safe); `setLocale` without a provider throws.
- **Type-safe**: Literal key + param inference through the generic factory (key autocomplete, typos are compile errors).
- **Reactive**: Svelte 5 runes (`$state`, `$derived`); in-place locale switch, no reload.
- **Components**: `<T key="..." />` for inline translations, `<LocaleSwitcher />` for language switching.
- **Opt-in code-splitting**: register non-base locales as dynamic-import loaders (`createPackageI18n(name, { en }, { loaders })`).
- **Authored as TS `as const`** (not JSON): literal key/param types flow straight into the generic factory's inference — no codegen step.
- **Plurals via `Intl.PluralRules`** (per-locale CLDR categories, cached), not a bundled ICU runtime.
- **Translation audit**: data-level `auditTranslations` (missing/unused-key report; `onMissingKey` / `createMissingKeyCollector`) plus a dev-only `@urbicon-ui/i18n/audit` source scanner (unused / used-but-undefined keys, hardcoded strings), fronted by the `urbicon i18n` CLI command and `bun run i18n:check`.

The deliberate trade-off behind these: a **runtime registry** (not a Paraglide-style compiler) keeps translations reactive and SSR-context-scoped at the cost of full tree-shaking — acceptable for a component library where locale data is small.

Supported locales: `en`, `de` (data); `fr`/`es`/`it`/`nl` declared. Server-side initial-locale resolution via `resolveLocale(request)`. Full reference: [`packages/i18n/README.md`](../packages/i18n/README.md) · design rationale: [archive/2026-06/I18N-ARCHITECTURE-ROADMAP.md](archive/2026-06/I18N-ARCHITECTURE-ROADMAP.md).

## Documentation Generation (docs-gen)

AST-based pipeline that extracts component metadata and generates documentation. See the [docs-gen README](../packages/docs-gen/README.md) for CLI usage, configuration, and module details.

Pipeline: **Discovery -> Extraction -> Enrichment -> Generation**

1. **Discovery**: Scans configured packages for component files (`.svelte`, `.ts`)
2. **Extraction**: Parses TypeScript AST for props/JSDoc, the in-house `tv()` variant definitions for variant options, interface inheritance chains
3. **Enrichment**: Merges extracted data, generates cross-references (`seeAlso` links) and statistics
4. **Generation**: Writes per-component `api.ts` first (API-first architecture), then Svelte pages and LLM Markdown in parallel

**Program-backed extraction (2026-07):** every `ConfigurationFactory` preset carries `input.typescript.configPath` (the package tsconfig); a shared `ts.Program` per package (`ProgramCache`) resolves imported props bases (`extends Omit<InputProps, …>`), type-only imports and their transitive references from the **sources** (never `dist/`, never `node_modules`). A set-but-broken `configPath` aborts the run (fail-loud — run `svelte-kit sync` first in a fresh tree); an unset one is the documented single-file fallback for tests/ad-hoc use. `llm.txt` gains a `### Types` section (helper types; `*Slots`/`*Variants` excluded); types over 40 rendered lines emit a member-count summary with source path instead of their body (`api.ts` and the TypesReference docs surface keep full definitions). `TypeDefinition` knows a `class` kind (public signature only) and `scope: local | imported`.

Components can provide a `docs.svelte` with custom content and a `docsConfig` export for generation settings (hybrid auto + custom approach). See `packages/docs-gen/docs/component-structure-guidelines.md` for conventions.

**Targets & artifacts:** `docs:gen:all` (not a per-package `docs:gen:<target>`) runs the final assembly that rebuilds `llms-full.txt` + `apps/docs/static/mcp/component-catalog.json`; a per-target run only writes that scope's `apps/docs/static/<scope>/*` and `routes/<scope>/.../api.ts`. The generated outputs — `**/api.ts`, `llms-full.txt`, `static/**/_catalog.json`, `static/mcp/` — are **git-ignored** and rebuilt by `bun run build`; only the curated `llms.txt` (+ `apps/docs/static/llms.txt`) index is tracked. MCP serves auth components from the merged main catalog via the `auth` tag (not a `group`).

## AI-Native DX

The library is optimized for LLM-assisted development with several machine-readable artifacts:

| File             | Purpose                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| `/llms.txt`      | Brief library overview following the llms.txt standard                          |
| `/llms-full.txt` | Complete API reference with examples, tokens, and patterns                      |
| `/.cursorrules`  | Cursor IDE rules for correct imports, API grammar, token usage, common mistakes |

The `docs-gen` pipeline generates per-component LLM documentation with import statements, design token context, slot information, and combination patterns.

## Figma Token Export

The utility `generateFigmaTokensJSON()` in `packages/blocks/src/lib/utils/figma-token-export.ts` exports the full design token system as Tokens Studio-compatible JSON. Categories: `color` (6 OKLCH palettes), `semantic` (surface/text/border), `spacing`, `borderRadius`, `shadow`. The export is available both programmatically and via the `/customization/figma-tokens` docs page (download/copy).

## UI Recipes

The docs app ships **20 production-ready UI recipes** under `apps/docs/src/routes/recipes/`. The canonical, always-current list is the navigation map in `apps/docs/src/lib/navigation.ts`; categorically (illustrative):

| Category            | Recipes                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Authentication      | Login, Invitation Register, Passkey Login, Password Reset                                      |
| Layout / Dashboards | Dashboard, Stat Tile, Page Header, Trace Drawer                                                |
| Planning            | Meal Planner (Planner component)                                                               |
| Forms / Wizards     | Settings, Wizard, Decision Tree Wizard, Range Hint Input, Unsaved Changes Guard, Onboarding Flow |
| Marketing           | Pricing                                                                                        |
| Display             | Profile Card, Clickable Card, Help Tooltip                                                     |
| Notifications       | Notification Center                                                                            |
| Trace / Diagnostics | Trace Drawer                                                                    |

Each recipe lives in its own folder with `+page.svelte` (live preview), `meta.ts` (structured metadata), and a `recipeCode` template literal for the side-by-side code view. The recipes are addressable by the MCP `get_recipe` tool.

## Theme Builder

The `/customization/theme-builder` page provides a visual OKLCH-based theme generator with hue, chroma, and lightness sliders, 8 color presets, a matched **neutral chassis** control (hue + tint strength, auto-following the brand hue), live component preview, and CSS `@theme` export. The chassis control re-tints `--color-neutral-*` so generated themes keep surfaces/text/borders in the accent's temperature family instead of a fixed cool grey. It demonstrates the token system's flexibility for brand customization.

## Showcase

The `/showcase` page is a realistic project management interface that demonstrates many components working together (Card, Button, Badge, Avatar, Input, Checkbox, Toggle, Menu, Tooltip, Spinner, Tab, Separator, Alert, Breadcrumb, Skeleton, Pagination, Accordion, and more).

## Auth Package

The `@urbicon-ui/auth` package is a zero-runtime-dependency authentication, user-management, and notification system for SvelteKit. It is part of the vertical Urbicon stack.

**Server side** (`import from '@urbicon-ui/auth/server'`):

- Core crypto via Web Crypto API: JWT (HMAC-SHA256), PBKDF2 password hashing, CSRF, rate-limiting, security headers
- Handler factories for login, logout, register, forgot/reset-password, verify-email, refresh
- `createAuthHandle()` SvelteKit handle hook for session hydration, route guards, transparent refresh-token rotation
- Refresh-token rotation (opt-in, v0.11.0+): 15-min access + 30-day rotating refresh cookies, token families, reuse-detection
- WebAuthn/Passkeys: CBOR decoder, ECDSA P-256 + RSA verification, FIDO2 Level 2, optional UV enforcement
- Web Push: ECDH + HKDF + AES-128-GCM (RFC 8291/8292/8188), VAPID JWT signing, opt-in per-endpoint rate limit
- Adapter pattern for Repositories (`UserRepository`, `PasskeyRepository`, `InvitationRepository`, `RefreshTokenRepository`); Prisma adapter shipped
- Pluggable stores for challenges, rate-limits, and refresh-tokens (in-memory defaults; Redis/Prisma/Upstash via interface)

**Client side** (`import from '@urbicon-ui/auth'`):

- 14 blocks-based UI components (LoginPage, RegisterPage, PasskeyManager, AccountSettings, SessionManager, TwoFactorManager, NotificationCenter, etc.)
- All components honor `unstyled` + `slotClasses` conventions
- Svelte 5 runes stores: `createAuthStore()`, `createNotificationStore()`
- Service-worker helpers for push handling

**i18n** (`@urbicon-ui/auth/i18n/en` or `/de`): extensible locale bundles.

Full details, exports, consumer-integration walkthrough, and known security limitations: see [AUTH.md](AUTH.md).

## Table Package

The `@urbicon-ui/table` package provides a feature-rich data table with smart filtering, grouping, summaries, search highlighting, column visibility, persistence, and responsive desktop/mobile views.

### Data Pipeline

All data processing runs as a reactive `$derived` chain in `TableStore.svelte.ts`:

```
items → filteredItems → sortedItems → grouped → paginatedItems
```

Each stage is a `$derived` computation that depends on the previous stage and relevant state (search term, active filters, sort column, group key, current page).

### Remote Data Architecture (planned)

The current `apiRoute` prop fetches all data client-side and processes it locally. For large datasets, the table needs to support server-side filtering, sorting, and pagination.

**Recommended approach: `onQueryChange` callback + `totalItems` prop**

| Prop            | Type                          | Purpose                                                                      |
| --------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `mode`          | `'client' \| 'server'`        | Controls whether the table processes data locally or delegates to the server |
| `totalItems`    | `number`                      | Server-side total count for pagination calculation in server mode            |
| `onQueryChange` | `(query: TableQuery) => void` | Fires on every sort/filter/page/search change with the full query state      |

The `TableQuery` object contains `{ page, itemsPerPage, sortColumn, sortDirection, searchTerm, activeFilters, groupByKey }`. In server mode, the derived chain (`filteredItems`, `sortedItems`, `paginatedItems`) passes `state.items` through unchanged; `totalPages` is computed from `totalItems` instead of the local array length.

This pattern is minimal (3 new props), follows the Svelte 5 callback convention, and stays agnostic to the data source (REST, GraphQL, SvelteKit `load`).

## Date & Planning Infrastructure

Calendar and `Planner<T>` share a headless date-grid core. `packages/blocks/src/lib/internal/date-grid/` holds the `DateGridController` + context + keyboard model + `DateGridScaffold` — deliberately **not** exported from the package: two in-repo consumers (Calendar + Planner) don't yet justify the API-stability cost, and a re-export is a one-line `package.json` change if a consumer later needs the bare core. Pure date math lives in `packages/blocks/src/lib/date/` (`geometry`, `range`, `compare`, `format`) and **is** public via the `./date` subpath export.

`Planner<T>` (`packages/blocks/src/lib/components/Planner/`) is the generic planning-board component built on that core — event type is caller-supplied (`T`, not a fixed `CalendarEvent`), view-parametrised. See the `planning-board` design pattern and the `meal-planner` recipe. Calendar keeps its own month-view rendering by design rather than routing every view through the scaffold — the scaffold owns the time-grid mechanics, not month-grid layout.

## Conscious Trade-offs

Deliberate decisions documented here so they are not repeatedly questioned or accidentally "corrected". The `tv()` engine trade-offs (no `twMerge`, no slot-name type safety) are covered above under [Component Styling](#component-styling).

### Biome is not type-aware

Linting uses **Biome**, which does not consult the TypeScript type checker. Rules that need type information (e.g. no-floating-promises, await-thenable) therefore do not apply. This is a deliberate performance decision — Biome lints the whole repo in milliseconds, where type-aware linting would make every `lint` run and the pre-commit hook several times slower. Floating promises and similar issues are instead caught in review and by TypeScript itself (`strict` mode, `noImplicitAny`, `strictNullChecks`).

### Pre-commit without `bun run check` and without tests

The lefthook pre-commit hook only runs `biome check --write` (on staged `.ts`/`.js`/`.json`) and `prettier --write` (on staged `.svelte`) — **no** `svelte-check`, **no** `vitest`. `svelte-check` across all packages takes 30–60 s and would noticeably block commits; tests are CI's job. The consequence: `svelte-check` errors only surface in CI — an acceptable trade-off, because CI failures reproduce locally in seconds.

### `mcp-server` without a build step (`main: "./src/index.ts"`)

`packages/mcp-server` ships TypeScript sources directly, without a `dist/` build. This works because the MCP server is always started via Bun (a dev tool, not an npm-consumed runtime). The `README` makes this explicit — anyone expecting Node would otherwise trip over the `.ts` entrypoint. The upside: no build pipeline and no extra sync step for a purely dev-time tool.

### Stricter TS flags not in `tsconfig.base.json`

The root `tsconfig.base.json` holds the shared compiler baseline (`target`, `module`, `lib`, `strict`, `esModuleInterop`). Stronger flags like `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `exactOptionalPropertyTypes` are active **only** in the `tsc`-built packages (`docs-gen`, `mcp-server`, `shared-types`) and deliberately not raised centrally — the migration effort for the SvelteKit packages is not yet justified.

## Versioning & Changelog

The monorepo uses synchronized versioning: all packages share the root version (in `package.json`). The `bun run bump` script patches all packages simultaneously, creates a git tag, and regenerates the changelog.

Changelog generation uses [git-cliff](https://git-cliff.org/) configured in `cliff.toml`. It parses conventional commits, groups changes by type (Features, Bug Fixes, etc.), and includes the package scope. Version bump commits (`chore: version bump`) are excluded automatically.

The docs site displays:

- **Current version** in the sidebar footer (injected via Vite `define` at build time from root `package.json`)
- **Full changelog** at `/changelog` (loaded from `CHANGELOG.md` via a Vite virtual module `virtual:changelog`)

## Documentation Site

For the complete documentation page guide (file structure, section order, design philosophy, typography, playground controls, checklists), see [DocsPageGuide.md](DocsPageGuide.md).

## Color Rooms Theme (docs-only)

The Urbicon documentation site at `apps/docs/` opts into the **Color Rooms theme** — Schibsted Grotesk on a warm cream-paper palette whose accent is the **room (section) you are in**: `/blocks` green, `/table` wine, `/auth` amber, `/ai` orange (everything else falls back to the blocks green). Component-page and section-landing headers become a full-width colour field in the room colour, flush to the app sidebar. On a component page the header is a full-width band spanning everything right of the app sidebar — breadcrumb + `source` sit in the band and the on-this-page TOC drops below it; on scroll the title collapses under the pinned breadcrumb strip, leaving a low ribbon in the room colour. Library consumers (consumer apps and third-party apps) keep the library defaults; Color Rooms is private to the docs site. (It replaced the earlier fixed-green "Editorial" theme.)

Color Rooms is implemented as a **pure token-override layer** rather than a parallel component tree. Activation:

```html
<html lang="en" class="docs-rooms"></html>
```

The class sits on `<html>` (not `<body>`) so the `app.html` head script can flip it before first paint; the per-route room is then stamped as `data-room="…"` on a `.docs-room-scope` wrapper in `+layout.svelte` (and mirrored onto `<html>` after mount for portaled popovers) — the route → room colour mapping itself lives in `rooms-docs.css`. Everything below applies only within that scope. Library defaults stay intact outside it.

### Private tokens (`--docs-*`, `--room-*`)

`apps/docs/src/lib/style/rooms-docs.css` defines a private token namespace for docs-specific concerns that don't belong in the library:

| Token | Purpose |
| ----- | ------- |
| `--room-accent`, `--room-accent-fg` | Active room colour + its on-accent ink/cream. Selected per-route via `data-room` (stamped by `+layout.svelte`; the colour values live only in `rooms-docs.css`); source of the whole primary family and the header field. |
| `--docs-bg`, `--docs-paper` | Page ground (cream) and content surface (lighter cream). Inverts to warm dark in dark mode. |
| `--docs-lifted`, `--docs-floating` | L·2 (dropdowns, popovers, selects) and L·3 (modals, sheets, command menus) — continuation of the cream ladder above paper. |
| `--docs-ink`, `--docs-soft`, `--docs-softer` | Three-stop ink hierarchy (primary text `#17150f`, meta/body-soft, decoration). |
| `--docs-hair`, `--docs-line` | Hairline (8 % alpha) and line (14 % alpha) — ink-on-paper in light, cream-on-paper in dark. |
| `--docs-accent` | Docs accent (active markers, links, sidebar logo mark). Couples to `--color-primary` so the room colour re-uses it. |
| `--docs-radius-pill`, `--docs-radius-card`, `--docs-shadow-page` | Docs geometry — TOC crumbs, Bento cards (`--radius-contain`, tight for the hard-edge poster), Recipe-stage lift. |
| `--font-display`, `--font-sans` | Schibsted Grotesk — one grotesk for display + body. |
| `--font-mono` | JetBrains Mono for meta (`01` section marker, mono kickers, prop labels). |

All `--docs-*` tokens use `light-dark()` so the canvas is **first-class light + dark** — the cream-paper / warm-ink shape inverts to warm-dark-paper / cream-ink without losing identity. The room accent is orthogonal to the mode (it repaints primary, not the paper).

### Library-token overrides

Inside `.docs-rooms`, the scope re-binds the most consumed library tokens to the cream palette + the room accent:

- Primary: `--color-primary` → `var(--room-accent)`, `--color-text-on-primary` → `var(--room-accent-fg)` (see the room derivation below).
- Surface ladder: `--color-surface-base/-quiet/-elevated/-overlay` → `--docs-paper/-bg/-lifted/-floating`.
- Borders: `--color-border-hairline` → `--docs-hair`. The architectural borders (`-subtle/-default/-emphasis/-strong`) get routed through the library's existing `--color-warm-neutral-*` ramp (Hue 45) so they shed the cool-grey bias against cream.
- Text: `--color-text-primary/-secondary/-tertiary/-quaternary` → ink hierarchy.
- Surface mid-states (`-hover/-active/-disabled/-interactive/-subtle/-inverted`) and `--color-text-disabled` / `--color-interactive-disabled` also route through `warm-neutral`.
- `--blocks-shadow-tint` shifts to `oklch(0.22 0.04 70)` so shadows blend with cream instead of reading as cool smudges.

### Room accent + intent retuning

Instead of a single fixed primary, Color Rooms **re-derives the entire 11-step `--color-primary-*` ramp from `--room-accent`** via `color-mix(in oklab, …)` — the raw accent is stop 500, lighter stops mix toward cream, darker stops toward ink. The four rooms:

| Room             | Accent          | Foreground     |
| ---------------- | --------------- | -------------- |
| Blocks (default) | `#00845c` green | cream `#f6f3ec` |
| Table            | `#7c1f2d` wine  | cream `#f6f3ec` |
| Auth             | `#e3a31c` amber | ink `#17150f`  |
| AI & DX          | `#e8500f` orange | ink `#17150f`  |

The **intent palette is room-independent** — retuned once (warm) so Success / Warning / Danger / Secondary sit naturally on cream and stay distinct from the room primary. The warm spectrum harmonises with all four warm room accents, so it is not re-tuned per room:

| Intent    | Hue                        | Why                                                                                                                                                    |
| --------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Secondary | 15 (burgundy/mahogany)     | Warm complementary; the library default Hue 280 (violet) reads cool on cream.                                                                          |
| Success   | 150, darker / lower chroma | Library Hue 140 ≈ a green room — would read as a second room button. Sage reads as "completed/verified".                                               |
| Warning   | 55 (amber)                 | Library Hue 80 is yellow-green-adjacent; amber harmonises with cream.                                                                                   |
| Danger    | 22 (maroon)                | Library Hue 25 vivid red sits aggressively on cream; maroon at Hue 22 keeps the alert reading. Hues 12 and 18 rolled into magenta on the dark 400 stop. |
| Info      | 220 (teal)                 | **Unchanged.** Cool blue against the warm palette is a deliberate contrast — info banners read as informational chrome.                                 |

### Why semantic tokens are re-declared in the docs scope

A subtle CSS detail: when a custom property is defined as `--color-primary: light-dark(var(--color-primary-600), var(--color-primary-500))` at `:root`, the `var()` resolves **at the cascade level where the property is defined**. Overriding the ramp later in `.docs-rooms` does _not_ re-trigger that substitution — the inherited value is the already-resolved library string.

Color Rooms therefore re-declares all derived semantic tokens (`--color-primary`, `-hover`, `-active`, `-subtle`, `-emphasis`, `--color-surface-selected`, `--color-interactive-hover/-active/-focus`) inside the scope, one-to-one mirroring the library shapes in `semantic.css`. The re-declarations look redundant but they're load-bearing: without them the room ramp stops at the raw stops and the consuming components still pick up the library blue. Because portaled popovers mount **outside** the `.docs-room-scope` wrapper, the derivation is declared on both the wrapper (content — SSR-correct, no flash) and `.docs-rooms` on `<html>` (portals — mirrored after mount).

### Docs hooks on shared components

Components in `packages/docs` carry small `data-docs-*` hooks that the docs scope styles — keeps the library API unchanged for non-docs consumers while giving the Color Rooms CSS a stable anchor. The `data-docs-*` namespace is the docs package's **published theming contract**: skins target these attributes (never internal class names or test ids), and renames are breaking changes for skins:

- `[data-docs-header]` on the `DocsLayout` hero header — becomes the room colour field (both the collapsing-hero and legacy headers). It is a **full-width band**: a direct child of the layout container (not the body column), so it spans everything right of the app sidebar and the on-this-page TOC drops below it. Alignment with the body column is re-imposed by an inner wrapper that shares `main`'s `maxWidth`.
- `[data-docs-sticky-bar]` on the sticky breadcrumb strip — shares the header's accent fill; on scroll the title collapses under it, leaving a low breadcrumb-height ribbon. Inside it, `[data-docs-sticky-hairline]` is hidden (colour edge is the separator) and `[data-docs-scrollspy]` (the active-section badge) flips to a translucent-foreground inlay.
- `[data-room-hero]` on hand-rolled section-landing heroes (`/blocks`, `/ai`, `/getting-started`, `/recipes`, `/showcase`) — the same full-width band, flush to the app sidebar: the hero element spans the content area and the page nests an inner `max-w-* mx-auto px-*` wrapper (matching its body column) to align the hero content. `[data-room-chip]` flips a room-tinted chip so it reads on the fill.
- `[data-docs-stage="example|playground"]` / `[data-docs-stage-frame]` on `CodeExample` / `PlaygroundConfigurator`.
- `[data-docs-subtitle]` on the page-title sub-headline rendered by `DocsLayout`.

The scope paints the header field, flattens the stage backgrounds to transparent, and hides the DocsLayout subtitle on component pages (the field is title-first). See [COMPONENT-API-CONVENTIONS.md](COMPONENT-API-CONVENTIONS.md#docs-theme-hooks) for the consumer-facing summary.

### Doc page

The full Color Rooms token catalogue, the room table, activation steps, light/dark modes, and override recipes live at `/customization/rooms-theme` (`apps/docs/src/routes/customization/rooms-theme/+page.svelte`).
