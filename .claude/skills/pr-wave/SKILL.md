---
name: pr-wave
description: Driving an implementation wave in this repo as a chain of PRs — the ui mechanics on top of the user-global `wellen-orchestrierung` skill: two PRs in flight, the briefing additions, CI on the head SHA, squash merge, MIGRATION.md collisions, cleanup and wave close. Use when implementing a set of issues as reviewed PRs, or when orchestrating parallel implementation agents here.
---

# Driving a PR wave

The cross-project rules — when parallel agents pay, the roles (implementer,
adversarial reviewer in a fresh context, fix verification), the report
contracts, agent size, the traps of parallel agents and what to read from
the cost measurement — live in the user-global skill
`wellen-orchestrierung`. Load it first; this file carries only what is
particular to ui: one PR per cycle, CI on the head SHA as the oracle,
squash merges into `main`.

## The cycle, as PRs

0. **Base** — before the first briefing and before every dependent one,
   `git log main --not origin/main` is empty. Agent worktrees start from
   `origin/main`; a local commit the agent pulls in by SHA lands in its PR
   and folds into the squash under the PR's type and scope. Push it first
   (after approval) or land it through its own PR.
1. **Implement** — one agent per PR in an isolated worktree (briefing
   additions below). The global two-in-flight limit has its ui reason
   here: each merge of `main` into a sibling costs a CI round and can cost
   a MIGRATION/baseline conflict (see CI and merge), so the next implementer
   starts when one of the two merges. The agent does not commit; you
   commit, push and open the PR from its report, without re-running its
   gates.
2. **Review** per the global skill. In this repo the level slip the
   reviewer meets most is type versus runtime. Comments in the diff are
   claims under CLAUDE.md's comment policy: effect claims are verified
   against a measurement, narrative and provenance are flagged for the
   commit message, "mirrors X" duplication comments are flagged. A docs
   page prints the same text twice — the live demo and the code listing —
   so a text locator can measure the listing; scope it to
   `[data-docs-preview]`.
3. **Fix rounds** — after the second (the global limit), if the
   verification still says `FIX FIRST`, the third verdict is yours: merge
   with `Refs #N` and the remainder named in the PR comment, or split the
   PR. A `MERGE` with a remainder is a `MERGE`; the remainder goes into the
   PR comment, not into a third round.
4. **CI, merge, cleanup** — below.

## Briefing additions (implementation agents)

- Fresh worktree builds first: `bun install` → `bunx --bun svelte-kit sync`
  (blocks, docs-app) → `bun run build:packages`.
- Worktree hygiene: no commits, no pushes, leave the package clean.
- `svelte-autofixer` after every `.svelte` edit; `bun --filter='<pkg>' run
  test`, never bare `bun test`.
- **Derive the gate list from `.github/workflows/ci.yml`, not from
  memory.** `bun --filter='@urbicon-ui/docs-app' run test` (counting
  oracles over blocks sources — a new `text-xs` use fails a published
  claim) is the one that gets forgotten, at the price of a red CI cycle.
  `size` is a per-PR **report** only (CI's `size-report` job runs it
  without `--check`) — it does not gate a PR. The `--check` gate and any
  `--update-baseline` happen at the release bump (`scripts/bump.sh`),
  **measured on top of merged main**, or the baseline freezes a stale
  sibling package.
- **Comment policy** (CLAUDE.md → Coding Conventions): comments carry
  constraints, not history — bug stories and review provenance go into the
  commit message, effect claims must be measured, behaviour belongs in a
  test before it belongs in prose. An eleven-line comment on a one-line
  guard is commit-message material wearing a comment's clothes.

## CI and merge

- **You run no per-PR gates.** The implementer ran the ci.yml list in its
  worktree and reported the output; CI on the head SHA is the oracle, and
  the reviewer probes what a green local run cannot show (a run against
  the wrong tree, a moved baseline). A re-run in your own context re-reads
  the whole conversation per command and proves nothing CI does not.
- **The merged state has its own run.** The ruleset does not require a
  branch to be up to date before merging, so a PR's head-SHA run is not
  the state the squash produces. The latest `ci.yml` run on a push to
  `main` is; a dependent briefing waits for it to be green. `ci.yml`
  cancels a running push run when the next merge lands, so a `cancelled`
  run is superseded, not red. After a merge of `main` into a sibling, that
  sibling's new head-SHA run is the check.
- **Never trust `gh pr checks --watch` alone.** Right after a push it can
  read the previous SHA's rollup and exit green before the new checks are
  registered. Before merging, verify the head SHA directly:
  ```bash
  HEAD=$(gh pr view <N> --json headRefOid --jq .headRefOid)
  gh api "repos/:owner/:repo/commits/$HEAD/check-runs" \
    --jq '[.check_runs[].conclusion] | group_by(.) | map({c: .[0], n: length})'
  ```
- Squash-merge with explicit `--subject`/`--body` — the body lands in the
  changelog. `Closes #N` only on the wave that finishes the issue; earlier
  waves say `Refs #N`. GitHub's keyword parser knows no negation — "This
  does not close #14." closed #14 — so no close/fix/resolve in any form
  directly before `#N` in a commit or PR text that should not close it
  ("#14 stays open: …"); after a merge that names an issue, check
  `gh issue view <N> --json state`.
- Document the review outcome as a PR comment (findings → what happened to
  each, including the ones deliberately not done and why).
- **Parallel PRs collide on `packages/blocks/docs/MIGRATION.md`.** Every
  breaking PR adds its entries under the same `## <next version>` heading,
  so a merge of `main` into a sibling can conflict there. The resolution is
  mechanical: strip the three markers, keep both blocks (order within a
  release does not matter), commit the merge, push — one CI round per
  merge of `main`, so merge PRs promptly rather than batching them.

## Cleanup — a named final step, per merged PR

PR branch (local; GitHub auto-deletes remote), the agent's worktree, the
`worktree-*` scaffolding branch, then `git worktree prune`. `git pull` main
before the next dependent briefing. Only the PR's head SHA proves it landed
(squash merges make `--merged` useless).

## Wave close

Bump per the `release-bump` skill once the chain is coherent and the tree
is clean — a `feat` anywhere in the set makes it minor.

Record what the wave cost before pruning anything: `bun run wave:cost
--since <first day of the wave> --until <last day> --agents`. The global
skill says what to read from the table; it goes into the wave's protocol,
next to the previous wave's row. The session doing the recording is in
the population it reads.

Then prune what the wave made obsolete, as a named step rather than a
someday — the global list, plus here: every `Decided <date>, pending #N`
marker whose issue the wave closed (`git grep -n "pending #"`, then filter
for the wave's issues); the doc sentences and comments the code change
falsified (grep the identifiers you changed across `docs/` and
`packages/*/docs`); and the implementation postscript into the
probe/analysis document that spawned the wave.
