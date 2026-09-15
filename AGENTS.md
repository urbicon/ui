# Repository Guidelines

## Project Structure

Svelte 5 + Tailwind CSS 4 UI component library monorepo on Bun workspaces.

- Root is a Bun workspace (`"private": true`). Source in `packages/*`:
  - `blocks`: Svelte UI components
    - `primitives`: Atomic UI components
    - `components`: complex UI widgets built on top of the primitives
  - `table`: Data table (sorting, filtering, grouping, selection, keyboard-nav, virtualization, column reorder, remote mode, live updates)
  - `docs`: Reusable documentation UI components
  - `docs-gen`: Documentation generator (TypeScript CLI, extracts props/variants from AST)
  - `mcp-server`: Model Context Protocol server for LLM-driven development; manifest read/write lives in the `urbicon` CLI (`@urbicon-ui/design`), not the remote server
  - `i18n`: Localization (Svelte 5 runes-based); also ships a data-level translation audit and a dev-only `@urbicon-ui/i18n/audit` source scanner (unused / used-but-undefined keys, hardcoded strings), fronted by `urbicon i18n` and `bun run i18n:check` (which scans `blocks`, `table` and `docs` — `auth` keeps its own locale system, and its oracle is `translations.parity.test.ts` plus `satisfies AuthLocale`)
  - `shared-types`: docs-tooling types (playground, docs-config, navigation) — a peer of `@urbicon-ui/docs` and a dependency of `docs-gen`, nothing else; `blocks` and `table` reference its `globals` augmentation only while type-checking their own sources
  - `sveltekit-utils`: SvelteKit helper utilities (`createCronRunner`, URL-state runes)
  - `design`: the `urbicon` CLI (`@urbicon-ui/design`) — local design-loop enforcement (validate/hook/context/record-decision/sync-manifest/i18n/verb), ships the design skill + templates
  - `sv`: Svelte-CLI community add-on (`@urbicon-ui/sv`, beta) — `sv add @urbicon-ui` installs blocks + design, wires the Tailwind stylesheet after Tailwind's own, then hands over to `urbicon init --hook`. **The only SvelteKit-bound consumer path** (`unsupported('Requires SvelteKit')`) — not a library limit but a wiring one, see the comment in `src/index.ts`
  - `design-content`: versioned design knowledge bundle (`@urbicon-ui/design-content`) consumed by the remote MCP server + the `urbicon` CLI; `content/` is a git-ignored build artifact emitted by docs-gen
  - `design-engine`: zero-dep design linter / manifest parser / rubric (`@urbicon-ui/design-engine`), subpath exports `./linter` `./manifest` `./rubric`
  - `auth`: Authentication & user management (JWT sessions, refresh-token rotation, passkeys/WebAuthn, notifications, email)
    - Zero runtime dependencies — Web Crypto API for JWT, PBKDF2, WebAuthn (CBOR, ECDSA, RSA), Web Push (RFC 8291/8292)
    - Server: handler factories, handle hook, adapter pattern (Prisma adapter included). Client: Svelte 5 Runes stores, blocks-based UI, own i18n (EN/DE)
- Apps in `apps/docs` (documentation site) and `apps/artifact-studio`
- Build artifacts: `dist/`, `.svelte-kit/` (git-ignored)

## Key Architecture Decisions

