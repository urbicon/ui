# Repository Guidelines

## Project Overview

Svelte 5 + Tailwind CSS 4 UI component library monorepo. Uses Bun workspaces.

## Project Structure

- Root is a Bun workspace (`"private": true`). Source in `packages/*`:
  - `blocks`: Svelte UI components
    - `primitives`: Atomic UI components
    - `components`: complex UI widgets built on top of the primitives
  - `table`: Data table (sorting, filtering, grouping, selection, keyboard-nav, virtualization, column reorder, remote-mode, live updates)
  - `docs`: Reusable documentation UI components
  - `docs-gen`: Documentation generator (TypeScript CLI, extracts props/variants from AST)
  - `mcp-server`: Model Context Protocol server (10 read-only tools, 7 guide resources, 10 design-verb prompts) for LLM-driven development; manifest read/write lives in the `urbicon` CLI (`@urbicon-ui/design`), not the remote server
  - `i18n`: Localization (Svelte 5 runes-based); also ships a data-level translation audit (`auditTranslations`, `onMissingKey` / `createMissingKeyCollector`) + a dev-only `@urbicon-ui/i18n/audit` source scanner (unused / used-but-undefined keys, hardcoded strings), fronted by the `urbicon i18n` CLI command and `bun run i18n:check`
  - `shared-types`: Shared TypeScript types
  - `sveltekit-utils`: SvelteKit helper utilities (`createCronRunner`, URL-state runes)
  - `design`: the `urbicon` CLI (`@urbicon-ui/design`) — local design-loop enforcement (validate/hook/context/record-decision/sync-manifest/i18n/verb), ships the design skill + templates
  - `design-content`: versioned design knowledge bundle (`@urbicon-ui/design-content`) consumed by the remote MCP server + the `urbicon` CLI; `content/` is a git-ignored build artifact emitted by docs-gen
  - `design-engine`: zero-dep design linter / manifest parser / rubric (`@urbicon-ui/design-engine`), subpath exports `./linter` `./manifest` `./rubric`
  - `auth`: Authentication & user management (JWT sessions, refresh-token rotation, passkeys/WebAuthn, notifications, email)
    - Zero runtime dependencies — uses Web Crypto API for JWT, PBKDF2, WebAuthn (CBOR, ECDSA, RSA), Web Push (RFC 8291/8292)
    - Server: handler factories, handle hook, adapter pattern (Prisma adapter included)
    - Client: Svelte 5 Runes stores, blocks-based UI components (unstyled/slotClasses), i18n (EN/DE)
- Apps in `apps/docs` (documentation site)
- Build artifacts: `dist/`, `.svelte-kit/` (git-ignored)

## Key Architecture Decisions

