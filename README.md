# Urbicon UI

Vertically integrated, zero-runtime-dependency Svelte 5 + Tailwind CSS 4 platform: UI primitives, data tables, auth, i18n, docs and AI-native DX — all under unified versioning. Built with Bun workspaces.

- **Documentation:** [ui.urbicon.de](https://ui.urbicon.de)
- **Source:** [codeberg.org/urbicon/ui](https://codeberg.org/urbicon/ui)

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
│   ├── blocks            35 primitives + 18 components (zero runtime deps)
│   ├── table             Data table (selection, keyboard, virtual, remote, live updates)
│   ├── auth              Auth + passkeys + notifications + email (Web Crypto only)
│   ├── docs              Reusable documentation UI components
│   ├── docs-gen          Documentation generator CLI (TypeScript AST extraction)
│   ├── mcp-server        Model Context Protocol server (AI-native DX)
│   ├── i18n              Localization (Svelte 5 runes-based)
│   ├── shared-types      Shared TypeScript type definitions
│   └── sveltekit-utils   SvelteKit helper utilities (createCronRunner, URL-state runes)
├── apps/
│   └── docs              Documentation site (SvelteKit)
├── e2e/                  Playwright suites (auth flow, a11y axe scan)
└── docs/                 Architecture docs, conventions, roadmap
```

## Commands

| Command | Description |
|---------|-------------|
| `bun install` | Install all workspace dependencies |
| `bun run dev` | Start all packages in watch mode |
| `bun run build` | Build all packages and apps |
| `bun run check` | Run type checks (svelte-check) |
| `bun run lint` | Lint all packages |
| `bun run format` | Format all packages (Prettier) |
| `bun run docs:gen:all` | Generate API docs for all components |
| `bun run test` | Run unit tests across packages |
| `bun run test:e2e` | Run Playwright end-to-end tests |
| `bun run bump` / `bump:minor` / `bump:major` | Release: bump version, regenerate changelog, tag HEAD |

## Tech Stack

- **Framework**: [Svelte 5](https://svelte.dev) with runes (`$state`, `$derived`, `$effect`)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com) + custom `tv()` variant engine (zero-dep replacement for `tailwind-variants`)
- **Design Tokens**: OKLCH color system with 3-layer architecture (foundation → semantic → interaction)
- **Build**: [Bun](https://bun.sh) workspaces, `@sveltejs/package`
- **Testing**: [Vitest](https://vitest.dev) (unit) + [Playwright](https://playwright.dev/) (e2e + a11y axe)
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org) enforced via commitlint + Husky
- **Changelog**: [git-cliff](https://git-cliff.org/) — parses commits, generates `CHANGELOG.md` on bump

## Documentation

| Document | Content |
|----------|---------|
| [Architecture Overview](docs/ARCHITECTURE.md) | Token system, Mint, Preset-System, i18n, docs-gen pipeline |
| [Component API Conventions](docs/COMPONENT-API-CONVENTIONS.md) | Props, callbacks, styling patterns, design tokens |
| [Component Structure Standard](docs/ComponentStructureStandard.md) | File structure, index.ts, variants.ts patterns |
| [Documentation Page Guide](docs/DocsPageGuide.md) | Building component docs pages |
| [Tailwind Caveats](docs/TailwindCaveats.md) | Tailwind 4 specifics, @theme, Svelte integration |
| [Responsive Guidelines](docs/ResponsiveGuidelines.md) | Breakpoints, touch targets, overlay patterns |
| [Auth Package](docs/AUTH.md) | Architecture, exports, consumer integration |

See [AGENTS.md](AGENTS.md) for the full set of repository guidelines used by agents and contributors, and [CONTRIBUTING.md](CONTRIBUTING.md) for how to get a change merged.

## License

[MIT](LICENSE) © Felix Urban
