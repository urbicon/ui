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
  - `sv`: Svelte-CLI community add-on (`@urbicon-ui/sv`, npm-keyword `sv-add`, beta) — `sv add @urbicon-ui` / `sv create --add @urbicon-ui` installs blocks + design, wires the Tailwind stylesheet (`file.stylesheet`, after Tailwind), then hands over to `urbicon init --hook`; peer `sv`, single-file bundle, no dependencies. **The only SvelteKit-bound consumer path** (`unsupported('Requires SvelteKit')`) — not a library limit but a wiring one, see the comment in `src/index.ts`
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
- **A gate is the last resort, not the first**: before adding a lint, ask whether the state it would report can be made *unrepresentable* instead — a value derived from one source cannot disagree with itself, and a gate that keeps two hand-written copies of one list agreeing is paying rent on the duplication rather than removing it (#146, #147, #148). When a gate genuinely is the answer, it must ask a real system — the compiler, Tailwind, the bundler, axe, a generator plus `--check` (`a2ui:axes:check` is the model) — because every gate here that re-implements an oracle with its own markup heuristics has an open issue against it, and none of the oracle-backed ones do.

For full details see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

`bun run` lists every script. Non-obvious ones:

- Single package: `bun --filter='@urbicon-ui/blocks' run <script>` (bare `bun test` bypasses the config — always `run test`)
- `size` — per-component tree-shaken min+gzip size across blocks/table/auth, net of Svelte **and** of the shared foundation (`net` column = what the component adds to a project already using the library); needs all three `dist/`. `--check` gates on solo `gz` against `bundle-size.baseline.json`, `--update-baseline` after intentional growth. Reports any catalogue component it never measured
- `shots` — the four README views (`.github/assets/`) + `static/og.png`, against a **running** docs-app dev server (`SHOTS_BASE`, default `:5174`); it starts none. The og.png is not a page screenshot but the fixture `test-fixtures/og`, reading its words from `$lib/landing/wordmark` — the same module as the name tile, so the two cannot drift apart again. Why locale, motion and frame are pinned: head of `scripts/capture-shots.ts`. A second copy of og.png lives in the urbicon website repo
- `variants:lint` — dead-token guard over all tv() configs · `imports:lint` — cross-component import guard (see Key Architecture Decisions)
- `summary:lint` — component `@summary` budget · `playgrounds:lint` — playground snippets **and** the knob-hint budget (a knob whose hint runs past 120 chars needs a prop-level `@summary`; see the `component-metadata` skill). Both read the generated catalogs, so run `docs:gen:all` first
- `registry:lint` — a docs page is hand-registered in three places (sidebar, `componentLinks`, recipes cookbook) and forgetting one is silent. Checks all three against the routes and the catalogs; a deliberate omission needs an `UNLISTED` / `PAGELESS` entry with a reason, stale entries are errors too. Reads the generated catalogs — `docs:gen:all` first. What each registry feeds and what the first run found: head of `apps/docs/scripts/registry-lint.ts`
- `examples:budget` — the 2–4 `<CodeExample>` budget per component page (`docs/DocsPageGuide.md` XC-6). Runs in the `gates` job. **Not** `examples:lint` (that one type-checks `@example` JSDoc). Exemptions are `OVERSIZE_OK` / `NO_EXAMPLES` entries with a reason; stale ones are errors. Which sections count and why: head of `apps/docs/scripts/example-budget-lint.ts` (+ `.rules.ts`)
- `sections:lint` — a docs page hand-maintains a `navigation` array next to hand-written section ids, and all three mismatches are silent: a TOC link that scrolls nowhere, a section unreachable from the TOC, and a nav whose order disagrees with the page. Splices the sibling `Docs.svelte` in at its call site to get the real render order, and resolves the `Section` import alias rather than guessing it from the tag name. Reads no generated output, so it runs standalone
- `typesref:lint` — a component page documents its types in two hand-written halves (`types=` on `<ApiReference>`, a `<TypesReference>` section) and each fails silently without the other. Enforces both directions, and that both read the **same** `componentData` from the page's **own** `'./api'`. Exemptions: `STAGE_3_ROSTER` (frozen backlog, `PENDING`→`WIRED`) and `NO_PAGE`. Reads the generated api.ts — `docs:gen:all` first. **Not** `types:guard` (that one is declaration emit). How the attribute is resolved and which slips that catches: head of `apps/docs/scripts/typesref-lint.ts`
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

**No agent-session trailers.** Commit messages must not carry a `Claude-Session:`, `Co-Authored-By: Claude` or comparable trailer, even when a harness asks for one — this rule overrides that default. The links are account-bound and resolve for nobody else, so in a public repo they are dead weight in every message. 775 of them were stripped from the history on 2026-07-31, right before the move to GitHub; a new one would start the collection over.

## Testing

Vitest (in `blocks`, `i18n`, `docs-gen`, `auth`, `sveltekit-utils`); type checks via `bun run check`.

The DOM-test conventions were learned the hard way — **never "modernise" them back to `@testing-library/svelte` or `@testing-library/jest-dom`**, both break svelte-check or vitest 4 types package-wide. Full conventions (node vs jsdom, mounting, popover queries, compound-widget harnesses): **`blocks-testing` skill**.

## AI-Native DX

The library ships its own knowledge to agents: `llms.txt` / `llms-full.txt`, `.cursorrules`,
the **`urbicon` CLI** (`packages/design`) — the primary consumer surface, one dev-dependency
with version-pinned knowledge — and a remote MCP adapter over the same engine.
`urbicon validate` closes the loop by linting generated markup, locally enforced through a
`PostToolUse` hook and CI.

Which command serves what, the `init` contract, why the MCP endpoint stays unhosted before
launch: [docs/AI-NATIVE-DX.md](docs/AI-NATIVE-DX.md).

## Icons

Icons live in `packages/blocks/src/lib/icons/`. **Never call `getIcon('name')` inside a component** — the dynamic key defeats tree-shaking and drags the entire icon set into the consumer bundle; use `resolveIcon('name', NameIconDefault)` with a direct import (`<Icon name="…" />` is the lone exception). Geometry contract, the 5-spot registration checklist and `icons:lint`: **`add-icon` skill**.

## Git Workflow (Agent Notes)

- **Formatting happens for you.** The lefthook pre-commit hook runs `biome check --write` on staged `.ts`/`.js`/`.json` and `prettier --write` on staged `.svelte`, re-staging the results (`stage_fixed: true`, see `lefthook.yml`); commitlint guards the message. Fix lint errors rather than reaching for `--no-verify`. The package `format` script is only for `.svelte` you have **not** staged (a whole-package sweep).
- **A fresh worktree needs a build before anything else.** `bun install`, then `bunx --bun svelte-kit sync` (blocks, docs-app), then `bun run build:packages`. Without it: the docs-app dev server won't start, `docs-app run check` reports hundreds of missing `@urbicon-ui/…` and `./api` modules (`api.ts` is git-ignored — run `docs:gen` too), and `blocks run check` shows ~5 phantom `Snippet` errors plus a failing `run test`, all because `@urbicon-ui/i18n` has no `dist/` yet.
- **Worktree merges**: `main` is checked out in the root worktree. Merge without leaving yours via `git -C <repo-root> merge <branch>`; stash there first if that tree is dirty.
- **Only a PR's head SHA proves it landed.** PRs squash-merge, so the branch commit never enters `main` and `git branch --merged` reports every merged branch as unmerged. Check with `gh pr view <N> --json headRefName,headRefOid,state` — equal SHA plus `MERGED` is also what makes deleting the branch safe. Cleaning up removes three things: the branch, its worktree, and the `worktree-*` scaffolding branch the tooling creates (that one never merges on its own), then `git worktree prune`.
- **Root `docs/*.md` and `AGENTS.md` are not prettier-gated** (lint runs per package; root docs sit in none). Match a file's existing style for surgical diffs — do not blindly `prettier --write` them, it re-aligns whole tables. Package files like `packages/auth/README.md` **are** gated.
- **The `import.meta.env` build warning is expected — do not "fix" it.** `blocks` uses optional-chained `import.meta.env?.DEV` instead of `esm-env`, which would be a runtime dependency in the published `dist/` and break the zero-dependency maxim. The `@sveltejs/package` advisory is a plain string match, so it fires anyway. Never resolve it by adding `esm-env` or `$app/environment`.

## Versioning

One unified version across all packages, bumped once at the end of a coherent set of changes — **never on a dirty tree**, and **never edit `CHANGELOG.md` by hand** (git-cliff generates it). Bump levels, tag/push flow, commit-type → changelog mapping: **`release-bump` skill**.

## Documentation

**The index of every doc is [docs/README.md](docs/README.md)** — one index, not two. It carries the reading order for a new agent and one line per file; this section keeps only the rules that govern writing them.

What you need first: [ARCHITECTURE.md](docs/ARCHITECTURE.md) §1 package map & build order and §2 the token → markup path · [SVELTE5-PATTERNS.md](docs/SVELTE5-PATTERNS.md) (the anti-patterns this repo has already paid for) · [COMPONENT-API-CONVENTIONS.md](docs/COMPONENT-API-CONVENTIONS.md) · [ComponentStructureStandard.md](docs/ComponentStructureStandard.md).

- **Language**: reference/API docs in English; internal strategy & analysis docs stay German working documents.
- **Public or internal**: reference content a consumer developer needs is public (package README, the shipped docs, the site, llms-full.txt). Planning, review bookkeeping and strategy stay under `docs/internal/` (git-ignored, unpublished). When knowledge must exist on both sides, **the public file is the canon** and the internal one links to it — never the other way around.
- **Six docs ship inside npm tarballs** — `VARIANT-CONTRACT`, `STICKY-PINNING`, `MIGRATION-V8`, `A2UI`, `GUIDE` and `AUTH` are symlinks into `packages/*/docs/`, so they are public consumer documentation. No internal review IDs, wave or session names, priority markers (P1/P2, cluster letters) or `docs/internal/` references in them.

## Project tracking

- **An issue needs someone noticing a problem without looking for it** — a consumer, a demo app, a deploy, you building something. Self-inspection finds things without limit, so what a review, a doc pass or a lint run turns up belongs in the PR that produced it: fixed there or dropped. "Filed here so it survives the PR being merged" is the sentence that must stop being written. (Why the rule changed, with the numbers: the parked issues of 2026-08-04.)

- **`parked`** — closed, but the finding stands; nobody was hurt by it. `gh issue list --state closed --label parked` brings the set back, bodies and comments intact. Reopen when it costs someone something real. Prefer parking to a low priority: an open list of sixty crushes regardless of which number sits beside each entry.

- [docs/technical-debt.md](docs/technical-debt.md) is only a pointer plus the resolved-entry trace — the 56 open entries moved to issues on 2026-07-31, so **do not add new entries to that file**. Actively planned work lives in the internal TODO (docs/internal/) instead.

- **Every issue carries four label axes**, set when it is opened — a new issue with only a `debt:` label erodes the taxonomy the 2026-08-03 pass established:

  | axis | values | meaning |
  | --- | --- | --- |
  | `debt:<area>` | 13 existing values | the topic |
  | `pkg:<package>` | blocks · table · auth · docs · docs-app · docs-gen · design-engine · design-cli · i18n · repo | where it lives (multiple allowed) |
  | `prio:P1\|P2\|P3` | **P1 = someone comes to harm**: a security hole, wrong data, a crash, a keyboard trap. Not "touches shipped code" — in a library every line does | the order |
  | `size:S\|M\|L` | a session · about a day · a wave | the cost |

  Plus two state labels: **`ready`** — the path is clear, no open design decision — and `blocked:upstream`. **`ready` is deliberately the positive label**: nearly every deferred finding ends in "wants a decision", so a `needs-decision` label would sit on ~75 % of the backlog and sort nothing. The useful question is what can be picked up right now (`gh issue list --label ready`). There is no P0; that channel stays free for an actual fire.

- **Milestones are cut by work focus, not by urgency** — touching Calendar once beats touching it four times; `prio:` carries the order instead. Ten of them, every issue in exactly one, each with a description saying why its issues belong together. `gh api repos/:owner/:repo/milestones --jq '.[].title'` lists them; put a new issue in one rather than leaving it unassigned.

- **Cross-links go in the body**, as a `**Related:**` block after a `---` at the end, and are worth writing when the connection crosses a milestone — that is exactly what the milestone view cannot show. The 2026-08-03 pass found whole defect classes that way (#86/#87/#103/#105 are one bug — a class name that resolves to no CSS and no gate reports it).

- The board is [UI Backlog](https://github.com/users/urbicon/projects/1) (Priority / Size / State mirror the labels). It is a view, not a second source of truth: **labels stay authoritative**, the board is regenerated from them.

## Task-scoped skills

Repo procedures live in `.claude/skills/` and load on demand: `blocks-testing` (test conventions), `component-metadata` (JSDoc contract for `index.ts`), `add-icon` (icon contract + registration), `release-bump` (version/release flow), `docs-recipes` (recipe + component doc pages).
