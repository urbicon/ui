---
name: release-bump
description: Version bump and release flow (bump level per commit type, tag, push, changelog rules). Use when cutting a release, bumping the version, or deciding whether a change set is patch/minor/major.
---

# Versioning

**Conventional Commits → git-cliff → Changelog**, one unified version across all packages. Bump proactively after a coherent set of changes (once at the end, not per commit; **never on a dirty tree**):

- **Patch** `bun run bump` — `fix` / `docs` / `refactor` / `chore` / `style` / `test` / `perf`
- **Minor** `bun run bump:minor` — `feat` (new component / prop / capability)
- **Major** `bun run bump:major` — `feat!:` or `BREAKING CHANGE:`

**Pre-launch window (until the launch of ui.urbicon.de is announced):** a set with breaking commits is still released as a **minor**. Decided 2026-08-14 and written into [docs/VERSIONING.md](../../../docs/VERSIONING.md) § The pre-launch window on 2026-09-03 — name the exception when you bump, do not ask again. Two things stay non-negotiable: every breaking commit carries `!` in its subject (git-cliff groups on a `BREAKING CHANGE:` footer too, but the subject is what `git log` shows), and `packages/blocks/docs/MIGRATION.md` is headed by the release that ships the change, never `## v9`. The window closes with the announcement release, **9.0.0**.

The bump writes a `chore: release vX.Y.Z` commit + an annotated tag on HEAD (the tag triggers the CI publish pipeline). Push with `git push --follow-tags`.

**Never edit `CHANGELOG.md` by hand** — it is auto-generated.

Full detail — bump-script steps, commit-type → changelog mapping, scoping: [docs/VERSIONING.md](../../../docs/VERSIONING.md).

## Changelog generation

`bun run changelog` regenerates `CHANGELOG.md` via git-cliff. Conventional commits are parsed by git-cliff, so correct types and scopes decide which section a change appears in.
