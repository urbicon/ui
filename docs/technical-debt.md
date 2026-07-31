# Technical Debt

**Open findings live as GitHub issues, not in this file.**

Every open entry was migrated to <https://github.com/urbicon/ui/issues> on
2026-07-31, one issue per entry, labelled `debt:<section>` after the section it
came from. Browse them with:

```bash
gh issue list --label debt:accessibility        # one section
gh issue list --search "label:debt:*"           # all of them
```

## Logging a new finding

Open an issue with the matching `debt:*` label. The entry format that grew
here is worth keeping, because it is what makes an entry actionable months
later — state each of these explicitly:

- **Where** — the files, with line numbers where they help
- **What** — the defect, with the measurement that shows it (not "seems slow")
- **Why deferred** — what decision or sweep it is waiting on. An entry without
  this is not debt, it is a bug report
- **Found** — when, and what surfaced it

The bar has not changed either: log genuine deferrals, not what the code, the
git history or a planned TODO already covers.

## Resolved

Entries closed while this file was still the working log. Their full text is in
this file's own git history (`git log -p -- docs/technical-debt.md`) — and, for
maintainers, in the local `docs/archive/` working copy, which is deliberately
not part of the published repo.

**API design**

- ~~Field label/helper/error MARKUP is re-implemented per form component (part b)~~ — message extracted across all ten fields (2026-07-26/27), label divergence kept on purpose

**Component behaviour**

- ~~Table persists a *controlled* `searchTerm`, unlike controlled selection~~ — resolved 2026-07-27

**Accessibility**

- ~~Rooms skin pins `--color-primary` to the raw accent in both modes — dark-mode accent-as-foreground misses the floor~~ — resolved 2026-07-30, by the Material-3 split the entry kept asking for

**Docs coverage**

- ~~A new docs page has to be hand-registered in two places, and nothing checks it~~ — gated 2026-07-30 (`registry:lint`), and it was three places
- ~~`TabProps`' JSDoc examples show an API that does not compile~~ — gated 2026-07-30 (`examples:lint`)
- ~~A `@related`/`@tag` value swallows the prose that follows the tag block~~ — fixed 2026-07-30

**docs-gen**

- ~~`@see` on a *type* is still swallowed~~ — resolved 2026-07-27; the mid-sentence trap stays open
- ~~docs-gen's vitest never runs `src/**/*.test.ts`~~ — resolved 2026-07-27, both suites are real coverage and now run

**Design tokens**

- ~~The VR matrix has no hover, focus or disabled state~~ — resolved 2026-07-26, and a pixel suite turned out to be the wrong tool for half of it
- ~~docs-gen extracts `Pick<X, …>` in an extends clause as one prop named "...Pick"~~ — fixed 2026-07-30

**Design engine**

- ~~"slop" is the public name of the second score axis, and it is the wrong word to say out loud~~ — renamed 2026-07-30
- ~~The CSS reference teaches no z-index tokens, but the linter requires them~~ — withdrawn 2026-07-27, the reference does teach them
- ~~The CLI silently ignores unknown flags, so an agent cannot tell a typo from a result~~ — fixed 2026-07-27
- ~~The ADR log's `status` field is inert, and the log cannot express supersession~~ — fixed 2026-07-30
- ~~The CLI has been fixed four times for the same failure — it needs one audit, not a fifth fix~~ — swept 2026-07-30

