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
- **Internal core layer**: Public blocks components never import each other for trivial embedded controls (close ×, loading spinner, icon-only nav button) — they use the behaviour-only cores in `src/lib/internal/core/` (`CoreIconButton`, `CoreSpinner`; never exported) with the look in an own variants slot. Essential compositions (ConfirmDialog→Dialog, DatePicker→Calendar) stay direct imports but need a justified allowlist entry in `packages/blocks/scripts/imports-lint.ts`; `bun run imports:lint` errors on unknown edges AND stale entries. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) → "Internal Core Layer".

For full details see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

`bun run` lists every script. Non-obvious ones:

- Single package: `bun --filter='@urbicon-ui/blocks' run <script>` (bare `bun test` bypasses the config — always `run test`)
- `size` — per-component tree-shaken min+gzip size across blocks/table/auth, net of Svelte **and** of the shared foundation (`net` column = what the component adds to a project already using the library); needs all three `dist/`. `--check` gates on solo `gz` against `bundle-size.baseline.json`, `--update-baseline` after intentional growth. Reports any catalogue component it never measured
- `variants:lint` — dead-token guard over all tv() configs · `imports:lint` — cross-component import guard (see Key Architecture Decisions)
- `summary:lint` — component `@summary` budget · `playgrounds:lint` — playground snippets **and** the knob-hint budget (a knob whose hint runs past 120 chars needs a prop-level `@summary`; see the `component-metadata` skill). Both read the generated catalogs, so run `docs:gen:all` first
- `registry:lint` — a docs page is hand-registered in three places (sidebar `navigation.ts`, `componentLinks`, the recipes cookbook) and forgetting one is silent: the page never appears in the sidebar, `@related` chips to it are dropped without a word (`buildRelatedLinks` skips unknown names), recipe chips fall back to `#`. Checks that every catalogue component with a `+page.svelte` is in `componentLinks` and points at its own page, that every href and every recipe/showcase chip resolves, that every page is in the sidebar and every recipe in the cookbook. A deliberately unlisted page needs an `UNLISTED` entry with a reason in `apps/docs/scripts/registry-lint.ts`; stale entries are errors too (same contract as `imports:lint`). Reads the generated catalogs — `docs:gen:all` first
- `examples:lint` — type-checks every `@example` block of every `*Props` JSDoc across blocks/table/auth/docs: each snippet is written out as a real `.svelte` file and run through `svelte-check`, so a wrong prop name, a variant value that does not exist, a missing required prop or a mistyped component name fails loudly. Slow (two `svelte-check` passes per package) and needs the workspace deps built — a pre-merge/pre-bump gate, not a per-commit one. A consumer-context component in an example (`<SettingsForm>`) needs a `PLACEHOLDERS` entry in `packages/docs-gen/scripts/examples-lint.ts`; stale entries are errors (same contract as `imports:lint`)
- `docs:gen:all` — **not** `docs:gen:<target>`; only the `:all` run assembles the MCP catalog

## Coding Conventions

