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

## The MCP server is built, green, and not hosted

`packages/mcp-server` is a thin remote adapter over the same engine and content the
`urbicon` CLI uses. It is deliberately **not advertised or hosted** (decided 2026-07-10):
the package track is the story, and hosting a public endpoint is a launch decision rather
than an engineering one.

It stays in the repo and stays green. No local-install path is documented anywhere, and
manifest read/write lives in the CLI, never on the stateless server.

## Publishing does not happen in `release.yml`

The tag pushed by `bun run bump` triggers `.github/workflows/release.yml`, but that workflow
is a **gate**, not a publisher: it runs lint, typecheck, unit tests and e2e on the tagged
commit. The effective npm publisher is the deploy host, triggered by the same tag.

The publish steps remain in the workflow file, dormant behind
`if: env.NPM_REGISTRY_URL != ''`, as the ready-made path back. Leaving the two secrets unset
is what keeps them dormant — setting them would give the same tag two publishers.

See [VERSIONING.md](VERSIONING.md) and the corresponding entry in
[technical-debt.md](technical-debt.md).
