---
name: urbicon-design
description: Design verbs for projects built on Urbicon UI — onboard, adopt, compose, redesign, polish, critique, fix, retheme, audit, migrate. Each is a recipe over the four design planes (knowledge · judgment · memory · action) that reads the project's design.manifest.md, does the work through the Urbicon tools, and writes the decision back.
---

# Urbicon design verbs

A use-case verb is a **recipe**, not a single tool call: it strings the Urbicon knowledge,
the deterministic judgment (`urbicon validate`, the rubric), and the per-project memory
(`design.manifest.md`) into one loop so generation does not regress to a generic template.

Print a recipe with `urbicon verb <name>`; `urbicon verbs` lists them. Every verb also ships
as an MCP prompt with identical body text — pick whichever your harness exposes.

## Two invariants, every verb

1. **Read the manifest first.** Start by recovering the project's intent and decisions —
   `urbicon context`, or read `./design.manifest.md` directly: paradigm, theme, density, the
   Product Intent (audience, voice, references, anti-references), the Token Overrides, the
   Pattern Usages, and the recorded ADRs. This is the difference between "consistent with
   *this* product" and merely "generic".
2. **Write the decision back.** End by persisting any state you changed — refresh the Pattern
   Usages (`urbicon sync-manifest`), append an ADR for a deliberate deviation
   (`urbicon record-decision`), or update the Product Intent / Token Overrides. A choice the
   next session can't see will be silently undone.

## Router — intent → verb

| If the user wants to… | Verb | Gate |
| --- | --- | --- |
| Start a greenfield project, set its design identity | `onboard` | — |
| Bring an existing codebase under the design system | `adopt` | — |
| Build a new page or component from a brief | `compose` | correctness + craft + rubric |
| Rework an existing page that feels wrong | `redesign` | correctness + craft + rubric |
| Tighten a page that is already close | `polish` | craft floor |
| Judge a page without changing it | `critique` | (assessment only) |
| Repair broken tokens / `dark:` / `focus:` / z-index | `fix` | correctness |
| Rebrand the system (colour, type, density) | `retheme` | correctness over affected files |
| Check consistency across the whole app | `audit` | (assessment over n pages) |
| Roll out a pattern or library change everywhere | `migrate` | correctness per file |

When the intent is ambiguous, prefer the **narrowest** verb that fits: `polish` before
`redesign`, `fix` before `compose`. Escalate only if the narrow verb's diagnosis shows the
problem is bigger than its remit.

## Where the recipes get their inputs

Three planes, each with a local and a remote form. Run `urbicon` with no arguments for the
command list with flags; the MCP server exposes the same surface as tools.

- **Knowledge** — component discovery and APIs, icons, recipes, patterns, the token
  reference, the design principles (`--rubric` for the 8-criterion scorer, `--topic theming`
  for a paradigm's token profile).
- **Judgment** — `urbicon validate` / remote `validate_design`: two axes either way,
  correctness (the blocking gate) + craft (advisory). It reads the project's
  `## Token Overrides` itself, so project tokens are not flagged as hallucinated. Also runs
  as the PostToolUse hook and the CI gate.
- **Memory** — `urbicon context` / `record-decision` / `sync-manifest`, or your own file tools
  on `./design.manifest.md` and its `*.history.ndjson` sidecar. **Local only** — the stateless
  remote server never touches project files.

**Use the local CLI when the project has `@urbicon-ui/design` installed**, even if the
`urbicon-ui` MCP server is also connected: the CLI is version-matched to the installed
library, the remote serves *latest*, and on any disagreement the CLI is right for this
project. Reach for the MCP tools only where there is no local install (e.g. evaluating the
library before adopting it).

Use only real semantic tokens — never invent `bg-status-*`, `text-*-foreground`, `bg-card`.
When in doubt, `urbicon css-reference`.
