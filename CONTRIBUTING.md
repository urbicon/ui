# Contributing to Urbicon UI

Thanks for your interest in contributing! This document covers the essentials for getting a change merged.

## Code of Conduct

This project adheres to the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it. Please report unacceptable behavior to **info@urbicon.de**.

## Setup

```bash
bun install
bun run dev        # all packages in watch mode
```

Requires [Bun](https://bun.sh) v1.1+ and Node.js 18+.

## Before You Submit

```bash
bun run check      # type checks (svelte-check)
bun run lint       # Biome (.ts/.js/.json)
bun run test       # unit tests (Vitest)
```

A pre-commit hook (lefthook) formats and lints staged files automatically.

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org), enforced via commitlint:

```
<type>(<scope>): <description>
```

- Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `build`, `ci`, `perf`
- Scope by package when relevant: `feat(blocks): add Stepper component`, `fix(table): correct sort order`

Commit messages drive the auto-generated changelog (git-cliff) — correct types and scopes matter.

## Pull Requests

Development happens on [Codeberg](https://codeberg.org/urbicon/ui). Open pull requests against the `main` branch. Keep PRs focused — one coherent change per PR. If you spot an unrelated issue while working, note it in [docs/technical-debt.md](docs/technical-debt.md) rather than widening the PR's scope.

## Conventions

The full set of repository guidelines (component structure, Svelte 5 patterns, design tokens, icon rules) lives in [AGENTS.md](AGENTS.md) and the documents under [docs/](docs/). The most relevant entry points:

- [docs/COMPONENT-API-CONVENTIONS.md](docs/COMPONENT-API-CONVENTIONS.md) — props, callbacks, styling patterns
- [docs/ComponentStructureStandard.md](docs/ComponentStructureStandard.md) — file structure per component
- [docs/SVELTE5-PATTERNS.md](docs/SVELTE5-PATTERNS.md) — required Svelte 5 patterns and anti-patterns

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
