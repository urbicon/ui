# Urbicon UI – Architecture Overview

Technical architecture of the Urbicon UI monorepo. For API conventions see [COMPONENT-API-CONVENTIONS.md](COMPONENT-API-CONVENTIONS.md), for component file structure see [ComponentStructureStandard.md](ComponentStructureStandard.md), for the six-family taxonomy that drives ARIA / tier / border decisions see [COMPONENT-FAMILIES.md](COMPONENT-FAMILIES.md).

> **Strategic context (2026-04):** Urbicon is a vertically integrated zero-dependency platform covering UI primitives, data tables, auth, i18n, docs, and AI-native DX — all packages share unified versioning and zero external runtime dependencies. Current focus is **consolidation for v1.0** ("harden before extend").

## Design Token System

Three-layer CSS custom property architecture in `packages/blocks/src/lib/style/`:

| Layer       | File              | Purpose                                                                                                                                                                                                                             |
| ----------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation  | `foundation.css`  | OKLCH color palette, spacing, radii, z-index scale, breakpoints                                                                                                                                                                     |
| Semantic    | `semantic.css`    | Context-aware tokens (`surface-*`, `text-*`, `border-*`) with automatic dark mode via `prefers-color-scheme`                                                                                                                        |
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

- **Semantic tokens only** – no `dark:` overrides anywhere in primitives (dark mode via `prefers-color-scheme` in `semantic.css`)
- **Surface tier semantics** (XC-13, Lighter v5). Four tints sit on top of `surface-base` (= the page background). Every container-shaped primitive should pick the tier whose semantics match its purpose:

  | Token              | Purpose                                                                                                                                                                                                                     | Lift relative to base                       |
  | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
  | `surface-base`     | Page background                                                                                                                                                                                                             | —                                           |
  | `surface-quiet`    | Softly tinted in-page zones that signal "own zone" without border or shadow (Card `quiet`, Toolbar `quiet`, Accordion items, Table `striped` row alternation). The Lighter default.                                         | ~1 % darker in light, ~3 % lighter in dark  |
  | `surface-subtle`   | Visible tinted zones for grouped content (Stepper indicators, Table `surface` appearance, Auth list items with a border).                                                                                                   | ~2 % darker in light, ~5 % lighter in dark  |
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

