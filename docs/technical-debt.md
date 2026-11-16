# Technical Debt

**Open findings live as GitHub issues, not in this file.**

Every open entry was migrated to <https://github.com/urbicon/ui/issues> on
2026-07-31, one issue per entry, labelled `debt:<section>` after the section it
came from. Browse them with:

```bash
gh issue list --label debt:accessibility        # one section
# all of them — GitHub search has no label wildcard, so the query ORs every
# debt:* label by name
gh issue list --limit 200 --search "label:$(gh label list --limit 200 --json name --jq '[.[].name | select(startswith("debt:"))] | join(",")')"
```

Entries closed while this file was still the working log are in its git
history: `git log -p -- docs/technical-debt.md`.

> **Canon.** How an issue is labelled, parked and grouped is described once, here. Whether a
> finding becomes an issue at all is [AGENTS.md § Project tracking](../AGENTS.md#project-tracking).

## Logging a new finding

Open an issue with the four label axes below and a milestone. The entry format that grew
here is worth keeping, because it is what makes an entry actionable months
later — state each of these explicitly:

- **Where** — the files, with line numbers where they help
- **What** — the defect, with the measurement that shows it (not "seems slow")
- **Why deferred** — what decision or sweep it is waiting on. An entry without
  this is not debt, it is a bug report
- **Found** — when, and what surfaced it

## Labels

Every issue carries four label axes, set when it is opened (`enhancement` issues carry no
`debt:` axis) — a new issue with only a `debt:` label erodes the taxonomy:

| axis              | values                                                                                                                                           | meaning                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `debt:<area>`     | the existing values as in `gh label list`                                                                                                        | the topic                         |
| `pkg:<package>`   | the package name as in `gh label list`                                                                                                           | where it lives (multiple allowed) |
| `prio:P1\|P2\|P3` | **P1 = someone comes to harm**: a security hole, wrong data, a crash, a keyboard trap. Not "touches shipped code" — in a library every line does | the order                         |
| `size:S\|M\|L`    | a session · about a day · a wave                                                                                                                 | the cost                          |

Plus two state labels: **`ready`** — the path is clear, no open design decision — and
`blocked:upstream`. `ready` is deliberately the positive label: nearly every deferred finding
waits on a decision, so a `needs-decision` label would sort nothing. The useful question is
what can be picked up right now (`gh issue list --label ready`). There is no P0; that channel
stays free for an actual fire.

**`parked`** — closed, but the finding stands; nobody was hurt by it.
`gh issue list --state closed --label parked` brings the set back, bodies and comments intact.
Reopen when it costs someone something real. Prefer parking to a low priority: a long open
list buries every entry, whatever number sits beside it.

## Milestones and cross-links

Milestones are cut by work focus, not by urgency — one pass over a component beats four;
`prio:` carries the order instead. Every issue sits in exactly one, and every milestone has a
description saying why its issues belong together.
`gh api repos/:owner/:repo/milestones --jq '.[].title'` lists them; put a new issue in one
rather than leaving it unassigned.

Cross-links go in the body, as a `**Related:**` block after a `---` at the end, and are worth
writing when the connection crosses a milestone — that is exactly what the milestone view
cannot show.

There is no board: a project board over these labels would be a hand-synced copy of them.
The `gh issue list` and milestone queries are the view.
