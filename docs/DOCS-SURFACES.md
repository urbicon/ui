# Documentation Surfaces

Where documentation lives, who owns it, and how it reaches its readers — the
declared model behind every doc file in this monorepo. Written 2026-07-20 after
the same security guidance had to be corrected in five places; treat deviations
from this file as bugs, not as taste.

## History, so the pendulum stops swinging

Package docs were once centralised from `packages/auth` into `docs/` (one place
for repo developers), then moved back into the package on 2026-07-20 (npm
consumers could not reach `docs/` at all — the repo was private at the time, so
README links into it were dead). Both moves optimised for a single audience. The
synthesis, and the standing rule:

> **The source of truth lives with the versioned artifact it documents; the
> monorepo keeps a symlink so central navigation still works.** Moving files
> back and forth is never the fix again — wiring a missing channel is.

## The four principles

1. **Source lives with the versioned artifact.** Anything a consumer of a
   package needs sits in that package (`README.md`, `docs/*.md`) and ships in
   its tarball (listed in `files`). `docs/` at the root keeps a symlink per
   such file (e.g. `docs/AUTH.md → packages/auth/docs/AUTH.md`) plus the
   monorepo-internal docs that no consumer needs (conventions, patterns,
   architecture notes).
2. **One source, all channels generated — docs-gen is the only distributor.**
   Nothing consumer-facing is hand-copied between surfaces. Component APIs
   flow from `*Props` JSDoc (see AGENTS.md § Component metadata); guide
   documents flow through three generated channels: the `guides` field of a
   target's LLM output config (`packages/docs-gen/src/types/configuration.ts`
   → copied to `static/<scope>/<Doc>.md` + indexed under `## Guides` in the
   scope `llms.txt`), the `PACKAGE_GUIDES` list in docs-gen's CLI (→
   `guides/<slug>.md` + index in the `design-content` bundle, behind
   `urbicon guide <slug>` and `urbicon://guide/<id>`, plus `{{GUIDE:<slug>}}`
   extraction into `llms-full.txt` for guides flagged `embedInLlmsFull`), and
   the docs site (a route rendering the shipped file at build time, e.g.
   `/auth/guide`). A KEEP-IN-SYNC comment is an admission this principle
   failed — prefer wiring the generator.
3. **Code comments are pointers, not copies.** Two sentences of contract plus
   `see docs/AUTH.md § …`. The reference resolves in the tarball (the guide
   ships next to `dist/`) and in the repo (symlink).
4. **Public/internal is declared, not guessed.** Consumer-relevant reference
   content is public and English; planning, review bookkeeping and strategy
   stay in `docs/internal/` (gitignored). Shipped docs never carry internal
   review IDs, wave/session names or priority markers. (Also stated in
   AGENTS.md § Internal working docs.)

## Classes and channels

| Class | Source of truth | Audience | Channels |
| --- | --- | --- | --- |
| Component API | `*Props` JSDoc in the package source | consumers + agents | docs-gen → `api.ts`, `llm.txt` tree, MCP catalog, `design-content` (CLI) |
| Package guide (integration, security, limitations) | `packages/<pkg>/docs/*.md` | consumers + agents | tarball (`files`), docs-gen `guides` → `static/<scope>/` + scope `llms.txt`, `design-content` bundle → `urbicon guide` + MCP resource, llms-full extraction (`embedInLlmsFull`), site route (`/auth/guide`) |
| Package quickstart | `packages/<pkg>/README.md` | consumers | tarball, npmjs page (deep links go absolute to the rendered site route — npmjs does not resolve relative links into the repo, so they 404 there regardless of repo visibility; `./docs/…` stays as the shipped-copy pointer) |
| Monorepo conventions (SVELTE5-PATTERNS, ICON-DESIGN, …) | `docs/*.md` | repo developers + agents | repo only — deliberately not shipped |
| Design knowledge (principles, patterns, tokens) | `design-system/`, `css-reference.ts` | consumers + agents | `design-content` bundle → `urbicon` CLI, MCP, docs site |
| Planning / strategy / review bookkeeping | `docs/internal/` (gitignored), `docs/technical-debt.md` | maintainers | repo only |
| Site-only prose (Docs.svelte pages, recipes) | `apps/docs/src/**` | site readers | docs site |

Everything under `apps/docs/static/<scope>/` and `dist/` is a **generated
artifact** (git-ignored, rebuilt by `docs:gen:all` / `build`) — never edit it,
never link to it as a source.

## Migration state

**Complete (2026-07-21).** The stages, in the order they landed:

- 2026-07-20: AUTH.md moved into `packages/auth/docs/` + root symlink; internal
  markers stripped from the shipped file; `guides` mechanism in docs-gen with
  auth as first user.
- 2026-07-21, the remaining channel wiring:
  - `/auth/guide` renders the shipped AUTH.md at build time (GitHub-compatible
    heading anchors); the auth README's deep links went absolute to it for the
    npmjs view, keeping `./docs/AUTH.md` as the shipped-copy pointer.
  - `urbicon guide <slug>` serves the canonical package guides from the
    `design-content` bundle (`guides/<slug>.md` + `index.json`, emitted by
    docs-gen's `PACKAGE_GUIDES`); the MCP server's `urbicon://guide/auth`
    reads the same bundle file.
  - The hand-written llms-full-template auth section (already drifted: it
    still called SSO "on the roadmap") was replaced by `{{GUIDE:auth}}`
    extraction from AUTH.md; the kernel-CSRF prose in `handle.ts`/`csrf.ts`
    shrank to pointers (principle 3). The scope `llms.txt` stays an index —
    security notes live in the indexed guide, not inline (decided 2026-07-21).
  - The `docs/*.md` audit moved GUIDE.md + the blocks migration guide into
    `packages/blocks/docs/` and STICKY-PINNING.md into
    `packages/table/docs/` — each tarball-shipped with a root symlink,
    scope-`llms.txt` indexed, and in the guide bundle.

New consumer-relevant docs follow this file's model from the start; there is
no open migration debt. The one deliberate asymmetry: the `urbicon` CLI lists
every bundled guide dynamically (`guides/index.json`), while the unhosted MCP
server statically advertises only the auth guide alongside its six
template-sliced resources.
