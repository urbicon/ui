# @urbicon-ui/sv

The [Svelte CLI](https://svelte.dev/docs/cli) community add-on for
[Urbicon UI](https://ui.urbicon.de) — one command from an empty directory (or an
existing SvelteKit project) to a working, styled setup.

> **Beta.** sv community add-ons are
> [experimental](https://svelte.dev/docs/cli/community) — the add-on API may
> change between sv releases. This package tracks its `sv` peer range.

## Usage

```bash
# New project — sv asks its own questions (TypeScript, Prettier, …):
bunx sv create my-app --add @urbicon-ui

# Existing SvelteKit project:
bunx sv add @urbicon-ui
```

Any package manager works (`npx sv …` likewise); non-interactive runs (CI,
agents) should pre-answer Tailwind's plugin prompt:
`bunx sv add tailwindcss=plugins:none @urbicon-ui`.

`@urbicon-ui` resolves to this package; the `tailwindcss` add-on is pulled in
automatically as a dependency.

## What it does

- Adds `@urbicon-ui/blocks` (dependency) and `@urbicon-ui/design` (devDependency)
  as a caret range floored at the release this add-on shipped with — all
  `@urbicon-ui/*` packages version in lockstep.
- Adds `@import '@urbicon-ui/blocks/style/index.css';` to the app stylesheet,
  after Tailwind. That single import carries the design tokens **and** the
  `@source` directives that make Tailwind generate the components' classes — no
  consumer-side `@source` needed.
- Points you at the next step:

```bash
bunx urbicon init --hook   # AGENTS.md agent context + the edit-time design gate
```

The design-loop onboarding deliberately lives in `urbicon init`, not here: it is
idempotent, version-stamped and meant to be re-run after upgrades — things a
one-shot scaffolder cannot be.

## Local development

```bash
bun run build   # bundles src/index.ts → dist/index.mjs (sv stays external)
cd /path/to/test-project
bunx sv add file:/path/to/packages/sv --no-git-check
```

Part of the [Urbicon UI monorepo](https://github.com/urbicon/ui); see the
[getting-started guide](https://ui.urbicon.de/getting-started) for the manual
setup this add-on automates.
