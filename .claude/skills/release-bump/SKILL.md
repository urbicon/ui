---
name: release-bump
description: Version bump and release flow (bump level per commit type, tag, push, changelog rules). Use when cutting a release, bumping the version, or deciding whether a change set is patch/minor/major.
---

# Versioning

**Conventional Commits → git-cliff → Changelog**, one unified version across all packages. Bump proactively after a coherent set of changes (once at the end, not per commit; **never on a dirty tree**):

- **Patch** `bun run bump` — `fix` / `docs` / `refactor` / `chore` / `style` / `test` / `perf`
- **Minor** `bun run bump:minor` — `feat` (new component / prop / capability)
- **Major** `bun run bump:major` — `feat!:` or `BREAKING CHANGE:`

The bump writes a `chore: release vX.Y.Z` commit + an annotated tag on HEAD (the tag triggers the CI publish pipeline). Push with `git push --follow-tags`.

**Never edit `CHANGELOG.md` by hand** — it is auto-generated.

Full detail — bump-script steps, commit-type → changelog mapping, scoping: [docs/VERSIONING.md](../../../docs/VERSIONING.md).

## Changelog generation

`bun run changelog` regenerates `CHANGELOG.md` via git-cliff. Conventional commits are parsed by git-cliff, so correct types and scopes decide which section a change appears in.