- **Built-in mini conflict resolver** (since v0.31.0, XC-3). Pipeline order is `slot-base → variant slot-maps → compoundVariants → call-site class`. Each later stage **strips** conflicting Tailwind utilities from earlier stages — so `slotClasses={{ box: 'rounded-full' }}` deterministically defeats a base `rounded-sm`, and an active-state compound's `bg-neutral` deterministically defeats an outlined-variant's `bg-transparent`. The resolver works on **bucket equality**: two classes conflict only if they normalize to the same key (`bg-color`, `border-t-width`, `text-size`, `opacity`, …). Modifier prefixes (`hover:`, `focus-visible:`, `md:`, `dark:`, `!`-important, negative-sign) are part of the bucket key, so they isolate naturally — `hover:bg-red` and `bg-blue` coexist. Unknown classes (e.g. component-internal hooks like `blocks-menu--open`) return no bucket and never participate in stripping. Within a single stage, ordering is preserved and conflicts fall through to the CSS cascade (e.g. two matching `compoundVariants` with overlapping classes). Catalogued utility families live in `BUCKET_PATTERNS` in `packages/blocks/src/lib/utils/variants.ts`; uncatalogued utilities pass through untouched. Add new buckets when audits surface real conflicts, not preemptively.
- **No `twMerge`-equivalent shorthand expansion.** `p-4` and `px-2` get separate buckets (matching Tailwind's own cascade behaviour: `p-` sets all four sides, `px-` only horizontal — both survive, and the browser settles horizontal padding via source order). The resolver does **not** model Tailwind's full shorthand semantics; it gives deterministic same-bucket resolution and leaves shorthand interactions to CSS.
- **No slot-name type-safety.** `variants.size.md = { wrapper: '…', icon: '…' }` is typed as `Record<string, Record<string, unknown>>` — a typo like `wrapeer` is silently ignored. Slot keys are validated through tests (`*.variants.test.ts`) and code review, not the compiler. Same for `class` overrides on slot functions: an unknown slot key is a no-op rather than an error.

**Coverage caveats for the conflict resolver:**

- Classes outside `BUCKET_PATTERNS` (component-internal hooks like `blocks-menu--open`, ad-hoc data-attribute selectors, project-specific utilities) return no bucket and **never participate in stripping** — they always pass through.
- `decoration-*` is split across three orthogonal buckets (`text-decoration-style`, `text-decoration-thickness`, `text-decoration-color`). Overriding the color does not strip thickness or style — that mirrors how the underlying CSS properties relate.
- Padding/margin shorthand (`p-` vs `px-` vs `pt-`) and Border-shorthand (`border` vs `border-t` vs `border-x`) use **separate** buckets. A `p-4` default and a `px-2` override both survive; the cascade then settles horizontal-vs-vertical padding by Tailwind's own source-order logic. This is intentional — emulating `twMerge`'s shorthand expansion is a non-goal.
- Within a single pipeline stage (e.g. two matching `compoundVariants` with overlapping classes) no stripping happens — ordering is preserved and CSS source-order decides. Order your compounds intentionally; later definitions win in the cascade.

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

Key files: `packages/blocks/src/lib/provider/BlocksProvider.svelte`, `blocks-context.ts` (`resolveSlotClasses`, `resolveOverrideSlotClasses`, `resolvePresetSlotClasses`, `mergeSlotClasses`), `utils/variants.ts` (`matchesCompound`, `resolveClassChain`). Dev-only `console.warn()` on unregistered preset names. The preset system has been rolled out to all primitives and components as of v0.8.0; the `overrides` path is wired into `Badge` first and reaches further components via the shared `resolveSlotClasses` helper (swap a component's `mergeSlotClasses(...)` call for `resolveSlotClasses(config, name, preset, activeProps, instanceSlotClasses)`).

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

All overlay primitives (Dialog, Drawer, Popover, Tooltip, ConfirmDialog, Toast) share a single motion contract. The tokens live in `packages/blocks/src/lib/style/interaction.css` and are mirrored as JS constants in `packages/blocks/src/lib/utils/overlay-tokens.ts`:

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

**Don't** hard-code 200/250ms or panel-scale numbers in new overlay components. Use the tokens (or `getOverlayMotion()` when you need numbers in JS). Adding a new overlay primitive means picking up these tokens, not minting parallel ones.

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

The deliberate trade-off behind these: a **runtime registry** (not a Paraglide-style compiler) keeps translations reactive and SSR-context-scoped at the cost of full tree-shaking — acceptable for a component library where locale data is small.

Supported locales: `en`, `de` (data); `fr`/`es`/`it`/`nl` declared. Server-side initial-locale resolution via `resolveLocale(request)`. Full reference: [`packages/i18n/README.md`](../packages/i18n/README.md) · design rationale: [archive/2026-06/I18N-ARCHITECTURE-ROADMAP.md](archive/2026-06/I18N-ARCHITECTURE-ROADMAP.md).

## Documentation Generation (docs-gen)

AST-based pipeline that extracts component metadata and generates documentation. See the [docs-gen README](../packages/docs-gen/README.md) for CLI usage, configuration, and module details.

Pipeline: **Discovery -> Extraction -> Enrichment -> Generation**

1. **Discovery**: Scans configured packages for component files (`.svelte`, `.ts`)
2. **Extraction**: Parses TypeScript AST for props/JSDoc, the in-house `tv()` variant definitions for variant options, interface inheritance chains
3. **Enrichment**: Merges extracted data, generates cross-references (`seeAlso` links) and statistics
4. **Generation**: Writes per-component `api.ts` first (API-first architecture), then Svelte pages and LLM Markdown in parallel

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

The utility `generateFigmaTokensJSON()` in `packages/blocks/src/lib/utils/figma-token-export.ts` exports the full design token system as Tokens Studio-compatible JSON. Categories: `color` (6 OKLCH palettes), `semantic` (surface/text/border), `spacing`, `borderRadius`, `shadow`. The export is available both programmatically and via the `/figma-tokens` docs page (download/copy).

## UI Recipes

The docs app ships **19 production-ready UI recipes** under `apps/docs/src/routes/recipes/`. The canonical, always-current list is the navigation map in `apps/docs/src/lib/navigation.ts`; categorically (illustrative):

| Category            | Recipes                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Authentication      | Login, Invitation Register, Passkey Login, Password Reset                                      |
| Layout / Dashboards | Dashboard, Stat Tile, Page Header, Trace Drawer                                                |
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

## Editorial Theme (docs-only)

The Urbicon documentation site at `apps/docs/` opts into an **Editorial theme** — a warm cream-paper palette with a brand-green accent and a sage / amber / maroon intent ramp. Library consumers (consumer apps and third-party apps) keep the library defaults; the editorial palette is private to the docs site.

The editorial theme is implemented as a **pure token-override layer** rather than a parallel component tree. Activation:

```html
<body class="docs-editorial"></body>
```

Everything below applies only within that scope. Library defaults stay intact outside it.

### Private tokens (`--docs-*`)

`apps/docs/src/lib/style/editorial.css` defines a private token namespace for editorial-specific concerns that don't belong in the library:

| Token                                                            | Purpose                                                                                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `--docs-bg`, `--docs-paper`                                      | Page ground (cream) and content surface (lighter cream). Inverts to warm dark in dark mode.                                |
| `--docs-lifted`, `--docs-floating`                               | L·2 (dropdowns, popovers, selects) and L·3 (modals, sheets, command menus) — continuation of the cream ladder above paper. |
| `--docs-ink`, `--docs-soft`, `--docs-softer`                     | Three-stop ink hierarchy (primary text, meta/body-soft, decoration like the `//` prefix).                                  |
| `--docs-hair`, `--docs-line`                                     | Editorial hairline (8 % alpha) and line (14 % alpha) — black-on-paper in light, cream-on-paper in dark.                    |
| `--docs-accent`                                                  | Editorial accent (pipe cursor, active markers). Couples to `--color-primary` so the brand green re-uses it.                |
| `--docs-radius-pill`, `--docs-radius-card`, `--docs-shadow-page` | Editorial geometry — TOC crumbs, Bento cards, Recipe-stage lift.                                                           |
| `--font-mono`                                                    | JetBrains Mono for editorial meta (`§01`, `// kicker`, prop labels).                                                       |

All `--docs-*` tokens use `light-dark()` so the editorial canvas is **first-class light + dark** — the cream-paper / warm-ink shape inverts to warm-dark-paper / cream-ink without losing identity.

### Library-token overrides

Inside `.docs-editorial`, the editorial scope re-binds the most consumed library tokens to the cream palette:

- Surface ladder: `--color-surface-base/-quiet/-elevated/-overlay` → `--docs-paper/-bg/-lifted/-floating`.
- Borders: `--color-border-hairline` → `--docs-hair`. The architectural borders (`-subtle/-default/-emphasis/-strong`) get routed through the library's existing `--color-warm-neutral-*` ramp (Hue 45) so they shed the cool-grey bias against cream.
- Text: `--color-text-primary/-secondary/-tertiary/-quaternary` → ink hierarchy.
- Surface mid-states (`-hover/-active/-disabled/-interactive/-subtle/-inverted`) and `--color-text-disabled` / `--color-interactive-disabled` also route through `warm-neutral`.
- `--blocks-shadow-tint` shifts to `oklch(0.22 0.04 70)` so shadows blend with cream instead of reading as cool smudges.

### Brand-green primary + intent retuning

Editorial overrides the **entire 11-step `--color-primary-*` ramp** to the Urbicon brand green (#13ba00 ≈ `oklch(0.69 0.205 138)`) and re-tunes the intent palette so it sits naturally on cream and stays distinct from the new primary:

| Intent    | Editorial hue              | Why                                                                                                                                                                                               |
| --------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary   | 138                        | Brand green                                                                                                                                                                                       |
| Secondary | 15 (burgundy/mahogany)     | Library default Hue 280 (violet) is the complementary to blue; against brand green the natural warm complementary is burgundy.                                                                    |
| Success   | 150, darker / lower chroma | Library Hue 140 ≈ brand green — would read as a second brand button. Sage reads as "completed/verified".                                                                                          |
| Warning   | 55 (amber)                 | Library Hue 80 is yellow-green-adjacent and overlaps with the primary register. Amber harmonises with cream.                                                                                      |
| Danger    | 22 (maroon)                | Library Hue 25 vivid red sits aggressively on cream; maroon at Hue 22 keeps the alert reading without clashing. Hues 12 and 18 were both tried and rolled into magenta on the dark-mode 400 stop. |
| Info      | 220 (teal)                 | **Unchanged.** Cool blue against the warm palette is a deliberate contrast — info banners read as informational chrome, not as part of the brand voice.                                           |

### Why semantic tokens are re-declared in the editorial scope

A subtle CSS detail: when a custom property is defined as `--color-primary: light-dark(var(--color-primary-600), var(--color-primary-500))` at `:root`, the `var()` resolves **at the cascade level where the property is defined**. Overriding `--color-primary-600` later in `.docs-editorial` does _not_ re-trigger that substitution — the inherited value is the already-resolved blue string.

Editorial therefore re-declares all derived semantic tokens (`--color-primary`, `-hover`, `-active`, `-subtle`, `-emphasis`, `--color-surface-selected`, `--color-interactive-hover/-active/-focus`) inside the `.docs-editorial` block, one-to-one mirroring the library shapes in `semantic.css`. The re-declarations look redundant but they're load-bearing: without them the green ramp stops at the raw stops and the consuming components still pick up blue.

### Editorial hooks on shared docs components

Components in `packages/docs` carry small `data-*` hooks that the editorial scope flattens — keeps the library API unchanged for non-editorial consumers while giving the editorial CSS a stable anchor:

- `[data-docs-stage="example|playground"]` on `CodeExample` and `PlaygroundConfigurator` outer wrappers.
- `[data-docs-stage-frame]` on the inner preview frame.
- `[data-docs-subtitle]` on the page-title sub-headline rendered by `DocsLayout`.

The editorial CSS flattens both stage backgrounds to transparent and hides the subtitle entirely. See [COMPONENT-API-CONVENTIONS.md](COMPONENT-API-CONVENTIONS.md#editorial-hooks) for the consumer-facing summary.

### Doc page

The full editorial token catalogue, activation steps, light/dark modes, and consumer override recipes live at `/customization/editorial-theme` (`apps/docs/src/routes/customization/editorial-theme/+page.svelte`).