- **Styling**: Custom `tv()` variant engine (`packages/blocks/src/lib/utils/variants.ts`, zero-dep replacement for `tailwind-variants`)
- **Design Tokens**: OKLCH color system with 3-layer architecture (foundation → semantic → interaction) in `blocks/src/lib/style/`
- **Dark Mode**: Semantic tokens handle dark mode automatically via the CSS `light-dark()` function (follows `color-scheme` / the user's `prefers-color-scheme`); no manual `dark:` overrides
- **Focus**: `focus-visible:` everywhere (not `focus:`), for keyboard-only focus rings
- **Z-Index**: CSS custom property tokens (`--z-modal`, `--z-dropdown`, etc.) via `z-[var(--z-*)]`
- **Components**: All support `unstyled` + `slotClasses` + `preset` props for style overrides; `BlocksProvider` additionally accepts prop-conditional `overrides` (style only a specific variant/intent/state, e.g. the `outlined` variant)
- **Internal core layer**: Public blocks components never import each other for trivial embedded controls (close ×, loading spinner, icon-only nav button) — they use the never-exported cores in `src/lib/internal/core/` (`ls` it for the roster). Essential compositions (ConfirmDialog→Dialog) stay direct imports but need a justified allowlist entry in `packages/blocks/scripts/imports-lint.ts`; `imports:lint` errors on unknown edges AND stale entries. Canon: [ARCHITECTURE.md § The internal core layer](docs/ARCHITECTURE.md#the-internal-core-layer).
- **A gate is the last resort, not the first**: before adding a lint, ask whether the state it would report can be made *unrepresentable* instead — a value derived from one source cannot disagree with itself, and a gate that keeps two hand-written copies of one list agreeing is paying rent on the duplication rather than removing it (#146, #147, #148). When a gate genuinely is the answer, it must ask a real system — the compiler, Tailwind, the bundler, axe, a generator plus `--check` (`a2ui:axes:check` is the model).

For full details see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

`bun run` lists every script. Non-obvious ones:

- Single package: `bun --filter='@urbicon-ui/blocks' run <script>` (bare `bun test` bypasses a vitest config — always `run test` for a package's suite)
- `size` — per-component tree-shaken min+gzip across blocks/table/auth; needs all three `dist/`. Gates only at the release bump (`--check` against `bundle-size.baseline.json` in `scripts/bump.sh`); `--update-baseline` after intentional growth, staged into the release commit. CI's `size-report` job runs it per PR without `--check`, as a report. The `net` column: [ARCHITECTURE.md § Bundle size](docs/ARCHITECTURE.md#bundle-size)
- `shots` — the README views (`.github/assets/`) + `static/og.png`, against a **running** docs-app dev server (`SHOTS_BASE`, default `:5174`); it starts none. og.png is the fixture `test-fixtures/og`, not a page screenshot; a second copy lives in the urbicon website repo. Why locale, motion and frame are pinned: head of `scripts/capture-shots.ts`
- `variants:lint` — dead-token guard over all tv() configs, plus a bucket-agreement pass over what the Tailwind compiler says each class declares: a class family `BUCKET_PATTERNS` has no pattern for fails, as does a bucket whose classes write different properties. The rest: `packages/blocks/scripts/variants-lint.ts`. · `imports:lint` — cross-component import guard (see Key Architecture Decisions)
- `consumer-css:check` — a package can ship `.svelte` whose Tailwind classes no consumer ever compiles, and `apps/docs` cannot notice (#314). Builds a consumer out of the packed tarballs and asks Tailwind itself; a package that ships styled markup but exports no `./style/index.css` fails as exactly that. Runs in the `build` job (needs `dist/`); positive controls `bun test scripts/consumer-css-check.test.ts` (`test` job). How it asks: head of `scripts/consumer-css-check.ts`
- `docs:fences:lint` — compiles the opted-in `ts` fences of every `packages/*/README.md` and `packages/*/docs/*.md` against a throwaway consumer project, so imports resolve through the published exports map — the class of error `examples:lint` cannot see. A fence opts in per `<!-- typecheck -->` on the line above it. Needs `build:packages` first; runs in `gates`. Marker rules and ambient declarations: head of `packages/docs-gen/scripts/doc-fences-lint.ts`
- `summary:lint` — component `@summary` budget · `playgrounds:lint` — playground snippets **and** the knob-hint budget (a knob whose hint runs past 120 chars needs a prop-level `@summary`; see the `component-metadata` skill). Both read the generated catalogs, so run `docs:gen:all` first
- `registry:lint` — a docs page is hand-registered in three places (sidebar, `componentLinks`, recipes cookbook) and forgetting one is silent; checks all three against the routes and the catalogs, a deliberate omission needs an `UNLISTED` / `PAGELESS` entry with a reason, stale entries are errors too. Reads the generated catalogs — `docs:gen:all` first. What each registry feeds: its script header
- `examples:budget` — the 2–4 `<CodeExample>` budget per component page (`docs/DocsPageGuide.md` XC-6), in the `gates` job. **Not** `examples:lint` (that one type-checks `@example` JSDoc). Exemptions are `OVERSIZE_OK` / `NO_EXAMPLES` entries with a reason; stale ones are errors. Which sections count: head of `apps/docs/scripts/example-budget-lint.ts` (+ `.rules.ts`)
- `sections:lint` — catches a docs page's TOC links, sections and nav order disagreeing: a link that scrolls nowhere, a section no TOC entry reaches. Reads no generated output, so it runs standalone
- `typesref:lint` — a component page documents its types in two hand-written halves (`types=` on `<ApiReference>`, a `<TypesReference>` section), each silent without the other; enforces both directions and that both read the **same** `componentData` from the page's own `'./api'`. Exemptions: `NO_PAGE`. Reads the generated api.ts — `docs:gen:all` first. **Not** `types:guard` (that one is declaration emit). Which slips that catches: head of `apps/docs/scripts/typesref-lint.ts`
- `examples:lint` — type-checks every `@example` block of every `*Props` JSDoc (blocks/table/auth/docs) as a real `.svelte` file through `svelte-check`. Slow and needs the workspace deps built — a pre-merge/pre-bump gate, not a per-commit one. A consumer-context component in an example (`<SettingsForm>`) needs a `PLACEHOLDERS` entry in `packages/docs-gen/scripts/examples-lint.ts`; stale entries are errors (same contract as `imports:lint`). The same run compiles every `svelte` fence of `design-system/patterns/*.md` as a whole component, with nothing exempt — `urbicon pattern` serves those verbatim. Positive control: `bun test packages/docs-gen/scripts/examples-lint.test.ts` (own step in the `test` job)
- `docs:gen:all` — root `bun run docs:gen` already defaults to this; a scoped `docs:gen:<target>` skips the MCP catalog assembly
- `llms:check` — `git diff --exit-code` over `llms.txt` and its `apps/docs/static/` copy: both must equal what the last `docs:gen` wrote. Run `docs:gen` first; the check has no build step of its own, it only asks git

## Coding Conventions

- Lint/format: **Biome** for `.ts`/`.js`/`.json` (`biome.json` extends `@urbicon-ui/biome-config`); **Prettier** for `.svelte` only (single quotes, width 100, no trailing commas) + `svelte-check`. Biome does not parse `.svelte`.
- **Four `.svelte` lint rules are unenforced** — Biome cannot parse `.svelte`, so the `{@html}` XSS guard, each-key, `prefer-svelte-reactivity` and `no-navigation-without-resolve` are on you; re-add a `.svelte`-only ESLint pass if they regress ([DECISIONS.md](docs/DECISIONS.md#biome-is-not-type-aware)).
- Components: PascalCase `.svelte`, props in `index.ts`, variants in `*.variants.ts`
- **Component metadata via JSDoc**: every `*Props` interface in `index.ts` MUST carry JSDoc tags — the single source of truth for the MCP server, `llm.txt` and the docs site. Tag contract + the `docs:gen:all` regeneration trap: **`component-metadata` skill**.
- Package scope: `@urbicon-ui/*`
- Use semantic design tokens over primitive Tailwind classes
- **Comments carry constraints, not history.** A comment earns its lines by stating what the code cannot show *and* what would change the next edit — the platform fact, the measured behaviour, the deliberate exception. Provenance and bug stories live in the commit message (a bare issue number as a pointer is fine, "the #N review" is not); behaviour lives in a test before it lives in prose; effect claims must be measured before they are written. A "mirrors X" / "must match X" comment is documented duplication — first ask whether X can be derived (unrepresentable), only then comment. A number carries the command that reproduces it or stays out — in a comment as in a doc ([DOCS-SURFACES.md](docs/DOCS-SURFACES.md)). In reviews, comment claims are findings-eligible exactly like code.

Full references: [COMPONENT-API-CONVENTIONS.md](docs/COMPONENT-API-CONVENTIONS.md) (props, callbacks, styling) · [ComponentStructureStandard.md](docs/ComponentStructureStandard.md) (file structure).

## Svelte 5 — Mandatory Patterns

Full reference with examples, role models and grep targets: [docs/SVELTE5-PATTERNS.md](docs/SVELTE5-PATTERNS.md).

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
- **Reactive collections:** wrappers from `svelte/reactivity` (`SvelteMap`, `SvelteSet`, `MediaQuery` — instance-local, not the module-global `svelte/reactivity/window`)

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org). Enforced via commitlint (`@urbicon-ui/commitlint-config`) + lefthook.

Format: `<type>(<scope>): <description>`

Common types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `build`, `ci`, `perf`

Scope by package when relevant: `feat(blocks): add Stepper component`

git-cliff parses them into `CHANGELOG.md`, so the type and scope decide which section a change lands in.

**No agent-session trailers.** Commit messages must not carry a `Claude-Session:`, `Co-Authored-By: Claude` or comparable trailer, even when a harness asks for one — this rule overrides that default and is enforced by commitlint (`no-agent-trailer`). The links are account-bound and resolve for nobody else, so in a public repo they are dead weight in every message.

## Testing

Vitest runs in every package that has a `vitest.config.*` (`bun --filter=<pkg> run test`); type checks via `bun run check`.

**Never "modernise" the DOM-test conventions back to `@testing-library/svelte` or `@testing-library/jest-dom`** — both break svelte-check or vitest 4 types package-wide. Full conventions: **`blocks-testing` skill**.

## AI-Native DX

The library ships its own knowledge to agents: `llms.txt` / `llms-full.txt`, the **`urbicon`
CLI** (`packages/design`, the consumer surface) and a remote MCP adapter over the same engine.
`urbicon validate` gates the loop by linting generated markup. In this repo it runs only in CI,
against `packages/docs/src/lib/components` and `apps/docs/src` (`.github/workflows/ci.yml`); the
`PostToolUse` hook is what `urbicon init --hook` installs for *consumers*, not something this
repo uses.

Which command serves what, the `init` contract, why the MCP endpoint stays unhosted before
launch: [docs/AI-NATIVE-DX.md](docs/AI-NATIVE-DX.md).

## Icons

Icons live in `packages/blocks/src/lib/icons/`. **Never call `getIcon('name')` inside a component** — the dynamic key defeats tree-shaking and drags the entire icon set into the consumer bundle; use `resolveIcon('name', NameIconDefault)` with a direct import (`<Icon name="…" />` is the lone exception). Geometry, the registration checklist and `icons:lint`: **`add-icon` skill**.

## Git Workflow (Agent Notes)

- **Formatting happens for you.** The lefthook pre-commit hook runs `biome check --write` on staged `.ts`/`.js`/`.json` and `prettier --write` on staged `.svelte`, re-staging the results (see `lefthook.yml`); commitlint guards the message. Fix lint errors rather than reaching for `--no-verify`. The package `format` script is only for `.svelte` you have **not** staged (a whole-package sweep).
- **A fresh worktree needs a build before anything else.** `bun install`, then `bunx --bun svelte-kit sync` (blocks, docs-app), then `bun run build:packages` (a flat `--filter='./packages/*'` sweep races the topology; the script's header says why). Without it the symptoms mislead — a dev server that won't start, missing `@urbicon-ui/…` modules, phantom `Snippet` errors, a failing `run test` — all because `@urbicon-ui/i18n` has no `dist/` yet. `api.ts` is git-ignored, so `docs:gen` too.
- **Worktree merges**: `main` is checked out in the root worktree. Merge without leaving yours via `git -C <repo-root> merge <branch>` — this is the orchestrator's move from its own worktree; implementation subagents inside a `pr-wave` never run `git -C` on the main checkout. Stash there first if that tree is dirty.
- **Only a PR's head SHA proves it landed.** PRs squash-merge, so the branch commit never enters `main` and `git branch --merged` reports every merged branch as unmerged. Check with `gh pr view <N> --json headRefName,headRefOid,state` — equal SHA plus `MERGED` is also what makes deleting the branch safe. Cleanup removes the branch, its worktree and the `worktree-*` scaffolding branch the tooling creates (that one never merges on its own), then `git worktree prune`.
- **No Markdown is prettier-gated** — not root `docs/*.md` and `AGENTS.md`, not package Markdown (`packages/*/README.md`, `packages/*/docs/*.md`). Match a file's existing style for surgical diffs; never blindly `prettier --write`, it re-aligns whole tables. Keep package Markdown prettier-clean by hand instead: `bunx prettier --check` on every file you touch, and a file that already fails must not gain a violation.
- **The `import.meta.env` build warning is expected — do not "fix" it.** `blocks` uses optional-chained `import.meta.env?.DEV` instead of `esm-env`, which would be a runtime dependency in the published `dist/` and break the zero-dependency maxim. The `@sveltejs/package` advisory is a plain string match, so it fires anyway. Never resolve it by adding `esm-env` or `$app/environment`.

## Versioning

One unified version across all packages, bumped once at the end of a coherent set of changes — **never on a dirty tree**, and **never edit `CHANGELOG.md` by hand** (git-cliff generates it). Bump levels, tag/push flow, commit-type → changelog mapping: **`release-bump` skill**.

## Documentation

**The index of every doc is [docs/README.md](docs/README.md)** — one index, not two. It carries the reading order, one line per file, and the canon map: which file owns which rule family. This section keeps only the rules that govern writing docs.

- **Language**: reference/API docs in English; internal strategy & analysis docs stay German working documents.
- **Public or internal**: reference content a consumer developer needs is public (package README, the shipped docs, the site, llms-full.txt). Planning, review bookkeeping and strategy stay under `docs/internal/` (git-ignored, unpublished). When knowledge must exist on both sides, **the public file is the canon** and the internal one links to it — never the other way around.
- **Every `docs/*.md` that is a symlink ships inside an npm tarball** (`ls -l docs/*.md` names them) and is therefore public consumer documentation. No internal review IDs, wave or session names, priority markers (P1/P2, cluster letters) or `docs/internal/` references in them.

## Project tracking

- **An issue needs someone noticing a problem without looking for it** — a consumer, a demo app, a deploy, you building something. Self-inspection finds things without limit, so what a review, a doc pass or a lint run turns up belongs in the PR that produced it: fixed there or dropped. "Filed here so it survives the PR being merged" is the sentence that must stop being written.

- **`parked`** — closed, but the finding stands; nobody was hurt by it. `gh issue list --state closed --label parked` brings the set back, bodies and comments intact. Reopen when it costs someone something real. Prefer parking to a low priority: an open list of sixty crushes regardless of which number sits beside each entry.

- [docs/technical-debt.md](docs/technical-debt.md) is only a pointer plus the resolved-entry trace, so **do not add new entries to that file**. Actively planned work lives in the internal TODO (docs/internal/) instead.

- **Every issue carries four label axes**, set when it is opened (`enhancement` issues carry no `debt:` axis) — a new issue with only a `debt:` label erodes the taxonomy:

  | axis | values | meaning |
  | --- | --- | --- |
  | `debt:<area>` | the existing values as in `gh label list` | the topic |
  | `pkg:<package>` | the package name as in `gh label list` | where it lives (multiple allowed) |
  | `prio:P1\|P2\|P3` | **P1 = someone comes to harm**: a security hole, wrong data, a crash, a keyboard trap. Not "touches shipped code" — in a library every line does | the order |
  | `size:S\|M\|L` | a session · about a day · a wave | the cost |

  Plus two state labels: **`ready`** — the path is clear, no open design decision — and `blocked:upstream`. **`ready` is deliberately the positive label**: nearly every deferred finding ends in "wants a decision", so a `needs-decision` label would sit on ~75 % of the backlog and sort nothing. The useful question is what can be picked up right now (`gh issue list --label ready`). There is no P0; that channel stays free for an actual fire.

- **Milestones are cut by work focus, not by urgency** — touching Calendar once beats touching it four times; `prio:` carries the order instead. Every issue sits in exactly one, and every milestone has a description saying why its issues belong together. `gh api repos/:owner/:repo/milestones --jq '.[].title'` lists them; put a new issue in one rather than leaving it unassigned.

- **Cross-links go in the body**, as a `**Related:**` block after a `---` at the end, and are worth writing when the connection crosses a milestone — that is exactly what the milestone view cannot show.

- The board is [UI Backlog](https://github.com/users/urbicon/projects/1) (Priority / Size / State mirror the labels). It is a view, not a second source of truth: **labels stay authoritative**, the board is regenerated from them.

## Task-scoped skills

Repo procedures live in `.claude/skills/` and load on demand: `blocks-testing` (test conventions), `component-metadata` (JSDoc contract for `index.ts` + JSDoc-vs-page placement), `add-icon` (icon contract + registration), `release-bump` (version/release flow), `docs-recipes` (recipe + component doc pages), `docs-writer` (driving a docs-page write/migration), `docs-editor` (editing pass for docs prose — never in the context that wrote it), `architecture-probe` (auditing a package's architecture — five sondes, never a judgement), `pr-wave` (implementing a set of issues as reviewed PRs), `knowledge-audit` (auditing memory, instructions and docs for entropy — the four checks and when they are worth running).
