---
name: pr-wave
description: Driving an implementation wave as a chain of PRs — worktree-isolated implementation agents, adversarial review cycles with fix verification, CI/merge flow, cleanup. Use when implementing a set of issues as reviewed PRs, or when orchestrating parallel implementation agents.
---

# Driving a PR wave

The procedure that shipped the table-v8 waves and the #251/#240 chain
(#258–#260, 2026-08-22). One cycle per PR; disjoint PRs run in parallel,
dependent ones wait for the merge and rebase their briefing on it. The
older shared-worktree variant (orchestrator stages and commits for agents
working in one tree) lives in the session memory playbook; this file is the
canon for the PR-based form.

## The cycle

1. **Implement** — one agent per PR in an isolated worktree (briefing
   contract below). The agent does not commit; you verify, commit, push,
   open the PR.
2. **Adversarial review in a fresh context** — never the implementing
   agent, never yourself. Findings need file:line, severity, a concrete
   failure scenario, and a premise check against the actual code before
   they count. Comments in the diff are claims: verify effect claims
   against a measurement, flag narrative/provenance that belongs in the
   commit message, flag "mirrors X" duplication comments (four comment
   findings in one wave came from exactly these checks).
3. **Fix round** — route findings back to the implementing agent via
   SendMessage (it has the context); take only small, sharply-scoped fixes
   yourself. Decide contested options in the routing message instead of
   letting the agent pick silently.
4. **Fix verification by the same reviewer** — cheap (context loaded) and
   it catches half-done fixes: expect PARTIAL verdicts to surface a
   follow-up finding. A guard-like fix is only done with a red-before-fix
   run and a positive control (sabotage the guard, watch exactly the new
   test fail).
5. **CI, merge, cleanup** — flow below.

## Briefing contract (implementation agents)

- Fresh worktree builds first: `bun install` → `bunx --bun svelte-kit sync`
  (blocks, docs-app) → `bun run build:packages`.
- Worktree hygiene: only paths under the worktree root, never `git -C`
  into the main checkout, no commits, no pushes, leave the package clean.
- `svelte-autofixer` after every `.svelte` edit; `bun --filter='<pkg>' run
  test`, never bare `bun test`.
- **Derive the gate list from `.github/workflows/ci.yml`, not from
  memory.** The two that got forgotten in this wave's first two PRs, each
  costing a red CI cycle: `bun --filter='@urbicon-ui/docs-app' run test`
  (counting oracles over blocks sources — a new `text-xs` use fails a
  published claim) and `bun run size --check` (after intentional growth:
  `--update-baseline` with the measured number, **measured on top of
  merged main**, or the baseline freezes a stale sibling package).
- **Every risk you already see goes into BOTH briefings** — the
  implementation one (build the harness that would expose it) and the
  review one (probe it). In this wave the grid/menu keyboard collision sat
  only in the review briefing; the review caught the P1, but that was
  redundancy as rescue and cost a full fix round.
- **Comment policy** (CLAUDE.md → Coding Conventions): comments carry
  constraints, not history — bug stories and review provenance go into the
  commit message, effect claims must be measured, behaviour belongs in a
  test before it belongs in prose. An eleven-line comment on a one-line
  guard is commit-message material wearing a comment's clothes.
- Report contract: changed files with one sentence each, verbatim gate
  output, decisions with the rejected alternative, deliberate omissions.

## CI and merge

- **Never trust `gh pr checks --watch` alone.** Right after a push it can
  read the previous SHA's rollup and exit green before the new checks are
  registered (happened twice in one wave). Before merging, verify the head
  SHA directly:
  ```bash
  HEAD=$(gh pr view <N> --json headRefOid --jq .headRefOid)
  gh api "repos/:owner/:repo/commits/$HEAD/check-runs" \
    --jq '[.check_runs[].conclusion] | group_by(.) | map({c: .[0], n: length})'
  ```
- Squash-merge with explicit `--subject`/`--body` — the body lands in the
  changelog. `Closes #N` only on the wave that finishes the issue; earlier
  waves say `Refs #N`.
- Document the review outcome as a PR comment (findings → what happened to
  each, including the ones deliberately not done and why).

## Cleanup — a named final step, per merged PR

PR branch (local; GitHub auto-deletes remote), the agent's worktree, the
`worktree-*` scaffolding branch, then `git worktree prune`. `git pull` main
before the next dependent briefing. Only the PR's head SHA proves it landed
(squash merges make `--merged` useless).

## Wave close

Bump per the `release-bump` skill once the chain is coherent and the tree
is clean — a `feat` anywhere in the set makes it minor. Then write the
implementation postscript into the probe/analysis document that spawned
the wave, and update the project memory.