- **Styling**: Custom `tv()` variant engine (`packages/blocks/src/lib/utils/variants.ts`, ~600 LoC, zero-dep replacement for `tailwind-variants`)
- **Design Tokens**: OKLCH color system with 3-layer architecture (foundation → semantic → interaction) in `blocks/src/lib/style/`
- **Dark Mode**: Semantic tokens handle dark mode automatically via the CSS `light-dark()` function (follows `color-scheme` / the user's `prefers-color-scheme`); no manual `dark:` overrides
- **Focus**: `focus-visible:` everywhere (not `focus:`), for keyboard-only focus rings
- **Z-Index**: CSS custom property tokens (`--z-modal`, `--z-dropdown`, etc.) via `z-[var(--z-*)]`
- **Components**: All support `unstyled` + `slotClasses` + `preset` props for style overrides; `BlocksProvider` additionally accepts prop-conditional `overrides` (style only a specific variant/intent/state, e.g. the `outlined` variant)

For full details see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

- Install: `bun install`
- Dev (all): `bun run dev` · Dev (one): `bun --filter='@urbicon-ui/blocks' run dev`
- Build: `bun run build`
- Quality: `bun run check` (type/svelte-check), `bun run lint`, `bun run format`
- Docs generation: `bun run docs:gen:all`
- Scaffold docs page: `bun run docs:scaffold <ComponentName> --group primitives|components`
- Changelog: `bun run changelog` (generates `CHANGELOG.md` via git-cliff)
- Version bump: `bun run bump` (patch), `bun run bump:minor`, `bun run bump:major` — see [Versioning](#versioning)

## Coding Conventions

- Lint/format: **Biome** for `.ts`/`.js`/`.json` (`biome.json` extends `@urbicon/biome-config`); **Prettier** for `.svelte` only (single quotes, width 100, no trailing commas) + `svelte-check`. Biome does not parse `.svelte`.
- **Dropped on the ESLint→Biome migration** (Biome can't lint `.svelte` markup; `svelte-check` keeps a11y): `svelte/no-at-html-tags` (`{@html}` XSS guard), `svelte/require-each-key`, `svelte/prefer-svelte-reactivity`, `svelte/no-navigation-without-resolve`. Re-add a `.svelte`-only ESLint pass if these regress.
- Components: PascalCase `.svelte`, props in `index.ts`, variants in `*.variants.ts`
- **Component metadata via JSDoc**: Every `*Props` interface in `index.ts` MUST have JSDoc tags — this is the single source of truth for the MCP server, `llm.txt`, and documentation site:
  - `@description` (required) — short, informative description
  - `@tag` (one or more) — category tags: `form`, `action`, `overlay`, `feedback`, `layout`, `navigation`, `display`, `data`
  - `@related` (zero or more) — related component names
  - `@stability` (optional, default `stable`) — `experimental | beta | stable | deprecated`; drives the Editorial stability badge in the doc-page header
  - `@standalone` (optional, multi-component `index.ts` only) — opt-in: this export gets its own MCP-catalog entry + `llm.txt` (e.g. the seven Guide surfaces). Without it, additional exports count as compound subcomponents (TabItem, MenuItem) and stay folded into the directory component's entry. Requires a matching `export { default as X } from './X.svelte'` in the same file.
  ```ts
  /**
   * @description Short, informative description of what this component does.
   * @tag form
   * @related Input
   * @related Select
   * @stability stable
   */
  export interface ComboboxProps { ... }
  ```
  - **Regeneration is two-step — run `docs:gen:all`, not `docs:gen:<target>`.** `docs:gen:<target>` only writes `apps/docs/static/<group>/_catalog.json` + per-component `llm.txt`; the `MCPCatalogAssembler` (runs only in `docs:gen:all` / `build`) globs every `_catalog.json` into `apps/docs/static/mcp/component-catalog.json` — the file the MCP server actually loads for `find_components`/`suggest_implementation`. Editing `*Props` JSDoc and running only `docs:gen:<target>` leaves that file **stale**. All three artifacts are git-ignored (CI rebuilds them on `build`).
  - **Name the real server factory.** For a component with a server counterpart (auth handler, SSE/stream endpoint), the `@description` MUST reference the shipped factory (e.g. `createInvitationHandlers`, `createStreamHandler`), cross-checked against the package's `server/index.ts` exports — never "create the CRUD/SSE endpoint yourself", which steers consumers into reimplementing a handler that already ships.
- Package scope: `@urbicon-ui/*`
- Use semantic design tokens over primitive Tailwind classes

For full component API conventions see [docs/COMPONENT-API-CONVENTIONS.md](docs/COMPONENT-API-CONVENTIONS.md).
For component file structure see [docs/ComponentStructureStandard.md](docs/ComponentStructureStandard.md).

## Svelte 5 — Mandatory Patterns

Recurring anti-patterns that have already surfaced and been fixed in this repo. Full reference with examples, role models, and grep targets: [docs/SVELTE5-PATTERNS.md](docs/SVELTE5-PATTERNS.md).

| Pattern | Replacement | Severity |
| --- | --- | --- |
| `Math.random()` for IDs | `$props.id()` — two-step pattern (see below) | 🔴 |
| `setContext('string', …)` | `createContext<T>()` from `svelte` (≥ 5.40) | 🟠 |
| `$state(new Map())` / `$state(new Set())` | `SvelteMap` / `SvelteSet` from `svelte/reactivity` | 🟠 |
| `onMount + matchMedia(…)` | `MediaQuery` from `svelte/reactivity` | 🟡 |
| Index as key in `{#each}` | Stable unique key (`item.id`, ISO date, `${a}-${b}-${i}`) | 🟠 |
| `class:foo={bar}` directive | Array in `class={['foo', bar && 'bar']}` | 🟡 |
| `use:action` | `{@attach action(…)}` | 🟡 |
| `<svelte:component this={X}>` | `<X />` directly | 🟡 |
| `<slot />` / `<svelte:fragment>` | `{@render children()}` + snippets | 🟠 |
| `export let foo`, `on:click=`, `$:`, `$$props` | `$props()`, `onclick=`, `$derived`/`$effect`, `let { ...rest } = $props()` | 🔴 |

**Svelte MCP** (`mcp__svelte__*`):

- **Before** researching Svelte/SvelteKit concepts: `list-sections` → `get-documentation`
- **After every edit** to a `.svelte` file: call `svelte-autofixer` until it returns 0 issues
- **Not** for pattern questions already condensed in this repo — see [docs/SVELTE5-PATTERNS.md](docs/SVELTE5-PATTERNS.md)

**Mandatory when building new components:**

- **IDs:** never `Math.random()` — it causes an SSR hydration mismatch in the consumer. `$props.id()` may **only** appear as a top-level initializer (compiler error `props_id_invalid_placement` otherwise). For components with an `id`/`name` prop, use two steps:
  ```ts
  const propsId = $props.id();
  const fieldId = $derived(idProp ?? `prefix-${propsId}`);
  ```
- **Compound components:** `createContext<T>()`, no string keys
- **Reactive collections:** wrappers from `svelte/reactivity` (`SvelteMap`, `SvelteSet`, `MediaQuery` — instance-local, not the module-global `svelte/reactivity/window`)
- **`{#each}`:** stable keys from domain IDs, not the loop index
- **Snippets over slots; `{@attach}` over `use:`**

**Role models in the repo:** `Tab/tab.context.ts` + `Tab.svelte` (createContext + SvelteMap), `utils/overlay-stack.svelte.ts` (class with `$state` + `untrack`), `Sidebar.svelte` (`MediaQuery`), `Combobox.svelte` (generic component).

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org). Enforced via commitlint (`@urbicon/commitlint-config`) + lefthook.

Format: `<type>(<scope>): <description>`

Common types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `build`, `ci`, `perf`

Scope by package when relevant: `feat(blocks): add Stepper component`, `fix(table): correct sort order`

Conventional commits are parsed by git-cliff to auto-generate the changelog. Use correct types and scopes so changes appear in the right section.

## Testing

- Framework: Vitest (in `blocks`, `i18n`, `docs-gen`, `auth`, `sveltekit-utils`)
- Type checks: `bun run check` or per-package `svelte-check`

**Component / DOM tests (`blocks`).** Most tests run in the default `node` environment (variant + logic checks, no DOM). Interaction tests (focus/keyboard/click) that need a real DOM opt into jsdom **per file** with a `// @vitest-environment jsdom` docblock, so the node suite stays fast and untouched. Reference: `Combobox/Combobox.svelte.test.ts` (guards the #19 focus-reopen). Conventions, learned the hard way — do not "modernise" back to the obvious libraries:

- **Mount with Svelte's own `mount`/`unmount`** (from `svelte`), **not** `@testing-library/svelte`. The latter pulls a second svelte instance, which makes svelte-check see two unrelated `Snippet` types across the whole package (spurious errors in unrelated components). Queries + interactions use the svelte-free `@testing-library/dom` (`screen`) + `@testing-library/user-event`.
- **Assert with vitest's native matchers** (`toBe`, `document.activeElement`, `getAttribute`), **not** `@testing-library/jest-dom` — its expect augmentation does not compose with vitest 4's `Assertion` type.
- **Overlay content (Combobox/Select/Menu/Tooltip) renders in a native popover.** jsdom has no top layer, so query it with `{ hidden: true }`. These tests assert interaction *logic* (aria, callbacks, state), not visual visibility — that is Playwright's (`e2e/`) job.
- jsdom polyfills (scrollIntoView, Popover API, Resize/IntersectionObserver) live in `packages/blocks/vitest-setup.ts`, guarded on `window` so node tests skip them.
- **Compound widgets** (Tab/SegmentGroup/RadioGroup/Accordion/Stepper) whose children register through context can't be driven by a `createRawSnippet` of plain HTML — mount a real composition from a `__fixtures__/<Widget>Harness.svelte` next to the test (reference: `Tab/__fixtures__/TabHarness.svelte`). `__fixtures__/` is already excluded from the published package (package.json `files` → `!dist/**/__fixtures__/**`) and isn't collected as a test (no `.test`/`.spec` in the name). **Declarative** primitives (Toggle/Checkbox/ConfirmDialog/Slider/Collapsible) need no fixture — pass props directly and build any content snippet with `createRawSnippet` (reference: `Dialog.svelte.test.ts`).

## AI-Native DX

- `llms.txt` / `llms-full.txt` – LLM-readable API reference (llms.txt standard)
- `.cursorrules` – Cursor IDE rules (imports, API grammar, tokens, do/don't)
- **MCP Server** (`packages/mcp-server`) – Streamable HTTP transport, tools: `find_components`, `get_component`, `get_recipe`, `suggest_implementation`, `get_implementation_checklist`, `get_css_reference`, `find_icons`, `get_design_principles`, `get_pattern`, `validate_design`. All read-only; includes auth package components (filterable via `auth` tag). Manifest read/write (context / record-decision / sync-manifest) moved to the `urbicon` CLI in `@urbicon-ui/design`.
- **Design System Intelligence** (`design-system/`) – Layer 4+5 of the 5-layer design model: `principles.md` (heuristics, paradigm profiles, change decision tree) + `patterns/*.md` (composition patterns: settings-page, dashboard, form-page, tab-navigation, onboarding-guide). Consumed by MCP tools `get_design_principles` and `get_pattern`.
- **Closed design loop** – Beyond serving knowledge: `validate_design` lints generated markup (deterministic rules + token whitelist + heuristics); `data-design-pattern` markers + `design.manifest.md` (maintained consumer-side via the `urbicon` CLI: context / record-decision / sync-manifest) persist design intent per consumer project; `get_design_principles(as="rubric")` serves the 1–5 judge rubric; the design-verb prompts (the full table — onboard, adopt, compose, redesign, polish, critique, fix, retheme, audit, migrate — also shipped as a local skill in `@urbicon-ui/design`) ship the generate → validate → judge → synthesise process; locally the `urbicon` CLI enforces that loop — a `PostToolUse` hook (`urbicon hook`) and CI (`urbicon validate`; correctness always gates, the slop axis opt-in via `--slop-floor`) turn it from advisory to required (templates ship under `@urbicon-ui/design/templates`).

## Icon Design Rules

Icons live in `packages/blocks/src/lib/icons/` — geometry in `svg/<name>.svg`, a thin `<Name>Icon.svelte` imports it via `?raw`. Contract: **24×24 viewBox, `strokeWidth=2`, round caps/joins, pure stroke** (no `fill`), 0.5px grid, `rx ∈ {0, 0.5, 1.5, 2.5}` or capsule (`short/2`), original geometry only (never copy Lucide/Heroicons paths). Adding one touches **5 spots across 4 files** (the `<Name>Icon.svelte` component, the `IconName` union in `icon-types.ts`, `DEFAULT_ICONS` + `ICON_METADATA` in `icon-registry.ts`, and the `index.ts` export). Run **`bun run icons:lint`** — it enforces the contract + registry integrity (errors) and flags judgement calls (warnings). Full measurement spec, corner-radius scale, canonical motifs, reference icon per shape class + checklist: [docs/ICON-DESIGN.md](docs/ICON-DESIGN.md).

**Resolving icons inside components (tree-shaking):** call `resolveIcon('name', NameIconDefault)` with a **direct** icon import — `import NameIconDefault from '$lib/icons/NameIcon.svelte'` (within blocks) or `import { NameIcon as NameIconDefault } from '@urbicon-ui/blocks'` (from another package, e.g. table). The `IconProvider`/`setIcons` override still wins; the direct import is only the fallback. **Never `getIcon('name')` in a component** — it indexes the full `DEFAULT_ICONS` registry (dynamic key → not tree-shakeable) and drags all 315 icons into the consumer bundle. `getIcon`/`DEFAULT_ICONS` (both in `icon-registry.ts` since the module split) are reserved for the dynamic `<Icon name="…" />` component (the lone exception). Regression grep: `rg "getIcon\(" packages/*/src --glob '!**/icon-registry.ts' --glob '!**/icon.context.ts' --glob '!**/Icon.svelte'`. Rationale + measurements: [docs/ICON-DESIGN.md](docs/ICON-DESIGN.md) → "Icon resolution & tree-shaking".

## Available Components under 'packages'

- packages/blocks/src/lib/primitives:
  Accordion, Alert, Avatar, Badge, Breadcrumb, Button, ButtonGroup, Card, Checkbox, Collapsible, Combobox, ConfirmDialog, Dialog, Drawer, FormField, Input, JourneyTimeline, Menu, Pagination, Popover, Progress, RadioGroup, SegmentGroup, Select, Separator, Sidebar, Skeleton, Slider, Spinner, Stepper, Tab, Textarea, Toast, Toggle, Toolbar, Tooltip
- packages/blocks/src/lib/components:
  AreaChart, BarChart, Calendar, ChartFrame, CommandPalette, CompositionBar, CurrencyInput, DatePicker, DonutChart, EmptyState, FileUpload, Guide (+ GuideProvider, GuidePanel, GuideArticle, GuideMarker, GuideMention, GuideRef, GuideHint, GuideBeacon), LineChart, LocaleSwitcher, Planner, Sankey, SidebarLayout, Sparkline, ThemeSwitcher
- packages/table/src/lib:
  Table
- packages/docs/src/lib/components:
  ApiReference, CodeExample, CodePanel, DocsLayout, InfoCard, PlaygroundConfigurator, Section, TableOfContents, TypesReference
- packages/auth/src/lib/client/components:
  LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, InvitationManager, PasskeyManager, AccountSettings, SessionManager, TwoFactorManager, NotificationCenter, NotificationBadge, NotificationListener, PushPermissionPrompt

## Git Workflow (Agent Notes)

- **Before committing**: the lefthook pre-commit hook auto-formats **both** staged `.ts`/`.js`/`.json` (via `biome check --write`) **and** staged `.svelte` (via `prettier --write`), re-staging the fixed results (`stage_fixed: true` on both commands — see `lefthook.yml`). So staged files get formatted for you; use the package format script (`bun --filter='<pkg>' run format`) only to reformat `.svelte` you have **not** staged (e.g. a whole package sweep).
- **Worktree merges**: `main` is checked out in the root worktree (`<repo-root>`). Merge into it **without leaving your worktree** via `git -C <repo-root> merge <branch>` (a fast-forward when `main` hasn't moved). If that tree has uncommitted changes, `git -C … stash` first and `stash pop` after.
- **Pre-commit hooks**: lefthook (`lefthook.yml`, installed via the `prepare` script) runs `biome check --write` (+ `prettier --write` for `.svelte`) on staged files (pre-commit) + commitlint (commit-msg). Fix lint errors before retrying — don't use `--no-verify`.
- **SvelteKit sync**: After `bun install` in a fresh worktree, run `bunx --bun svelte-kit sync` in packages that need it (blocks, docs-app) before `svelte-check` or `dev`.
- **Dev server deps**: The docs-app dev server requires built packages. Run `bun run build` once in a fresh worktree before `preview_start`.
- **docs-app `check` deps**: `bun --filter='@urbicon-ui/docs-app' run check` needs the workspace packages **built** (`bun run build` / `build:packages`) **and** a `docs:gen` run — `apps/docs/src/**/api.ts` is git-ignored and imported by every page, so a fresh worktree otherwise shows hundreds of "Cannot find module '@urbicon-ui/…'" / missing-`./api` errors.
- **blocks `check`/`test` deps**: In a fresh worktree `bun --filter='@urbicon-ui/blocks' run check` and `run test` fail until the workspace deps are built. `check` reports ~5 spurious svelte-check errors (`Snippet` "Two different types with this name exist" in `Menu`/`CurrencyInput`/`Planner`) because `@urbicon-ui/i18n` has no real `dist/` yet, so TS resolves its `Snippet` decl via two paths; `test` reports "Failed to resolve entry for package @urbicon-ui/i18n". Build first — `bun --filter='@urbicon-ui/shared-types' run build && bun --filter='@urbicon-ui/i18n' run build` (or `bun run build:packages`) — then svelte-check is 0 errors and tests are green.
- **Root `docs/*.md` + `AGENTS.md` are NOT prettier-gated** (lint runs per-package via `--filter='*'`; root docs sit in no package). Many are hand-/compact-formatted (unaligned tables). For surgical diffs, match a file's existing style — do **not** blindly `prettier --write` root docs (it re-aligns whole tables). Package files like `packages/auth/README.md` **are** gated.
- **`import.meta.env` build warning is expected — do NOT "fix" it**: the library build emits a `@sveltejs/package` advisory ("Avoid usage of `import.meta.env`"). Intentional and harmless: `blocks` uses optional-chained `import.meta.env?.DEV` (safe in non-Vite consumers) instead of `esm-env`, because `esm-env` would be a **runtime dependency** in the published `dist/` and break the zero-dependency maxim. The advisory is a plain string-match, so it fires even with `?.`. Never resolve it by adding `esm-env` / `$app/environment`.

## Versioning

**Conventional Commits → git-cliff → Changelog**, one unified version across all packages. Bump proactively after a coherent set of changes (once at the end, not per commit; never on a dirty tree):

- **Patch** `bun run bump` — `fix` / `docs` / `refactor` / `chore` / `style` / `test` / `perf`
- **Minor** `bun run bump:minor` — `feat` (new component / prop / capability)
- **Major** `bun run bump:major` — `feat!:` or `BREAKING CHANGE:`

The bump writes a `chore: release vX.Y.Z` commit + an annotated tag on HEAD (the tag triggers the CI publish pipeline). Push with `git push --follow-tags`. **Never edit `CHANGELOG.md` by hand** — it is auto-generated. Full detail — bump-script steps, commit-type→changelog mapping, scoping: [docs/VERSIONING.md](docs/VERSIONING.md).

## Documentation

Reference/API docs are written in English; internal strategy & analysis docs are kept in German as working documents.

**Architecture & conventions**

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – Token system, Mint, preset system, i18n, docs-gen pipeline
- [docs/COMPONENT-API-CONVENTIONS.md](docs/COMPONENT-API-CONVENTIONS.md) – Props, callbacks, styling patterns
- [docs/ComponentStructureStandard.md](docs/ComponentStructureStandard.md) – File structure, index.ts, variants.ts
- [docs/SVELTE5-PATTERNS.md](docs/SVELTE5-PATTERNS.md) – Svelte 5 anti-patterns, library-specific rules, role models, grep targets
- [docs/TailwindCaveats.md](docs/TailwindCaveats.md) – Tailwind 4 specifics, @theme, Svelte integration
- [docs/ResponsiveGuidelines.md](docs/ResponsiveGuidelines.md) – Breakpoints, touch targets, overlay patterns
- [docs/ICON-DESIGN.md](docs/ICON-DESIGN.md) – Icon design language: hard contract + 0.5-grid/live-area, corner-radius scale, canonical motifs, reference icon per shape class, detail budget; enforced by `bun run icons:lint` (`packages/blocks/scripts/icons-lint.ts`)
- [docs/ICON-ROADMAP.md](docs/ICON-ROADMAP.md) – Icon set expansion 156→315 (P1 symmetry, P2 domain depth: real-estate/energy/finance/auth, P3 breadth); rationale, non-goals (no brand logos), polish backlog
- [docs/VERSIONING.md](docs/VERSIONING.md) – Bump levels, bump-script steps, commit-type → changelog mapping, scoping
- [docs/DocsPageGuide.md](docs/DocsPageGuide.md) – Building component documentation pages

**Component reference**

- [docs/COMPONENT-FAMILIES.md](docs/COMPONENT-FAMILIES.md) – Six-family taxonomy (Action/Form/Navigation/Container/Feedback/Identity) — ARIA, tier behaviour, border-token source per family
- [docs/COMPONENT-DECISION-MATRICES.md](docs/COMPONENT-DECISION-MATRICES.md) – Sidebar/Drawer/Popover/SidebarLayout decision matrix
- [docs/STICKY-PINNING.md](docs/STICKY-PINNING.md) – Table scroll models: page-relative sticky pinning (toolbar/header/group-header) + contained scroll (`fit="viewport"`), API, CSS vars
- [docs/GUIDE.md](docs/GUIDE.md) – Guide system (non-modal help panel, contextual hints, UI↔guide linking, opt-in guided tour over one headless engine): architecture, `data-guide` namespace, tokens/z-index, decisions D1–D6, as-built contract. Shipped v5.8.0, stability `beta`.

**Auth**

- [docs/AUTH.md](docs/AUTH.md) – Auth package: architecture, exports, consumer integration

**Internal working docs**

Internal working docs (strategy, launch, deployment, design analysis) are kept locally under docs/internal/ and are not part of the published repo.

**Project tracking**

- [docs/technical-debt.md](docs/technical-debt.md) – versioned log for small, non-blocking findings hit in passing that need a design decision or a broader sweep, not an on-the-fly fix. Add an entry rather than dropping such a finding silently; keep it to genuine deferrals (don't log what the code, git history, or planned TODO work already covers). Actively planned work lives in the internal TODO (docs/internal/) instead.

**Launch & ops**

- [docs/MIGRATION-v5.md](docs/MIGRATION-v5.md) – v4 → v5 consumer migration guide

## Recipe Pages

Recipe pages in `apps/docs/src/routes/recipes/*/` use structured `meta.ts` files for metadata (title, description, components, features). The `recipeCode` template literal stays in `+page.svelte` for the live preview.
