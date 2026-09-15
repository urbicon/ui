---
name: knowledge-audit
description: Auditing the knowledge layer — memory, instructions, docs, tracker — for entropy, four checks in a fixed order with findings that name who pays. Use when AGENTS.md or the memory index outgrows its budget, when a review or a consumer hits a doc claim that is false, or for a periodic prose sonde.
---

# Auditing the knowledge layer

Code has gates; prose has none, and a wrong sentence is paid for by the next
session, silently. Four checks in a fixed order, each against an oracle rather
than a reading. Never run one in the context that wrote the prose it audits.

## When it is worth running

- AGENTS.md above the budget `bun run docs:refs:check` enforces and prints.
- The memory index above 1,250 words (`wc -w` on `MEMORY.md`).
- A review, a consumer or a derailed session hit a claim that is false.
- Otherwise at most quarterly: self-inspection finds findings without limit, so
  a run needs a trigger, not a calendar.

## 1. Memory

The project memory is maintainer-local, not in the repo, so this check runs in
`~/.claude/projects/-Users-felix-Workspace-ui/memory/`. Every index line
resolves to a file and every file is indexed — compare the two listings instead
of eyeballing them:

```bash
comm -3 <(grep -o '([a-z_0-9]*\.md)' MEMORY.md | tr -d '()' | sort) \
        <(ls *.md | grep -v '^MEMORY\.md$' | sort)
```

Left column: an index line pointing at nothing. Right: a file nobody links.
Each hook — the one-line summary the index carries — must say what its file
says; a drifted hook is worse than no entry, because the hook is what gets read.
Anything already codified in AGENTS.md, a skill or a doc is **deleted, not
kept**: the repo is canon, memory holds only what has no home in it yet.

## 2. Instructions

Reference integrity of AGENTS.md and every `.claude/skills/*/SKILL.md`: each
`bun run <script>` exists in a `package.json`, each path exists, each named constant
(`PLACEHOLDERS`, `NO_PAGE`, `BUCKET_PATTERNS`, …) is still in the script said to
hold it. `bun run docs:refs:check` is the gate for this; grep by hand for
whatever it does not cover — the last pass found a deleted constant still cited,
two wrong package names, and a hook described as local that exists only in the
consumer template.

Then a history-vs-constraint pass over AGENTS.md, applying its own rule to
itself: classify each sentence as rule, pointer or provenance. Provenance that
names no constraint the next edit would honour is the finding — count those
words, then cut them.

## 3. Docs

- **Numbers.** A bare digit grep returns thousands of lines, nearly all of them
  dates, versions, issue numbers and CSS values, which the rule does not cover.
  Narrow it to counts and rosters in prose, and read only the survivors:

  ```bash
  grep -nE '[0-9]+ ?(LoC|%|files|components|packages|milestones|entries|of [0-9]+|[a-z]{3,}s\b)' \
    docs/*.md packages/*/docs/*.md |
    grep -vE '[0-9]{4}-[0-9]{2}|v[0-9]+\.[0-9]+|#[0-9]+|[0-9]+(px|rem|em|ms)\b'
  grep -inE '\b(six|seven|eight|nine|ten|eleven|twelve|thirteen|seventeen) [a-z]+s\b' \
    docs/*.md packages/*/docs/*.md
  ```

  The second pass is not optional: "six families" carries no digit, and a
  spelled-out roster count is exactly how a roster goes stale. A survivor that
  counts something in the tree names the command that reproduces it, or goes; a
  count that only introduces the list in the same paragraph is its own oracle
  and stays. A retyped roster counts as a number. Run both passes over
  `packages/*/README.md`, `packages/docs-gen/templates/*.md` and
  `.claude/skills/*/SKILL.md` too, and add the hyphenated form (`six-family`) —
  the stale copies the 2026-09-14 pass fixed sat in exactly those files and in
  that spelling.

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
