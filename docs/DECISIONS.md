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

`tsconfig.base.json` holds the shared baseline (`target`, `module`, `lib`, `strict`,
`esModuleInterop`). Stronger flags — `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
`exactOptionalPropertyTypes` — are active **only** in the `tsc`-built packages
(`docs-gen`, `mcp-server`, `shared-types`).

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
  or a backdrop blur would take one bounded token set that primitives opt into generically.
  Exactly one component hardcodes a blur today (`CompositionBar.svelte`) — the known exception,
  not the pattern.
- **Brand themes are unbounded; full aesthetic identities are not.** Palette, accent hue, radius
  and density cost one file each under `style/themes/`, so there can be any number. A complete
  visual identity is a larger one-time token investment, and those stay a small curated set —
  never an open "any aesthetic" engine.

The proof that the boundary holds is in the repo: the Color Rooms skin
(`apps/docs/src/lib/style/rooms*.css`) carries a complete identity — own paper, ink, intent
ramps, typography, first-class light and dark via `light-dark()` — as a scoped token override
with no parallel component tree.

## The MCP server is built, green, and not hosted

`packages/mcp-server` is a thin remote adapter over the same engine and content the
`urbicon` CLI uses. It is deliberately **not advertised or hosted** (decided 2026-07-10):
the package track is the story, and hosting a public endpoint is a launch decision rather
than an engineering one.

It stays in the repo and stays green. No local-install path is documented anywhere, and
manifest read/write lives in the CLI, never on the stateless server.

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
