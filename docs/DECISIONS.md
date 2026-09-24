# Conscious Trade-offs

Decisions recorded here so they are not repeatedly questioned or accidentally "corrected".
Each one looks like an oversight from the outside and is not.

If you are about to fix something on this list, the burden is to show the trade-off has
changed — not that the current state is imperfect. It is.

---

## Biome is not type-aware

Linting uses **Biome**, which does not consult the TypeScript type checker. Rules needing
type information (no-floating-promises, await-thenable, …) therefore do not apply.

This is a performance decision. Biome lints the whole repo in milliseconds; type-aware
linting would make every `lint` run and the pre-commit hook several times slower. Floating
promises and similar issues are caught by TypeScript itself (`strict`, `noImplicitAny`,
`strictNullChecks`) and in review.

**Known consequence:** Biome cannot parse `.svelte` at all. Four rules were lost in the
ESLint → Biome migration and are not currently enforced anywhere: `svelte/no-at-html-tags`
(the `{@html}` XSS guard), `svelte/require-each-key`, `svelte/prefer-svelte-reactivity`,
`svelte/no-navigation-without-resolve`. If these regress, the fix is a `.svelte`-only
ESLint pass alongside Biome — not abandoning Biome.

## Pre-commit runs neither `check` nor the tests

The lefthook pre-commit hook runs `biome check --write` (staged `.ts`/`.js`/`.json`) and
`prettier --write` (staged `.svelte`) — no `svelte-check`, no Vitest.

`svelte-check` across all packages takes 30–60 s and would noticeably block every commit;
tests are CI's job. The consequence — `svelte-check` errors surface only in CI — is
acceptable because CI failures reproduce locally in seconds.

## `mcp-server` ships without a build step

`packages/mcp-server` has `main: "./src/index.ts"` and no `dist/`. It is always started via
Bun (a dev tool, never an npm-consumed runtime), so shipping TypeScript sources directly
works. The upside is no build pipeline and no sync step for a purely dev-time tool. Its
README states this explicitly — anyone expecting Node would otherwise trip over the `.ts`
entrypoint.

## Stricter TS flags are not raised centrally

`tsconfig.base.json` holds the shared baseline (`strict`, `esModuleInterop`,
`moduleResolution`, `allowJs`/`checkJs`, …). Of the seven `tsc`-checked packages, six raise
stronger flags: `noUncheckedIndexedAccess` and `verbatimModuleSyntax` in `design`,
`design-content`, `design-engine`, `docs-gen`, `mcp-server` and `sv`, plus
`exactOptionalPropertyTypes` in `docs-gen` alone. The seventh, `shared-types`, is built the
same way and raises none of them — it declares types and has nothing to index or narrow.

Raising them centrally would mean migrating the SvelteKit packages, and that effort is not
yet justified.

## `import.meta.env?.DEV` instead of `esm-env`

The library build emits a `@sveltejs/package` advisory: *"Avoid usage of `import.meta.env`"*.
It is intentional and harmless.

`blocks` uses optional-chained `import.meta.env?.DEV` (safe in non-Vite consumers) rather
than `esm-env`, because `esm-env` would become a **runtime dependency in the published
`dist/`** and break the zero-dependency maxim. The advisory is a plain string match, so it
fires even with the optional chain.

**Never resolve it** by adding `esm-env` or `$app/environment`.

## The tv() engine is narrower than `tailwind-variants`

The zero-dependency replacement in `packages/blocks/src/lib/utils/variants.ts` deliberately
implements a subset: bucket-equality conflict resolution plus directional shorthand
dominance, not the full `twMerge` conflict map.

Classes outside `BUCKET_PATTERNS` never participate in stripping; `decoration-*` splits
across three orthogonal buckets; `text-size` → `line-height` dominance is deliberately
absent (the library pairs slot-base `leading-*` with axis-supplied text sizes by design).

