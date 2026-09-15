---
name: knowledge-audit
description: Auditing the knowledge layer — memory, instructions, docs, tracker — for entropy, four checks in a fixed order with findings that name who pays. Use when AGENTS.md or the memory index outgrows its budget, when a review or a consumer hits a doc claim that is false, or for a periodic prose sonde.
---

# Auditing the knowledge layer

Code has gates; prose has none, and a wrong sentence is paid for by the next
session, silently. Four checks in a fixed order, each against an oracle rather
than a reading. Never run one in the context that wrote the prose it audits.

## When it is worth running

- `wc -w AGENTS.md` above its 3,300-word budget.
- The memory index above 1,250 words (`wc -w` on `MEMORY.md`).
- A review, a consumer or a derailed session hit a claim that is false.
- Otherwise at most quarterly: self-inspection finds findings without limit, so
  a run needs a trigger, not a calendar.

## 1. Memory

Every index line resolves to a file and every file is indexed — `comm -3` over
the two listings, not an eyeball pass. Each hook must say what its file says; a
drifted hook is worse than no entry, because the hook is what gets read.
Anything already codified in AGENTS.md, a skill or a doc is **deleted, not
kept**: the repo is canon, memory holds only what has no home in it yet.

## 2. Instructions

Reference integrity of AGENTS.md and every `.claude/skills/*/SKILL.md`: each
`bun run X` exists in a `package.json`, each path exists, each named constant
(`PLACEHOLDERS`, `NO_PAGE`, `BUCKET_PATTERNS`, …) is still in the script said to
hold it. The CI check `docs:refs:check` will own this; until it exists, grep
each by hand — the last pass found a deleted constant still cited, two wrong
package names, and a hook described as local that exists only in the consumer
template.

Then a history-vs-constraint pass over AGENTS.md, applying its own rule to
itself: classify each sentence as rule, pointer or provenance. Provenance that
names no constraint the next edit would honour is the finding — count those
words, then cut them.

## 3. Docs

- **Numbers.** `grep -nE "[0-9]" docs/*.md packages/*/docs/*.md`: every count,
  LoC figure or percentage names the command that reproduces it, or goes. A
  retyped roster counts as a number.
- **Markers.** `git grep -n "pending #"`, then `gh issue view <N> --json state`:
  a marker whose issue is closed is a decision to write into the prose or delete.
- **Canon.** Every `> **Canon.**` section appears in docs/README.md § Canon map,
  and every row of that map points at a file or heading that exists. Both
  directions, or the map is the next stale doc.

## 4. Tracker

The internal TODO is a Stand document, not a list: any `- [ ]` item is either a
GitHub issue or dropped. The internal index names exactly the files present —
no ghosts, no unlisted ones.

## Output

One finding per piece of evidence: `file:line`, what is wrong, and **who pays**
— which session or consumer, and with what. Mark each VERIFIED or SUSPECTED and
keep the two apart. No global grade: "the docs are good" is the answer the
question invites and the one that changes nothing.

Then stop. Act on the findings as a `pr-wave`, in fresh contexts — the audit
context is the worst place to fix what it just found. The 2026-09-14 run, whose
write-ups are maintainer-local, is the worked example.
