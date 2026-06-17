# Versioning

This repo uses **Conventional Commits → git-cliff → Changelog** as its versioning pipeline. Commits are the source of truth — correct types and scopes drive the changelog automatically. All packages use **unified versioning** — every package shares the same version as root.

Quick reference (when/which-level) lives in [AGENTS.md → Versioning](../AGENTS.md#versioning); this file is the full detail.

## When to bump

Bump **after pushing a coherent set of changes**. Bump proactively — don't wait for the user to ask. A good rule of thumb:

- Multiple small commits in one session? → **bump once at the end**, not after each commit
- Do **not** bump if there are uncommitted changes, failing lint, or work-in-progress

## Which bump level

| Bump level | Command              | When to use                                                                                      |
| ---------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| **Patch**  | `bun run bump`       | `fix`, `docs`, `refactor`, `chore`, `style`, `test`, `perf` — no new user-facing features        |
| **Minor**  | `bun run bump:minor` | `feat` — new component, new prop, new capability                                                 |
| **Major**  | `bun run bump:major` | `feat!:` or `BREAKING CHANGE:` in commit body — removal of props, renamed APIs, changed defaults |

`bun run bump` is an alias for `bun run bump:patch` (the most common case).

## What the bump scripts do

1. Bumps root `package.json` version via `npm version --no-git-tag-version`
2. Sets all `packages/*/package.json` to the same version
3. Runs `bunx git-cliff --tag vX.Y.Z --output CHANGELOG.md` — regenerates the full changelog
4. Creates a single release commit: `chore: release vX.Y.Z`
5. Creates annotated git tag `vX.Y.Z` on HEAD

Result: one release commit + one annotated tag on HEAD. The tag on HEAD is critical — it triggers the CI publish pipeline. Push with `git push --follow-tags`. **Never edit `CHANGELOG.md` manually** — it is fully auto-generated.

## Commit types → Changelog sections

| Commit type | Changelog section | When to use                                |
| ----------- | ----------------- | ------------------------------------------ |
| `feat`      | Features          | New capability or user-facing behavior     |
| `fix`       | Bug Fixes         | Corrects broken behavior                   |
| `refactor`  | Refactoring       | Code restructuring without behavior change |
| `perf`      | Performance       | Measurable performance improvement         |
| `docs`      | Documentation     | Docs, comments, CLAUDE.md                  |
| `style`     | Styling           | Formatting, whitespace (no logic change)   |
| `test`      | Testing           | Adding or fixing tests                     |
| `build`     | Build System      | Build config, dependencies                 |
| `ci`        | CI/CD             | CI pipeline changes                        |
| `chore`     | Miscellaneous     | Tooling, version bumps, cleanup            |

## Scope

Always scope by package when the change is package-specific: `feat(blocks): ...`, `fix(table): ...`, `docs(i18n): ...`. Omit scope for cross-cutting changes.
