---
name: pr-wave
description: Driving an implementation wave as a chain of PRs — worktree-isolated implementation agents, adversarial review cycles with fix verification, CI/merge flow, cleanup. Use when implementing a set of issues as reviewed PRs, or when orchestrating parallel implementation agents.
---

# Driving a PR wave

The procedure that shipped the table-v8 waves and the #251/#240 chain
(#258–#260, 2026-08-22). One cycle per PR; disjoint PRs run in parallel,
two at a time (below), dependent ones wait for the merge and rebase their
briefing on it. The older shared-worktree variant (orchestrator stages and
commits for agents working in one tree) is retired; this file is the canon
for the PR-based form.

## The cycle

1. **Implement** — one agent per PR in an isolated worktree (briefing
   contract below). **At most two PRs in flight**: the next implementer
   starts when one of them merges. The merges are serial regardless (each
   merge of `main` into a sibling costs a MIGRATION/baseline conflict and a
   CI round, see CI and merge), so a third parallel PR saves wall-clock only
   up to the merge queue, while every agent in flight adds its own cache
   reads — priced, the bulk of a wave's spend, several times the
   orchestrator's — and adds reports and routing to the orchestrator's
   output, under a third of a wave's output on a floor that undercounts the
   subagents, not the largest line (measured 2026-09-22 over the waves of
   2026-08-18 to 2026-09-17; its transcripts are being pruned, so a re-run
   no longer reproduces it — a dated baseline; Wave close measures a new
   wave). The agent does not commit;
   you commit, push and open the PR from its report, without re-running its
   gates (CI on the head SHA is the oracle, see CI and merge).
2. **Adversarial review in a fresh context** — never the implementing
   agent, never yourself. Findings need file:line, severity, a concrete
   failure scenario, and a premise check against the actual code before
   they count. The review reads the implementer's claim split first: a
   claim filed as measured is re-measured with the reviewer's own rig and
   population; one filed as following from the diff is checked for the
   level it actually holds on (type versus runtime is the recurring slip).
   Comments in the diff are claims: verify effect claims against a
   measurement, flag narrative/provenance that belongs in the commit
   message, flag "mirrors X" duplication comments (four comment findings in
   one wave came from exactly these checks). Every baseline, exemption or
   allowlist change in the diff is a claim to probe — an agent that takes a
   file for proven baselines a real bug away. The verdict is `FIX FIRST`,
   `MERGE`, or `MERGE` with a remainder — open P3s the reviewer lists but
   does not hold the merge for — with a findings block you route verbatim
   (report contracts below).
3. **Fix round** — route the findings block verbatim to the implementing
   agent via SendMessage (it has the context); take only small,
   sharply-scoped fixes yourself. Decide contested options in the routing
   message instead of letting the agent pick silently. **Two fix rounds at
   most.** If the second verification still says `FIX FIRST`, the third
   verdict is yours: merge with `Refs #N` and the remainder named in the PR
   comment, or split the PR. A `MERGE` with a remainder is a `MERGE`; the
   remainder goes into the PR comment, not into a third round, which re-reads
   the whole PR for the implementer and the reviewer for the same
   information. Two PRs have needed a third round so far (#421, #455).
4. **Fix verification by the same reviewer** — cheap (context loaded) and
   it catches half-done fixes: expect a `MERGE` with a remainder or a
   follow-up finding. A guard-like fix is only done with a red-before-fix
   run and a positive control (sabotage the guard, watch exactly the new
   test fail).
5. **CI, merge, cleanup** — flow below.

## Report contracts

Both reports are read by you and routed by copying, so they are
structured, not prose — a report you have to re-narrate costs a second
reading of the whole conversation per PR.

**Implementer** (final message, these sections in this order):

- `Files` — path and one sentence each.
- `Gates` — the ci.yml list run in the worktree, output verbatim; a gate
  whose output names a path (`svelte-check` prints its root) proves which
  tree ran.
- `Claims` — three lists: **measured** (command and population),
  **follows** (from the diff, no run needed), **quoted** (from a doc or an
  issue, unverified). A claim filed as measured that only follows from
  structure has hidden the missing measurement in every wave it appeared
  in; the split is what the reviewer reads first.
- `Decisions` — each with the rejected alternative.
- `Omitted` — deliberately, with the reason.

**Reviewer** (final message):

- `Verdict` — `FIX FIRST`, `MERGE`, or `MERGE` with a remainder.
- `Findings` — each with file:line, severity (P1–P3), failure scenario,
  premise check, and the fix the reviewer would accept; under a `MERGE`
  with a remainder, the remainder is this list.
- `Probed` — what was checked and held, with the rig, so the fix
  verification knows what not to repeat.

## Briefing contract (implementation agents)

- Fresh worktree builds first: `bun install` → `bunx --bun svelte-kit sync`
  (blocks, docs-app) → `bun run build:packages`.
- Worktree hygiene: only paths under the worktree root, never `git -C`
  into the main checkout, no commits, no pushes, leave the package clean.
- `svelte-autofixer` after every `.svelte` edit; `bun --filter='<pkg>' run
  test`, never bare `bun test`.
- **Derive the gate list from `.github/workflows/ci.yml`, not from
  memory.** `bun --filter='@urbicon-ui/docs-app' run test` (counting
  oracles over blocks sources — a new `text-xs` use fails a published
  claim) got forgotten in this wave's first two PRs, each costing a red CI
  cycle. `size` is a per-PR **report** only (CI's `size-report` job runs
  it without `--check`) — it does not gate a PR. The `--check` gate and any
  `--update-baseline` happen at the release bump (`scripts/bump.sh`),
  **measured on top of merged main**, or the baseline freezes a stale
  sibling package.
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
- Report contract: the implementer section above, quoted in the briefing.

## CI and merge

- **You run no per-PR gates.** The implementer ran the ci.yml list in its
  worktree and reported the output; CI on the head SHA is the oracle, and
  the reviewer probes what a green local run cannot show (a run against
  the wrong tree, a moved baseline). A re-run in your own context re-reads
  the whole conversation per command and proves nothing CI does not.
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
  waves say `Refs #N`. GitHub's keyword parser knows no negation — "This
  does not close #14." closed #14 — so no close/fix/resolve in any form
  directly before `#N` in a commit or PR text that should not close it
  ("#14 stays open: …"); after a merge that names an issue, check
  `gh issue view <N> --json state`.
- Document the review outcome as a PR comment (findings → what happened to
  each, including the ones deliberately not done and why).
- **Parallel PRs collide on `packages/blocks/docs/MIGRATION.md`.** Every
  breaking PR adds its entries under the same `## <next version>` heading,
  so each merge of `main` into a sibling conflicts there. The resolution is
  mechanical: strip the three markers, keep both blocks (order within a
  release does not matter), commit the merge, push — one CI round per
  merge of `main`, so merge PRs promptly rather than batching them.
- **Commitlint rejects a subject that starts with a capital** (`subject-case`),
  which a component name at the front of the subject triggers — write "the
  CommandPalette owns…", not "CommandPalette owns…".
- **A throwaway worktree needs `bun install` before it can commit**: the
  lefthook hooks run prettier/biome from `node_modules`, and without them the
  commit fails with a module-not-found error while `git push` still pushes
  the unchanged branch.
- **The bump's `bun run test` runs every package suite concurrently**
  (`bun --bun --filter='*' run test`); the docs-gen suite rewrites the
  design-content bundle that the mcp-server suite reads, and the bump can
  fail on `design-prompts.test.ts` with an empty verb body. Re-run once; CI
  runs the suites sequentially and does not race.

## Cleanup — a named final step, per merged PR

PR branch (local; GitHub auto-deletes remote), the agent's worktree, the
`worktree-*` scaffolding branch, then `git worktree prune`. `git pull` main
before the next dependent briefing. Only the PR's head SHA proves it landed
(squash merges make `--merged` useless).

## Wave close

Bump per the `release-bump` skill once the chain is coherent and the tree
is clean — a `feat` anywhere in the set makes it minor.

Record what the wave cost before pruning anything: `bun run wave:cost
--since <first day of the wave> --until <last day> --agents` prints, per
session and per subagent, output tokens, cache reads and writes by TTL,
the turns that followed a pause longer than five minutes, the fresh-context
cost of each agent, the peak number of agents active in the same minute,
and the word each role was read from; an output figure marked as a floor
is one whose transcript carries no final usage for some turns. The table
goes into the wave's internal protocol, to be read against the dated
baseline in step 1. Claude Code prunes transcripts after
`cleanupPeriodDays` (30 by default), so a wave measured later than that
has no data left — which is what made that baseline unreproducible —
record it at close, not
at the next audit; and the session doing the recording is in the
population it reads.

Then prune what the wave made obsolete, as a named step rather than a
someday: memory entries whose delete-condition the wave met; every
`Decided <date>, pending #N` marker whose issue the wave closed
(`git grep -n "pending #"`, then filter for the wave's issues); the doc
sentences and comments the code change falsified (grep the identifiers
you changed across `docs/` and `packages/*/docs`); and the
implementation postscript into the probe/analysis document that spawned
the wave. Then update the project memory — with what the wave leaves
standing, not with what it did. A wave that only adds leaves the next
one reading its leftovers as current, and the write-up that would have
said so is the first thing to go stale.
