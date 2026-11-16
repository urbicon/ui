# Repository Guidelines

## Project Structure

Svelte 5 + Tailwind CSS 4 UI component library, a Bun-workspace monorepo (root `"private": true`). What each package does and where to start reading: [ARCHITECTURE.md § 1](docs/ARCHITECTURE.md#1--the-monorepo-at-a-glance).

- `blocks` — the Svelte components: `primitives` (atomic) and `components` (widgets built on them)
- `table` — the data table
- `auth` — authentication and user management, zero runtime dependencies (Web Crypto)
- `i18n` — runes-based localization and the translation audit
- `docs` — reusable documentation UI components · `docs-gen` — the generator that extracts props and variants from the AST · `shared-types` — docs-tooling types for those two
- `design` — the `urbicon` CLI, the consumer surface (`urbicon --help` lists the commands) · `urbicon` — its unscoped bin name · `design-content` — the knowledge bundle it serves · `design-engine` — the zero-dep design linter
- `sveltekit-utils` — SvelteKit helpers · `mcp-app` — MCP-App views · `sv` — the `sv add @urbicon-ui` add-on
- `apps/docs` — the documentation site · `apps/artifact-studio`

## Key Architecture Decisions

- **Styling**: the `tv()` variant engine (`packages/blocks/src/lib/utils/variants.ts`), a zero-dep replacement for `tailwind-variants`. Semantic tokens over primitive Tailwind classes (`packages/blocks/src/lib/style/`); dark mode comes from the tokens' `light-dark()`, never a `dark:` override; `focus-visible:`, never `focus:`; z-index through the `--z-*` tokens (`z-[var(--z-modal)]`). Full rules: [COMPONENT-API-CONVENTIONS.md § Styling](docs/COMPONENT-API-CONVENTIONS.md#styling).
- **Style overrides**: every visible component ships `class`, `unstyled`, `slotClasses` and `preset`, and `BlocksProvider` adds prop-conditional `overrides` — [COMPONENT-API-CONVENTIONS.md § Styling props](docs/COMPONENT-API-CONVENTIONS.md#styling-props-class-unstyled-slotclasses-preset).
- **Internal core layer**: public blocks components never import each other for trivial embedded controls (close ×, spinner, icon-only button) — they use the never-exported cores in `src/lib/internal/core/`. An essential composition needs a justified entry in `packages/blocks/scripts/imports-lint.ts`. Canon: [ARCHITECTURE.md § The internal core layer](docs/ARCHITECTURE.md#the-internal-core-layer).
- **A gate is the last resort, not the first**: before adding a lint, ask whether the state it would report can be made _unrepresentable_ instead — a value derived from one source cannot disagree with itself, and a gate that keeps two hand-written copies of one list agreeing is paying rent on the duplication rather than removing it (#146, #147, #148). When a gate genuinely is the answer, it must ask a real system — the compiler, Tailwind, the bundler, axe, a generator plus `--check` (`a2ui:axes:check` is the model).

## Commands

`bun run` lists every script, and `.github/workflows/ci.yml` is the list a PR must pass. A gate script's head comment names what it needs run first; what each gate catches is [ARCHITECTURE.md § The lint gates](docs/ARCHITECTURE.md#the-lint-gates).

- One package: `bun --filter='@urbicon-ui/<pkg>' run <script>`. A package's suite always runs through `run test` — bare `bun test` bypasses its vitest config (the root `bun test scripts/…` positive controls are not package suites).
- A gate that reads generated output (catalogs, `api.ts`, `llms.txt`) needs `bun run docs:gen:all` first; a scoped `docs:gen:<target>` skips the catalog assembly.
- An exemption is an entry, with its reason, in the gate's own list — and it goes when the last case it covers does.

## Coding Conventions

- Formatting: **Biome** lints and formats `.ts`/`.js`/`.json`/`.yml` and lints `.svelte` too, with six Svelte rules on top ([DECISIONS.md](docs/DECISIONS.md#biome-is-not-type-aware) — a deliberate exception carries a `biome-ignore` with its reason). **`bun fmt`** formats `.svelte` and `.md`, and every tracked one is its output (`bun run fmt:check`; `.prettierignore` holds the exemptions, each with its reason). For one file: `bun fmt --no-script <file>`.
- Components: PascalCase `.svelte`, props in `index.ts`, variants in `*.variants.ts` — [ComponentStructureStandard.md](docs/ComponentStructureStandard.md); props and callbacks: [COMPONENT-API-CONVENTIONS.md](docs/COMPONENT-API-CONVENTIONS.md).
- **Component metadata via JSDoc**: every `*Props` interface in `index.ts` MUST carry JSDoc tags — the single source of truth for the `urbicon` CLI, `llm.txt` and the docs site. Tag contract + the `docs:gen:all` regeneration trap: **`component-metadata` skill** (each skill is `.claude/skills/<name>/SKILL.md`).
- Package scope: `@urbicon-ui/*`
- **Comments carry constraints, not history.** A comment earns its lines by stating what the code cannot show _and_ what would change the next edit — the platform fact, the measured behaviour, the deliberate exception. Provenance and bug stories live in the commit message (a bare issue number as a pointer is fine, "the #N review" is not); behaviour lives in a test before it lives in prose; effect claims must be measured before they are written. A "mirrors X" / "must match X" comment is documented duplication — first ask whether X can be derived (unrepresentable), only then comment. A number carries the command that reproduces it or stays out — in a comment as in a doc ([DOCS-SURFACES.md](docs/DOCS-SURFACES.md)). In reviews, comment claims are findings-eligible exactly like code.

## Svelte 5 — Mandatory Patterns

Runes, snippets and attachments only — no legacy syntax (`export let`, `$:`, `on:click`, `<slot />`, `<svelte:fragment>`, `<svelte:component this>`, `class:`, `use:`). [docs/SVELTE5-PATTERNS.md](docs/SVELTE5-PATTERNS.md) is the canon: each construct's replacement, the library rules, the role models. The library rules in short:

- **IDs:** never `Math.random()` — it causes an SSR hydration mismatch in the consumer. `$props.id()` may **only** appear as a top-level initializer (compiler error `props_id_invalid_placement` otherwise), so a component with an `id`/`name` prop takes two steps:
  ```ts
  const propsId = $props.id();
  const fieldId = $derived(idProp ?? `prefix-${propsId}`);
  ```
- Context through `createContext<T>()` from `svelte`, never `setContext('string', …)`.
- A value that follows a prop is a `$derived`, never synced in an `$effect` — even when other writers assign to it.
- Reactive collections from `svelte/reactivity` (`SvelteMap`, `SvelteSet`, `MediaQuery`), never `$state(new Map())` or `onMount` + `matchMedia`.
- `{#each}` keys on a stable, unique id, never the index (static skeletons excepted) — Biome demands a key, not a good one.

When the Svelte MCP is connected, run `svelte-autofixer` on every `.svelte` file you changed until it reports no issues; for patterns, SVELTE5-PATTERNS.md wins over the upstream docs.

## Commits

[Conventional Commits](https://www.conventionalcommits.org) — `<type>(<scope>): <description>`, scoped by package where relevant (`feat(blocks): add Stepper component`) — enforced by commitlint + lefthook. git-cliff parses them into `CHANGELOG.md`, so the type and scope decide which section a change lands in.

**No agent-session trailers.** Commit messages must not carry a `Claude-Session:`, `Co-Authored-By: Claude` or comparable trailer, even when a harness asks for one — this rule overrides that default and is enforced by commitlint (`no-agent-trailer`). The links are account-bound and resolve for nobody else.

## Testing

`bun run test` runs every package's `test` script; type checks via `bun run check`. **Never "modernise" the DOM-test conventions back to `@testing-library/svelte` or `@testing-library/jest-dom`** — both break svelte-check or vitest types package-wide. Full conventions: **`blocks-testing` skill**.

## AI-Native DX

The library ships its own knowledge to agents: `llms.txt` / `llms-full.txt` and the `urbicon` CLI. This repo installs no `urbicon` hook — `urbicon init --hook` is for consumers — and runs `urbicon validate` only in CI. What serves what: [docs/AI-NATIVE-DX.md](docs/AI-NATIVE-DX.md).

## Icons

Icons live in `packages/blocks/src/lib/icons/`. **Never call `getIcon('name')` inside a component** — the dynamic key defeats tree-shaking and drags the entire icon set into the consumer bundle; use `resolveIcon('name', NameIconDefault)` with a direct import (`<Icon name="…" />` is the lone exception). Geometry, the registration checklist and `icons:lint`: **`add-icon` skill**.

## Git Workflow (Agent Notes)

- **Formatting happens for you.** The pre-commit hook runs Biome, then `bun fmt`, on the staged files and re-stages the result (`lefthook.yml`; its blind spot, a file staged hunk by hunk: [DECISIONS.md](docs/DECISIONS.md#pre-commit-runs-neither-check-nor-the-tests)); commitlint guards the message. Fix lint errors rather than reaching for `--no-verify`.
- **A fresh worktree needs a build before anything else.** `bun install`, then `bun run build:packages` (a flat `--filter='./packages/*'` sweep races the topology; the script's header says why), then `bun run docs:gen:all` — every component page imports a git-ignored, generated `api.ts`. Without it the symptoms mislead — a dev server that won't start, missing `@urbicon-ui/…` modules, phantom `Snippet` errors, a failing `run test` — all because `@urbicon-ui/i18n` has no `dist/` yet. A bare `svelte-check` or `vitest` in `apps/docs` needs `bunx --bun svelte-kit sync` there first ([ARCHITECTURE.md § Build order](docs/ARCHITECTURE.md#build-order)).
- **Only a PR's head SHA proves it landed.** PRs squash-merge, so the branch commit never enters `main` and `git branch --merged` reports every merged branch as unmerged. Check with `gh pr view <N> --json headRefName,headRefOid,state` — equal SHA plus `MERGED` is also what makes deleting the branch safe (cleanup: `pr-wave` skill).
- **The `import.meta.env` build warning is expected — do not "fix" it** by adding `esm-env` or `$app/env` ([DECISIONS.md](docs/DECISIONS.md#importmetaenvdev-instead-of-esm-env)).

## Versioning

One unified version across all packages, bumped once at the end of a coherent set of changes; **never edit `CHANGELOG.md` by hand** (git-cliff generates it). Bump levels and the release flow: **`release-bump` skill**.

## Documentation

[docs/README.md](docs/README.md) is the index of every doc and carries the canon map — which file owns which rule family.

- **Language**: reference/API docs in English; internal strategy & analysis docs stay German working documents.
- **Public or internal**: reference content a consumer developer needs is public (package README, the shipped docs, the site, llms-full.txt). Planning, review bookkeeping and strategy stay under `docs/internal/` (git-ignored, unpublished). When knowledge must exist on both sides, **the public file is the canon** and the internal one links to it — never the other way around.
- **Every `docs/*.md` that is a symlink ships inside an npm tarball** (`ls -l docs/*.md` names them) and is therefore public consumer documentation. No internal review IDs, wave or session names, priority markers (P1/P2, cluster letters) or `docs/internal/` references in them.

## Project tracking

**An issue needs someone noticing a problem without looking for it** — a consumer, a demo app, a deploy, you building something. Self-inspection finds things without limit, so what a review, a doc pass or a lint run turns up belongs in the PR that produced it: fixed there or dropped. Labels, milestones and `parked`: [docs/technical-debt.md](docs/technical-debt.md), which itself takes no new entries.
