---
name: pr-wave
description: Driving an implementation wave in this repo as a chain of PRs — the ui mechanics on top of the user-global `wellen-orchestrierung` skill: the briefing additions, CI on the head SHA, squash merge, MIGRATION.md collisions, stacked and conflicting PRs, cleanup and wave close. Use when implementing a set of issues as reviewed PRs, or when orchestrating parallel implementation agents here.
---

# Driving a PR wave

The cross-project rules — when parallel agents pay, the two-in-flight limit, the roles
(implementer, adversarial reviewer in a fresh context, fix verification), the fix-round
limit, the report contracts, the briefing lines, agent size and the cost measurement — live in
the user-global skill `wellen-orchestrierung`. Load it first; this file carries only what is
particular to ui: one PR per strand, CI on the head SHA as the oracle, squash merges into
`main`.

## The cycle, as PRs

0. **Base** — the global base check, with the ui consequence: a local commit an agent pulls
   in by SHA lands in its PR and folds into the squash under the PR's type and scope. Push it
   first (after approval) or land it through its own PR.
1. **Implement** — one agent per PR in an isolated worktree (briefing additions below). The
   agent does not commit; you commit, push and open the PR from its report.
2. **Review** per the global skill. A docs page prints the same text twice — the live demo and
   the code listing — so a text locator can measure the listing; scope it to
   `[data-docs-preview]`.
3. **Fix rounds** — past the global limit the verdict is yours: merge with `Refs #N` and the
   remainder named in the PR comment, or split the PR. A `MERGE` with a remainder is a
   `MERGE`; the remainder goes into the PR comment, not into a third round.
4. **CI, merge, cleanup** — below.

## Briefing additions

- **Implementation:** derive the gate list from `.github/workflows/ci.yml`, not from memory.
  `bun --filter='@urbicon-ui/docs-app' run test` (counting oracles over blocks sources — a new
  `text-xs` use fails a published claim) is the one that gets forgotten, at the price of a red
  CI cycle. `size` is a per-PR **report** only; its `--check` and any `--update-baseline`
  happen at the release bump, **measured on top of merged main**, or the baseline freezes a
  stale sibling package.
- **Review:** the reviewer reads the contract document of the touched surface whole first
  (the package's `docs/*.md`, `docs/COMPONENT-API-CONVENTIONS.md`, `VARIANT-CONTRACT.md`, …)
  and holds each of its statements against the built behaviour. A report that calls something
  "the traded price" or "deliberately traded" is checked against that document before it is
  believed.

## CI and merge

- **CI on the head SHA is the oracle**; you run no per-PR gates yourself.
- **The merged state has its own run.** The ruleset does not require a branch to be up to date
  before merging, so a PR's head-SHA run is not the state the squash produces. The latest
  `ci.yml` run on a push to `main` is; a dependent briefing waits for it to be green.
  `ci.yml` cancels a running push run when the next merge lands, so a `cancelled` run is
  superseded, not red. After a merge of `main` into a sibling, that sibling's new head-SHA run
  is the check.
- **Never trust `gh pr checks --watch` alone.** Right after a push it can read the previous
  SHA's rollup and exit green before the new checks are registered. Before merging, verify the
  head SHA directly:
  ```bash
  HEAD=$(gh pr view <N> --json headRefOid --jq .headRefOid)
  gh api "repos/:owner/:repo/commits/$HEAD/check-runs" \
    --jq '[.check_runs[].conclusion] | group_by(.) | map({c: .[0], n: length})'
  ```
- **A PR with `mergeable: CONFLICTING` gets no `pull_request` run** — resolve the conflict,
  do not retrigger.
- **A PR whose base is another PR's branch is a stack**: `ci.yml` runs only for PRs against
  `main`, and `gh pr merge` fails on it. The async merge endpoint takes it, squashed, with the
  same explicit subject and body as below; it answers `202` with a `uuid` to poll until the
  state leaves `pending` for `merged` or `failed`:
  ```bash
  gh api -X PUT repos/:owner/:repo/pulls/<N>/merge-async -f merge_method=squash \
    -f merge_action=direct_merge -f sha=<head> -f commit_title='<subject>' \
    -F commit_message=@<body-file>
  gh api repos/:owner/:repo/pulls/<N>/merge-async/<uuid>
  ```
- Squash-merge with explicit `--subject`/`--body` — the body lands in the changelog.
  `Closes #N` only on the wave that finishes the issue; earlier waves say `Refs #N`. GitHub's
  keyword parser knows no negation — "This does not close #14." closed #14 — so no
  close/fix/resolve in any form directly before `#N` in a commit or PR text that should not
  close it ("#14 stays open: …"); after a merge that names an issue, check
  `gh issue view <N> --json state`.
- Document the review outcome as a PR comment (findings → what happened to each, including the
  ones deliberately not done and why).
- **Parallel PRs collide on `packages/blocks/docs/MIGRATION.md`.** Every breaking PR adds its
  entries under the same `## <next version>` heading, so a merge of `main` into a sibling can
  conflict there. The resolution is mechanical: strip the three markers, keep both blocks
  (order within a release does not matter), commit the merge, push — one CI round per merge of
  `main`, so merge PRs promptly rather than batching them.

## Cleanup — a named final step, per merged PR

Only the PR's head SHA proves it landed (AGENTS.md § Git Workflow). Then remove the PR branch
(local; GitHub auto-deletes the remote), the agent's worktree and its `worktree-*` scaffolding
branch, which never merges on its own, and run `git worktree prune`. `git pull` main before
the next dependent briefing.

## Wave close

Bump per the `release-bump` skill once the chain is coherent and the tree is clean — a `feat`
anywhere in the set makes it minor.

Record the wave's cost per the global skill; here the script is
`bun run wave:cost --since <first day> --until <last day> --agents`.

Then prune what the wave made obsolete, as a named step rather than a someday — the global
list, plus here: the `pending #N` markers whose issue the wave closed (the grep is in the
`knowledge-audit` skill, § 3 Docs); the doc sentences and comments the code change falsified
(grep the identifiers you changed across `docs/` and `packages/*/docs`); and the
implementation postscript into the probe/analysis document that spawned the wave.