The subset is a decision, but a silent one was not: `variants:lint` compares the table
against the compiler — a missing family over the classes the library ships, a bucket whose
classes write different properties over Tailwind's whole class list too — so it is reported
rather than discovered by a consumer whose override does not land. Deriving the table from
the compiler instead was measured and rejected — it is a breaking change and costs +7.8 KB
gzip in every consumer bundle, while the gate ships nothing.

Two other override architectures were weighed and not built. **Cascade layers** (`@layer`)
would make the conflict unrepresentable instead of computed: one declared layer order decides,
per property, with no vocabulary to maintain. Two redesigns drafted independently from the
requirements alone, without sight of the current mechanism, both chose it. It is a new
styling contract rather than a change to this one — the library would ship its own layered
stylesheet instead of Tailwind utilities in its markup, a migration across every component and
every documented override route. A **runtime reading of the CSSOM** is ruled out: the engine
also runs during server rendering, where there is no `document.styleSheets`, so server and
client would merge differently.

If a future change genuinely needs full `twMerge` semantics, extend `variants.ts` — do not
re-introduce `tailwind-variants`. See
[ARCHITECTURE.md § The tv() variant engine](ARCHITECTURE.md#the-tv-variant-engine).

## A theme is a token file, or it is not a theme

A theme rebinds custom properties in the three token layers (foundation → semantic →
interaction) and reaches the docs chrome through the declared `data-docs-*` hooks. If a look
needs component code, a new variant, or an `if (theme === …)` branch, it is not a theme and
does not ship as one.

This is why there is no `glass` or `filled` Card variant — both existed and were removed in v5.
Aesthetics that cannot be expressed as tokens stay reachable through `unstyled` /
`slotClasses`, which makes them the consumer's call rather than a maintained surface.

Two consequences, because both look like gaps from the outside:

- **Structural aesthetics need a generic token, never a theme-specific branch.** A resting glow
  would take one bounded token set that primitives opt into generically. That set is not
  being built: shipping an aesthetic skin was decided against in 2026-08, and without one the
  investment has no consumer. Blur is the exception that already has its token —
  `--blocks-overlay-backdrop-blur`, read by every backdrop — while a resting glow has none,
  so a neon look stays a consumer's `class`/`slotClasses` job.
- **Brand themes are unbounded; full aesthetic identities are not.** Palette, accent hue and
  radius cost one file each under `style/themes/`, so there can be any number. Density is not
  one of them: it is a component prop (`size`, or `density` where a component has one), because
  the geometry lives in the Tailwind utilities the variants write, not in tokens a file could
  rebind. Two table density theme files were shipped as if it could be, and deleted in 2026-08:
  every one of their seven overrides was a variable nothing read. A complete visual identity is
  a larger one-time token investment, and those stay a small curated set — never an open
  "any aesthetic" engine.

The proof that the boundary holds is in the repo: the Color Rooms skin
(`apps/docs/src/lib/style/rooms*.css`) carries a complete identity — own paper, ink, intent
ramps, typography, first-class light and dark via `light-dark()` — as a scoped token override
with no parallel component tree.

## Deliberately not in the catalog

A component the library lacks is not automatically a gap. These were weighed and left out:

- **Layout primitives** (Stack, Grid, AspectRatio, VisuallyHidden) — Tailwind's job, and
  `sr-only` for the last one.
- **A rich-text editor** — not seriously buildable without ProseMirror or Tiptap, which breaks
  the zero-dependency rule.
- **Kanban and Gantt** — at most a recipe over existing components.
- **Voice/persona UI, transfer lists, cascaders** — too far from the core, or no demand in the
  target segment.
- **A carousel.** Auto-rotating slides are a long-documented usability anti-pattern: motion
  the reader did not start competes with reading. The heavier reason is this
  library's own: it ships a linter and a primer that steer agents, and a component whose main
  function is a known anti-pattern would be used by them the moment it exists — anything named
  `Carousel` gets used as one. `Scroller` is an overflow behaviour and never rotates. If
  rotation is ever needed, it is opt-in only, with a pause control that cannot be switched off
  (WCAG 2.2.2), a stop on hover and focus, and `prefers-reduced-motion` honoured.
- **A pager as a `Scroller` mode.** One item at a time diverges from a scrolling row on all
  three axes — ARIA (slides in a carousel vs. a group), keyboard (paging vs. scrolling), state
  (active index vs. scroll position) — so a `mode` prop would be two components in one coat.
  A pager is its own component, built when a real case appears; until then `Tab` covers one
  item at a time.
- **Stateless layout compositions** such as a page header — no state, no variants, no
  behaviour — are recipes, not components; the page header is one.

**Revisit only if:** a consumer asks for one, with the use case rather than the name.

## Positioning stays in JavaScript

Anchored overlays — Popover (and Menu and DatePicker through it), Select, Combobox, Tooltip,
the Guide — are placed by `packages/blocks/src/lib/utils/floating.ts`, a zero-dependency
`computePosition` with middleware and `autoUpdate`. Two platform features would replace parts
of it and are held back:

- **CSS Anchor Positioning** is Baseline only as *newly* available. Browsers without it are
  still in use, so the JS path would have to stay beside it — adopting it now adds a second
  positioning path instead of removing one.
- **`popover="hint"`** for Tooltip is blocked by Safari, which does not ship it.

**Revisit only if:** Anchor Positioning is Baseline *widely* available (then replace, do not
add), or Safari ships `popover="hint"` (then Tooltip migrates).

## The MCP server is deployed, not advertised, and being retired

`packages/mcp-server` is a thin remote adapter over the same engine and content the
`urbicon` CLI uses. `.github/workflows/deploy.yml` ships it to the host behind every green
pipeline, next to the docs site, but it is **not advertised**: the docs site names no
endpoint, and no local-install **consumer** path is documented anywhere — the package
README's stdio entry points at a checkout of this repo, for working on the server.

It is being **retired** (#500, decided 2026-09-24): next to the CLI, which is the consumer
surface, it has no use case of its own. Until it is removed it stays in the repo and stays
green. Manifest read/write lives in the CLI, never on the stateless server.

## The publishing job holds a credential and nothing else

The tag pushed by `bun run bump` triggers `.github/workflows/release.yml`, and that workflow
both gates and publishes. It is split into two jobs, which looks like ceremony and is not:

- **`gate`** runs lint, typecheck, unit tests and e2e, and packs the tarballs. It installs the
  workspace — so every third-party `postinstall` script runs here — and it holds no publishing
  credential of any kind.
- **`publish`** takes the packed tarballs as an artifact. It does not check out the repo and
  never runs `bun install`, so no dependency code shares a process with the credential.

Before the split, a single job carried `NPM_TOKEN` in its job-level `env`, which put it in
scope for `bun install` and every transitive `postinstall`.

Authentication is npm **trusted publishing** (OIDC), so there is no long-lived token: the job
mints a short-lived credential bound to this repository *and* this workflow file, useless
anywhere else. It needs `id-token: write`, npm ≥ 11.5.1, Node ≥ 22.14, and a trusted publisher
configured per package on npmjs.com. Provenance attestations are automatic — the
`--provenance` flag is not needed. The surviving `NPM_TOKEN` fallback is dead weight kept as
an escape hatch, scoped to the publish job's single step.

**This reverses the earlier arrangement.** Until 2026-08-01 the effective publisher was the
deploy host and both this file and `VERSIONING.md` said so. Since v6.48.1 all thirteen packages
go out from here over OIDC. Publishing is gated on the repository variable
`NPM_TRUSTED_PUBLISHING=true`; clearing it turns the job back into a rehearsal, which is the
way back if it is ever needed.

The docs site is a separate path — `.github/workflows/deploy.yml`, triggered by a green
pipeline rather than by the tag itself. See [VERSIONING.md](VERSIONING.md).

## The bundle-size gate runs at the release bump, not per PR

`bun run size --check` gates in `scripts/bump.sh`, once per release; per PR, CI's
`size-report` job runs the same measurement as a report and fails nothing.

As a per-PR gate it fired on intentional growth too — a new feature is bigger — and the
answer was a baseline commit rather than a decision
(`git log -i -E --grep='^(chore|test|docs)(\(.*\))?:.*size baseline'` lists them). A baseline refreshed by hand after every intentional change is a second hand-written
copy of what the build already knows. At the bump the growth of a whole release is judged
once, and a deliberate `--update-baseline` travels in the release commit.

**Revisit only if:** growth the bump catches keeps turning out unintended and hard to trace to
its PR — then a per-PR gate that fires only on undeclared growth, not the baseline ritual.

## Prop-driven state is derived, never synced in an effect

A value that follows a prop is a `$derived`, even when other writers assign to it (deriveds
are overridable as of Svelte 5.25) and even when the state lives in a shared `$state` bucket
— hand that bucket getters instead of values.

The reason is not tidiness. **`$effect` never runs during server rendering**, so every value
a component ingests in an effect is missing from the prerendered HTML and appears only after
hydration. Measured on three surfaces in v7 (#10): the table served an **empty** body because
every prop reached the store through an effect, `CodePanel` shipped a spinner where the code
should be, and `PlaygroundConfigurator` served empty controls. 154 of 173 prerendered pages
now carry real highlighted code; the remaining 19 are 5 redirect stubs and 14 pages with no
code on them.

**Known consequence:** a `$state` bucket cannot hold a derivation, which is why a provider
that mirrors every prop needs one effect per prop — the table's had ten of them, mirroring
twelve fields, before #153 removed them. The way out is the getter, not the effect. What
legitimately stays an effect: consumer callbacks, DEV validation, network/abort/timers, focus
and overlay lifecycle, and latches (`hasBeenActive`) — a value with memory is not an
expression. Full rules and role models: [SVELTE5-PATTERNS.md](SVELTE5-PATTERNS.md).

## Table view state belongs in the URL, not only in `localStorage`

Search, sort, page, page size, filters and grouping live in one consumer-owned `TableView`;
`bindViewToUrl(view)` puts them in the address bar, `bindViewToStorage(view, { key })` keeps
them between visits, and both are decorations over the same object rather than props of the
table.

Storage is a client-only layer — its accessor (module-private in `@urbicon-ui/blocks`) returns
`null` outside the browser — so state read from it at construction desynchronises the client's
first render from the server's HTML: a persisted sort produces one row order on the server and
another after hydration. The URL is visible to both, which is what makes a sorted, filtered
table server-renderable: the URL binding applies synchronously at init, storage only after
hydration.

**Known consequence:** combining the two needs a rule about who wins, and v8 spends exactly
one — precedence comes from *phases*, not from registration order. Defaults → URL (at init) →
storage (after hydration); at runtime only the URL applies, storage only writes, and an axis
is stored when its last change came from the reader, which is what keeps someone else's link
out of storage. v7 needed two mechanisms for this (presence-based reads, prop-wiring-based
writes) plus a `persistControlled` flag; #157 counted the cost in documentation, and the v8
cut removed the question rather than the symptoms. Column visibility and column order stay
out of the URL entirely — they are presentation, not selection, and live in the `prefs`
channel.

## Three auth restructurings wait for a breaking release

Redesigns of `packages/auth` drafted from its requirements alone proposed three shapes the code
does not have:

- **One constructor** — a single `createAuth` yielding the handle and every handler from one
  resolved config, instead of `createAuthDeps`, `createAuthHandle` and handler factories the
  consumer wires one by one.
  It would make the two entry points unable to disagree.
- **Token families** — one descriptor per single-use token purpose feeding both the runtime
  and the conformance suite, instead of a column group and purpose-specific methods per token
  on the user repository.
- **The cascade from the library** — account deletion driven by a declared list of dependent
  repositories, instead of the adapter's transaction and the schema's `onDelete: Cascade`.

Each divergence is real, and each fix is a breaking change: the first rewrites the public
wiring and every wiring snippet in the docs, the other two change the adapter contract for
every custom adapter. The damage each would prevent has already been paid down another way —
resolved-config accessors keep the entry points in agreement (#307), and the conformance suite
pins that a deletion erases every declared dependent, against a test double whose cascade is
read from the reference schema (#305). None of them is worth a break on its own.

**Revisit only if:** a consumer pays for the divergence again, or a breaking release is being
cut anyway. Until the launch, [VERSIONING.md § The pre-launch window](VERSIONING.md#the-pre-launch-window)
ships a breaking set as a minor, which makes that window the cheapest moment for all three.

## The docs highlighter is synchronous, and pays for it in the eager bundle

`highlighterService.highlightCode()` returns a string, not a promise: Shiki's `Sync` core with
its JavaScript regex engine and ten statically imported grammars.

An awaited highlighter can only be driven from an effect, and by the rule above that means no
prerendered page contains highlighted code. The cost is real, and the numbers below are the
measurement recorded at the head of `packages/docs/src/lib/utils/highlighter.ts` — re-verified
here against the built chunk, which carries 121 KB gz: the eager chunk grows 44 → 121 KB gz.
It is still the cheaper side,
because Vite never sets shiki's `unwasm` condition, so `./wasm` resolves to the base64-inlined
oniguruma build — a 607 KB raw / 225 KB gz JavaScript chunk the JS engine makes unnecessary.
Total for a page with code: ~333 → 121 KB gz.

**Known consequence:** `shiki` and `@shikijs/langs` are both peers of `@urbicon-ui/docs`, and
a language outside the ten bundled grammars renders unhighlighted (DEV warns). Adding one is
an import in `utils/highlighter.ts`, not a config option.

## No round-trip / codegen tool for domain projection

A two-day spike (local branch `experiment/domain-projection`, tip `9b8afdb6`, never pushed) asked whether an
AI-driven meta-system that projects a consumer's domain model onto the library, keeping
changes cheap as that model evolves, is worth building. **Decision: no round-trip/codegen
tool.** Determinism belongs in verification — drift linters, types, `validate_design` as
gates — not in generation; the AI sits at the upper seam as the *executor* of changes, never
as a generator whose output then has to be kept in sync with hand edits.

A UI's skeleton falls out almost entirely from the schema (Drizzle + Zod); the value that is
hard to get is concentrated in a few seams — labels/i18n, layout, FK options, list
composition — and those live in a presentation/intent layer a projection cannot shortcut. A
thin hand-written `.svelte` file converges on the shape a generator would have produced
(`presentation.ts` + `seams.ts`); the only real difference is addressable data versus merged
markup, which was never the generator's value. A UI is an inhabited artefact — generated code
a person then hand-edits degrades the way Sencha-style codegen did — and a good library plus
an LLM already closes most of the gap a round-trip tool would have bought.

The same holds one level up: **no design DSL** — no page-level spec language compiled into
pages. It would be a second source of truth next to the code; it would fight the one thing the
LLM is good at, fuzzy inference ("past a handful of options, prefer a Combobox"), by forcing it
back into explicit thresholds; and it has an expressiveness ceiling — real pages deviate from
any schema, and then the DSL is bypassed or bloated. Recipes as scaffolds are the dose that
works.

**Revisit only if:** the library grows dozens of consumers with "domain → app" as a product
in its own right (then the answer is LLM generation plus deterministic verification, not
deterministic projection), or hundreds of near-identical entities need scaffolding (then a
config-driven library extension, not a projection tool). The DSL half is revisited only if
non-developers are to iterate on designs themselves. The full write-up lives on that
maintainer-local branch.
