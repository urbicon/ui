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
