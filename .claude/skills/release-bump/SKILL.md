---
name: release-bump
description: Version bump and release flow (bump level per commit type, tag, push, changelog rules). Use when cutting a release, bumping the version, or deciding whether a change set is patch/minor/major.
---

# Versioning

**Conventional Commits → git-cliff → Changelog**, one unified version across all packages. Bump proactively after a coherent set of changes — once at the end, not per commit (the script refuses a dirty tree):

- **Patch** `bun run bump` — `fix` / `docs` / `refactor` / `chore` / `style` / `test` / `perf`
- **Minor** `bun run bump:minor` — `feat` (new component / prop / capability)
- **Major** `bun run bump:major` — `feat!:` or `BREAKING CHANGE:`

**Pre-launch window (until the launch of ui.urbicon.de is announced):** a set with breaking commits is still released as a **minor** — name the exception when you bump, do not ask again. What stays non-negotiable inside the window — `!` in every breaking subject, how a `BREAKING CHANGE:` footer may wrap, `MIGRATION.md` headed by the release that ships the change — and the 9.0.0 that closes it: [VERSIONING.md § The pre-launch window](../../../docs/VERSIONING.md#the-pre-launch-window).

Before tagging, the bump script also runs `bun run size --check` (after its build/test verification, skipped together with them by `BUMP_SKIP_VERIFY=1`). A failure prints the per-component table and aborts — this is a decision, not a bug: judge whether the growth is intentional, then run `bun run size --update-baseline` and re-run the bump. The refreshed `bundle-size.baseline.json` is picked up by the script's own staging step, so it ships inside the same release commit rather than as a follow-up.

The bump writes a `chore: release vX.Y.Z` commit + an annotated tag on HEAD (the tag triggers the CI publish pipeline). Push with `git push --follow-tags` — or land the commit through a PR and tag the merge commit afterwards, annotated and signed: [VERSIONING.md § Releasing through a pull request](../../../docs/VERSIONING.md#releasing-through-a-pull-request). No GitHub Release objects — `CHANGELOG.md` is the release note, so no `gh release create` in any form.

**A package new to `RELEASE_PACKAGES`** (`scripts/release-packages.mjs`) has no trusted publisher on npm, and OIDC cannot create one — the publish job fails at that package, and `scripts/publish-tarballs.mjs` stops the run there. Before tagging, publish its first version by hand at the version currently on the registry (its `workspace:*` dependency must point at a published version), wait until `npm view <name> version` shows it, then `ONLY=<name> APPLY=1 bash scripts/trust-publishers.sh`; only then tag. If the repo's version is already ahead of the registry, `bun pm pack` would resolve `workspace:*` to the local sibling: set the new package's `version` and its dependency to the registry version in an uncommitted edit, pack, publish, revert.

`CHANGELOG.md` is generated — the bump regenerates it, `bun run changelog` does so on its own. Full detail — bump-script steps, commit-type → changelog mapping, scoping: [docs/VERSIONING.md](../../../docs/VERSIONING.md).
