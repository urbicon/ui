# Urbicon UI

[![CI](https://github.com/urbicon/ui/actions/workflows/ci.yml/badge.svg)](https://github.com/urbicon/ui/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@urbicon-ui/blocks?label=%40urbicon-ui%2Fblocks)](https://www.npmjs.com/package/@urbicon-ui/blocks)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Vertically integrated, zero-runtime-dependency Svelte 5 + Tailwind CSS 4 platform: UI primitives, data tables, auth, i18n, docs and AI-native DX — all under unified versioning. Built with Bun workspaces.

- **Documentation:** [ui.urbicon.de](https://ui.urbicon.de)
- **Source:** [github.com/urbicon/ui](https://github.com/urbicon/ui) — development happens here; [codeberg.org/urbicon/ui](https://codeberg.org/urbicon/ui) stays as a read-only mirror, which is what the `Codeberg #NN` markers in the source refer to

## Using the Packages

Packages are published under the `@urbicon-ui/*` scope. See the [Getting Started guide](https://ui.urbicon.de/getting-started) for registry setup and installation:

```bash
bun add @urbicon-ui/blocks
```

## Prerequisites

- [Bun](https://bun.sh) v1.1+
- Node.js 18+

## Quick Start

```bash
bun install
bun run dev
```

## Workspace Structure

```
urbicon-ui/
├── packages/
│   ├── blocks            40 primitives + 27 components, tokens, tv() engine, 315 icons
│   ├── table             Data table (selection, keyboard, virtual, remote, live updates)
│   ├── auth              Auth + passkeys + notifications + email (Web Crypto only)
│   ├── docs              Reusable documentation UI components
│   ├── docs-gen          Documentation generator CLI (TypeScript AST extraction)
│   ├── mcp-server        Model Context Protocol server (AI-native DX)
│   ├── i18n              Localization (Svelte 5 runes-based)
│   ├── shared-types      Shared TypeScript type definitions
│   ├── sveltekit-utils   SvelteKit helper utilities (createCronRunner, URL-state runes)
│   ├── design            urbicon CLI (@urbicon-ui/design): local design-loop enforcement + skill/templates
│   ├── design-content    Versioned design-knowledge bundle for the remote MCP + CLI
│   └── design-engine     Zero-dep design linter / manifest parser / rubric
├── apps/
│   └── docs              Documentation site (SvelteKit)
├── e2e/                  Playwright suites (auth flow, a11y axe scan)
└── docs/                 Architecture, conventions, component reference
```

A diagram of how the packages depend on each other, plus the build order, is in
[docs/ARCHITECTURE.md § 1](docs/ARCHITECTURE.md#1--the-monorepo-at-a-glance).

## Commands

| Command | Description |
|---------|-------------|
| `bun install` | Install all workspace dependencies |
| `bun run dev` | Start all packages in watch mode |
| `bun run build` | Build all packages and apps |
| `bun run check` | Run type checks (svelte-check) |
| `bun run lint` | Lint all packages |
| `bun run format` | Format with Biome across the tree (`.svelte` via per-package `format`) |
| `bun run docs:gen:all` | Generate API docs for all components |
| `bun run test` | Run unit tests across packages |
| `bun run test:e2e` | Run Playwright end-to-end tests |
| `bun run bump` / `bump:minor` / `bump:major` | Release: bump version, regenerate changelog, tag HEAD |

## Tech Stack

- **Framework**: [Svelte 5](https://svelte.dev) with runes (`$state`, `$derived`, `$effect`)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com) + custom `tv()` variant engine (zero-dep replacement for `tailwind-variants`)
- **Design Tokens**: OKLCH color system with 3-layer architecture (foundation → semantic → interaction) — themed (colour *and* typography) via one Tailwind `@theme` block; the neutral chassis re-tints with the accent, see `urbicon css-reference theming`
- **Build**: [Bun](https://bun.sh) workspaces, `@sveltejs/package`
- **Testing**: [Vitest](https://vitest.dev) (unit) + [Playwright](https://playwright.dev/) (e2e + a11y axe)
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org) enforced via commitlint + lefthook
- **Changelog**: [git-cliff](https://git-cliff.org/) — parses commits, generates `CHANGELOG.md` on bump

## Documentation

Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — §1 is the package map and build
order, §2 the path from a design token to rendered markup. [docs/README.md](docs/README.md)
indexes everything else and suggests a reading order.

| Document | Content |
|----------|---------|
| [Architecture Overview](docs/ARCHITECTURE.md) | Package map, token → markup path, cross-cutting systems, tooling |
| [Component Families](docs/COMPONENT-FAMILIES.md) | The seven-family taxonomy: ARIA, tier behaviour, border source |
| [Component API Conventions](docs/COMPONENT-API-CONVENTIONS.md) | Props, callbacks, styling patterns, design tokens |
| [Component Structure Standard](docs/ComponentStructureStandard.md) | File structure, index.ts, variants.ts patterns |
| [Svelte 5 Patterns](docs/SVELTE5-PATTERNS.md) | Required patterns and the anti-patterns they replace |
| [Variant Contract](docs/VARIANT-CONTRACT.md) | What each `variant` value means across the library |
| [Conscious Trade-offs](docs/DECISIONS.md) | Decisions that look like oversights and are not |
| [Tailwind Caveats](docs/TailwindCaveats.md) | Tailwind 4 specifics, @theme, Svelte integration |
| [Responsive Guidelines](docs/ResponsiveGuidelines.md) | Breakpoints, touch targets, overlay patterns |
| [Auth Package](docs/AUTH.md) | Architecture, exports, consumer integration |

See [AGENTS.md](AGENTS.md) for the full set of repository guidelines used by agents and contributors, and [CONTRIBUTING.md](CONTRIBUTING.md) for how to get a change merged.

## License

[MIT](LICENSE) © Felix Urban
