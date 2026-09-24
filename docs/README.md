# Urbicon UI — Documentation

Reference and architecture docs for the Urbicon UI monorepo, written in English. This folder
is the canonical documentation set; the machine-readable API surface (`llms.txt`,
`llms-full.txt`, MCP catalog) is generated from component JSDoc, not from here — `llms.txt`
combines the component catalog with a small hand-written template
(`packages/docs-gen/templates/llms-template.md`), checked by `bun run llms:check`.

> Agent-facing conventions live in the root [`AGENTS.md`](../AGENTS.md) (symlinked as
> `CLAUDE.md`). Start there for coding rules; use this index for the deep references it
> links into.

## New here? Read in this order

1. **[ARCHITECTURE.md § 1](ARCHITECTURE.md#1--the-monorepo-at-a-glance)** — the package map,
   what lives where, build order. Fifteen minutes, and the repo stops being a maze.
2. **[ARCHITECTURE.md § 2](ARCHITECTURE.md#2--from-token-to-markup)** — the one path every
   component follows, from design token to rendered markup.
3. **[COMPONENT-FAMILIES.md](COMPONENT-FAMILIES.md)** — the taxonomy that decides a
   component's ARIA role, tier behaviour and border source.
4. **[ComponentStructureStandard.md](ComponentStructureStandard.md)** — the file layout you
   will copy when you build the next component.

Then reach for the rest as you need it.

## Canon map

Each rule family below is described in exactly one place. Every other site keeps one sentence
and a link to that place, and in these reference docs the owning section says so with a
`> **Canon.**` blockquote — so a rule that changes is edited once.

| Topic                                                                                | Canon                                                                                                                                   |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Override cascade, ladder, `slotClasses`, `preset`, `overrides`, `unstyled` mechanism | [ARCHITECTURE § The override cascade](ARCHITECTURE.md#the-override-cascade)                                                             |
| Tier system, `bridge`                                                                | [ARCHITECTURE § The tier system](ARCHITECTURE.md#the-tier-system)                                                                       |
| `tv()` fold order                                                                    | [ARCHITECTURE § The tv() variant engine](ARCHITECTURE.md#the-tv-variant-engine)                                                         |
| Internal core layer                                                                  | [ARCHITECTURE § The internal core layer](ARCHITECTURE.md#the-internal-core-layer)                                                       |
| Border tokens (hairline vs. subtle)                                                  | [VARIANT-CONTRACT § 7](../packages/blocks/docs/VARIANT-CONTRACT.md#7--border-tokens-hairline-vs-subtle)                                 |
| Field variant vocabulary (`bare`, `ghost`, …)                                        | [VARIANT-CONTRACT § 9](../packages/blocks/docs/VARIANT-CONTRACT.md#9--form-fields)                                                      |
| The required marker                                                                  | [VARIANT-CONTRACT § The required marker](../packages/blocks/docs/VARIANT-CONTRACT.md#the-required-marker)                               |
| `variantProps`, house axis order                                                     | [COMPONENT-API-CONVENTIONS § variantProps and the house axis order](COMPONENT-API-CONVENTIONS.md#variantprops-and-the-house-axis-order) |
| Styling-prop surface (which props, how typed)                                        | [COMPONENT-API-CONVENTIONS § Styling props](COMPONENT-API-CONVENTIONS.md#styling-props-class-unstyled-slotclasses-preset)               |
| Family taxonomy (ARIA role, tier behaviour, border source)                           | [COMPONENT-FAMILIES.md](COMPONENT-FAMILIES.md)                                                                                          |
| Svelte 5 patterns and anti-patterns                                                  | [SVELTE5-PATTERNS.md](SVELTE5-PATTERNS.md)                                                                                              |
| Docs-page structure                                                                  | [DocsPageGuide.md](DocsPageGuide.md)                                                                                                    |
| Docs prose                                                                           | [EDITORIAL.md](EDITORIAL.md)                                                                                                            |
| Versioning, bump levels                                                              | [VERSIONING.md](VERSIONING.md)                                                                                                          |
| Gates: how to run one                                                                | [AGENTS.md § Commands](../AGENTS.md#commands)                                                                                           |
| Gates: what the set catches                                                          | [ARCHITECTURE § The lint gates](ARCHITECTURE.md#the-lint-gates)                                                                         |

## Architecture & conventions

- [ARCHITECTURE.md](ARCHITECTURE.md) — the monorepo map, the token → markup path, cross-cutting systems, package profiles, tooling
- [DECISIONS.md](DECISIONS.md) — conscious trade-offs: things that look like oversights and are not
- [COMPONENT-API-CONVENTIONS.md](COMPONENT-API-CONVENTIONS.md) — props, callbacks, styling patterns, `unstyled` / `slotClasses` / `preset`
- [ComponentStructureStandard.md](ComponentStructureStandard.md) — file structure, `index.ts`, `*.variants.ts`
- [SVELTE5-PATTERNS.md](SVELTE5-PATTERNS.md) — Svelte 5 anti-patterns, library-specific rules, role models, grep targets
- [TailwindCaveats.md](TailwindCaveats.md) — Tailwind 4 specifics, `@theme`, Svelte integration
- [ResponsiveGuidelines.md](ResponsiveGuidelines.md) — breakpoints, touch targets, overlay patterns
- [DocsPageGuide.md](DocsPageGuide.md) — building component documentation pages
- [EDITORIAL.md](EDITORIAL.md) — how the prose on those pages is written: principles, canon pages, and the editing checklist the `docs-editor` skill runs
- [DOCS-SURFACES.md](DOCS-SURFACES.md) — where docs live, who owns them, how they reach consumers
- [AI-NATIVE-DX.md](AI-NATIVE-DX.md) — what an agent is served and from where: the `urbicon` CLI (the consumer surface), the MCP adapter, the design loop and what it is measured to do
- [VERSIONING.md](VERSIONING.md) — bump levels, bump-script steps, commit-type → changelog mapping

## Component reference

- [COMPONENT-FAMILIES.md](COMPONENT-FAMILIES.md) — seven-family taxonomy (Action / Form / Navigation / Container / Feedback / Identity / Conversation): ARIA, tier behaviour, border-token source
- [COMPONENT-DECISION-MATRICES.md](COMPONENT-DECISION-MATRICES.md) — Sidebar/Drawer/Popover/SidebarLayout and Calendar/Planner decision matrices
- [VARIANT-CONTRACT.md](VARIANT-CONTRACT.md) — what each `variant` value means across the library *(shipped in the blocks tarball)*
- [STICKY-PINNING.md](STICKY-PINNING.md) — table scroll models: page-relative sticky pinning + contained scroll *(shipped in the table tarball)*
- [MIGRATION-V8.md](MIGRATION-V8.md) — table v7 → v8: the consumer-owned view object, the source union, the two persistence channels *(shipped in the table tarball)*
- [MIGRATION-BLOCKS.md](MIGRATION-BLOCKS.md) — breaking changes to the component library, newest first *(shipped in the blocks tarball)*
- [GUIDE.md](GUIDE.md) — Guide system: non-modal help panel, contextual hints, guided tour *(shipped in the blocks tarball)*
- [A2UI.md](A2UI.md) — agent-generated UI in a chat: long-lived surfaces, the action-only return path *(shipped in the blocks tarball)*

## Icons

- [ICON-DESIGN.md](ICON-DESIGN.md) — icon design language: hard contract, grid/radius scale, canonical motifs, tree-shaking rules (enforced by `bun run icons:lint`)

## Auth

- [AUTH.md](AUTH.md) — `@urbicon-ui/auth`: architecture, exports, consumer integration, known-limitations catalog *(shipped in the auth tarball)*

## Project tracking

- [technical-debt.md](technical-debt.md) — pointer: open findings live as GitHub issues (`debt:*` labels) since 2026-07-31; the file keeps the entry format

---

Package-level READMEs cover each package's own API surface (`packages/*/README.md`); the
documentation site has its own ([`apps/docs/README.md`](../apps/docs/README.md)), which is
also where the Color Rooms theme is documented.

Internal strategy and analysis working docs are kept local under `docs/internal/`, git-ignored
and not part of the published repo. **Do not link to it from a tracked document**: the link
resolves for maintainers and 404s for everyone else.
