# Urbicon UI — Documentation

Reference and architecture docs for the Urbicon UI monorepo. Reference/API docs are written in English. This folder is the canonical documentation set; the machine-readable API surface (`llms.txt`, MCP catalog) is generated from component JSDoc, not from here.

> Agent-facing conventions live in the root [`AGENTS.md`](../AGENTS.md) (symlinked as `CLAUDE.md`). Start there for coding rules; use this index for the deep references it links into.

## Architecture & conventions

- [ARCHITECTURE.md](ARCHITECTURE.md) — token system, tier model, `tv()` variant engine, preset system, Mint, i18n, docs-gen pipeline, date/planning infrastructure
- [COMPONENT-API-CONVENTIONS.md](COMPONENT-API-CONVENTIONS.md) — props, callbacks, styling patterns, `unstyled` / `slotClasses` / `preset`
- [ComponentStructureStandard.md](ComponentStructureStandard.md) — file structure, `index.ts`, `*.variants.ts`
- [SVELTE5-PATTERNS.md](SVELTE5-PATTERNS.md) — Svelte 5 anti-patterns, library-specific rules, role models, grep targets
- [TailwindCaveats.md](TailwindCaveats.md) — Tailwind 4 specifics, `@theme`, Svelte integration
- [ResponsiveGuidelines.md](ResponsiveGuidelines.md) — breakpoints, touch targets, overlay patterns
- [DocsPageGuide.md](DocsPageGuide.md) — building component documentation pages
- [VERSIONING.md](VERSIONING.md) — bump levels, bump-script steps, commit-type → changelog mapping

## Component reference

- [COMPONENT-FAMILIES.md](COMPONENT-FAMILIES.md) — six-family taxonomy (Action / Form / Navigation / Container / Feedback / Identity): ARIA, tier behaviour, border-token source
- [COMPONENT-DECISION-MATRICES.md](COMPONENT-DECISION-MATRICES.md) — Sidebar/Drawer/Popover/SidebarLayout and Calendar/Planner decision matrices
- [STICKY-PINNING.md](STICKY-PINNING.md) — table scroll models: page-relative sticky pinning + contained scroll
- [GUIDE.md](GUIDE.md) — Guide system (non-modal help panel, contextual hints, guided tour over one headless engine)

## Icons

- [ICON-DESIGN.md](ICON-DESIGN.md) — icon design language: hard contract, grid/radius scale, canonical motifs, tree-shaking rules (enforced by `bun run icons:lint`)
- [ICON-ROADMAP.md](ICON-ROADMAP.md) — icon-set expansion record and polish backlog

## Auth

- [AUTH.md](AUTH.md) — `@urbicon-ui/auth`: architecture, exports, consumer integration, known-limitations catalog

## Migration

- [MIGRATION-v5.md](MIGRATION-v5.md) — v4 → v5 consumer migration guide

---

Package-level READMEs cover each package's own API surface (`packages/*/README.md`). Internal strategy, launch, and analysis working docs are kept local under `docs/internal/` and completed plans under `docs/archive/` — both git-ignored, not part of the published repo.