- Lint/format: **Biome** for `.ts`/`.js`/`.json` (`biome.json` extends `@urbicon/biome-config`); **Prettier** for `.svelte` only (single quotes, width 100, no trailing commas) + `svelte-check`. Biome does not parse `.svelte`.
- **Dropped on the ESLint→Biome migration** (Biome can't lint `.svelte` markup; `svelte-check` keeps a11y): `svelte/no-at-html-tags` (`{@html}` XSS guard), `svelte/require-each-key`, `svelte/prefer-svelte-reactivity`, `svelte/no-navigation-without-resolve`. Re-add a `.svelte`-only ESLint pass if these regress.
- Components: PascalCase `.svelte`, props in `index.ts`, variants in `*.variants.ts`
- **Component metadata via JSDoc**: every `*Props` interface in `index.ts` MUST carry JSDoc tags — the single source of truth for the MCP server, `llm.txt` and the docs site. Tag contract + the `docs:gen:all` regeneration trap: **`component-metadata` skill**.
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

Vitest (in `blocks`, `i18n`, `docs-gen`, `auth`, `sveltekit-utils`); type checks via `bun run check`.

The DOM-test conventions were learned the hard way — **never "modernise" them back to `@testing-library/svelte` or `@testing-library/jest-dom`**, both break svelte-check or vitest 4 types package-wide. Full conventions (node vs jsdom, mounting, popover queries, compound-widget harnesses): **`blocks-testing` skill**.

## AI-Native DX

- `llms.txt` / `llms-full.txt` – LLM-readable API reference (llms.txt standard)
- `.cursorrules` – Cursor IDE rules (imports, API grammar, tokens, do/don't)
- **`urbicon` CLI** (`packages/design`, `@urbicon-ui/design`) – **the primary, consumer-facing surface** (one dev-dependency, version-pinned knowledge). Knowledge: `primer` (the always-needed bundle — component selection + the token core, one call, run first), `find`, `get-component`, `icons`, `recipe`, `guide` (bundled package guides: auth reference, blocks guide system, migration notes, table scroll models), `pattern`, `principles` (`--topic`, `--rubric`), `css-reference`. Judgment: `validate` (+ `hook`/CI). Memory: `context`, `record-decision`, `sync-manifest`. Process: `verbs`/`verb <name>` + the `urbicon-design` skill. Onboarding: `init` (AGENTS.md block, manifest scaffold, `--hook`/`--ci`; `--with-primer` — default on — adds the "load the primer" step, which the shipped template deliberately omits so a harness that injects the primer itself can take the template verbatim).
- **MCP Server** (`packages/mcp-server`) – thin remote adapter over the same engine/content (Streamable HTTP, 10 read-only tools, 10 verb prompts, 7 guide resources). **Deliberately not advertised or hosted pre-launch (Option B, 2026-07-10)** — the package track is the story; hosting the public endpoint is a launch decision. Kept in the repo and green; no local-install path is documented anywhere (the old `bunx`-stdio setup on `/ai` was removed). Manifest read/write lives in the `urbicon` CLI, never on the stateless server.
- **Design System Intelligence** (`design-system/`) – Layer 4+5 of the 5-layer design model: `principles.md` (heuristics, paradigm profiles, change decision tree) + `patterns/*.md` (composition patterns: settings-page, dashboard, form-page, tab-navigation, onboarding-guide). Served locally by `urbicon principles` / `urbicon pattern` and remotely by `get_design_principles` / `get_pattern`, both from the `design-content` bundle.
- **Closed design loop** – Beyond serving knowledge: `urbicon validate` (= remote `validate_design`, same engine) lints generated markup (deterministic rules + token whitelist + heuristics); `data-design-pattern` markers + `design.manifest.md` (maintained consumer-side via the `urbicon` CLI: context / record-decision / sync-manifest) persist design intent per consumer project; `urbicon principles --rubric` serves the 1–5 judge rubric; the design verbs (the full table — onboard, adopt, compose, redesign, polish, critique, fix, retheme, audit, migrate — shipped as the local skill in `@urbicon-ui/design` and as MCP prompts, same text) ship the generate → validate → judge → synthesise process; locally the `urbicon` CLI enforces that loop — a `PostToolUse` hook (`urbicon hook`) and CI (`urbicon validate`; correctness always gates, the slop axis opt-in via `--slop-floor`) turn it from advisory to required (templates ship under `@urbicon-ui/design/templates`).

## Icons

Icons live in `packages/blocks/src/lib/icons/`. **Never call `getIcon('name')` inside a component** — the dynamic key defeats tree-shaking and drags all 315 icons into the consumer bundle; use `resolveIcon('name', NameIconDefault)` with a direct import (`<Icon name="…" />` is the lone exception). Geometry contract, the 5-spot registration checklist and `icons:lint`: **`add-icon` skill**.

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

One unified version across all packages, bumped once at the end of a coherent set of changes — **never on a dirty tree**, and **never edit `CHANGELOG.md` by hand** (git-cliff generates it). Bump levels, tag/push flow, commit-type → changelog mapping: **`release-bump` skill**.

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
- [docs/DOCS-SURFACES.md](docs/DOCS-SURFACES.md) – Documentation taxonomy: where docs live, who owns them, how they reach consumers (tarball, site, llms, CLI) — includes the anti-pendulum rule for package docs (source lives with the versioned artifact, `docs/` keeps a symlink)

**Component reference**

- [docs/COMPONENT-FAMILIES.md](docs/COMPONENT-FAMILIES.md) – Six-family taxonomy (Action/Form/Navigation/Container/Feedback/Identity) — ARIA, tier behaviour, border-token source per family
- [docs/COMPONENT-DECISION-MATRICES.md](docs/COMPONENT-DECISION-MATRICES.md) – Sidebar/Drawer/Popover/SidebarLayout decision matrix
- [docs/STICKY-PINNING.md](docs/STICKY-PINNING.md) – Table scroll models: page-relative sticky pinning (toolbar/header/group-header) + contained scroll (`fit="viewport"`), API, CSS vars. **Symlink into `packages/table/docs/`, ships in the table tarball** — keep it public-appropriate.
- [docs/A2UI.md](docs/A2UI.md) – A2UI (agent-generated UI): surfaces that outlive their reply, the action-only return path, fetched options, and the shipped pieces (`a2uiFencedTransportSection`, `A2uiStreamSplitter`, `A2uiSurfaceRouter` + `routeMessageParts`). **Symlink into `packages/blocks/docs/`, ships in the blocks tarball** — keep it public-appropriate.
- [docs/GUIDE.md](docs/GUIDE.md) – Guide system (non-modal help panel, contextual hints, UI↔guide linking, opt-in guided tour over one headless engine): architecture, `data-guide` namespace, tokens/z-index, decisions D1–D6, as-built contract. Shipped v5.8.0, stability `beta`. **Symlink into `packages/blocks/docs/`, ships in the blocks tarball** — keep it public-appropriate.

**Auth**

- [docs/AUTH.md](docs/AUTH.md) – Auth package: architecture, exports, consumer integration. **This file is a symlink into `packages/auth/docs/AUTH.md` and ships in the npm tarball** (the package README links to it as `./docs/AUTH.md`) — it is public consumer documentation. Keep it public-appropriate: no internal review IDs, wave/session names, priority markers (P1/P2, cluster letters) or `docs/internal/` references; that material belongs in docs/internal/ or technical-debt.md.

**Internal working docs**

Internal working docs (strategy, launch, deployment, design analysis) are kept locally under docs/internal/ and are not part of the published repo. Rule of thumb for every doc: reference/API content that a consumer developer needs is public (package README, the shipped AUTH.md, the docs site, llms-full.txt) and written in English; planning, review bookkeeping and strategy stay internal. When knowledge must exist on both sides, the public file is the canon and the internal one links to it — never the other way around.

**Project tracking**

- [docs/technical-debt.md](docs/technical-debt.md) – versioned log for small, non-blocking findings hit in passing that need a design decision or a broader sweep, not an on-the-fly fix. Add an entry rather than dropping such a finding silently; keep it to genuine deferrals (don't log what the code, git history, or planned TODO work already covers). Actively planned work lives in the internal TODO (docs/internal/) instead.

**Launch & ops**

- [docs/MIGRATION-v5.md](docs/MIGRATION-v5.md) – v4 → v5 consumer migration guide. **Symlink into `packages/blocks/docs/`, ships in the blocks tarball** — keep it public-appropriate.

## Task-scoped skills

Repo procedures live in `.claude/skills/` and load on demand: `blocks-testing` (test conventions), `component-metadata` (JSDoc contract for `index.ts`), `add-icon` (icon contract + registration), `release-bump` (version/release flow), `docs-recipes` (recipe + component doc pages).
