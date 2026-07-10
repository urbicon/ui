---
name: urbicon-design
description: Design verbs for projects built on Urbicon UI — onboard, adopt, compose, redesign, polish, critique, fix, retheme, audit, migrate. Each is a recipe over the four design planes (knowledge · judgment · memory · action) that reads the project's design.manifest.md, does the work through the Urbicon tools, and writes the decision back.
---

# Urbicon design verbs

A use-case verb is a **recipe**, not a single tool call: it strings the Urbicon
knowledge (`urbicon pattern` / `css-reference` / `principles`), the deterministic
judgment (`urbicon validate`, the rubric), and the per-project memory
(`design.manifest.md`) into one loop so generation does not regress to a generic
template.

**Same recipe text, two ways to run it.** Every verb ships both as an MCP prompt
(invoke it from any MCP client) and as one of these local recipe files. The body is
identical; pick whichever your harness exposes. Locally you can also print a recipe
with `urbicon verb <name>` (and list them with `urbicon verbs`).

**Local CLI first.** Every knowledge/judgment step below has a local CLI form
(version-matched to the installed library) and a remote MCP form (serves latest).
When the project has `@urbicon-ui/design` installed, use the CLI — **even if the
`urbicon-ui` MCP server is also connected**; on any disagreement the CLI is right
for this project. Reach for the MCP tools only where there is no local install
(e.g. evaluating the library before adopting it).

## Two invariants, every verb

1. **Read the manifest first.** Start by recovering the project's intent and
   decisions — `urbicon context`, or read `./design.manifest.md` directly: paradigm,
   theme, density, the Product Intent (audience, voice, references, anti-references),
   the Token Overrides, the Pattern Usages, and the recorded ADRs. This is the
   difference between "consistent with *this* product" and merely "generic".
2. **Write the decision back.** End by persisting any state you changed — refresh
   the Pattern Usages (`urbicon sync-manifest`), append an ADR for a deliberate
   deviation (`urbicon record-decision`), or update the Product Intent / Token
   Overrides. A choice the next session can't see will be silently undone.

## Router — intent → verb

| If the user wants to… | Verb | Gate |
| --- | --- | --- |
| Start a greenfield project, set its design identity | `onboard` | — |
| Bring an existing codebase under the design system | `adopt` | — |
| Build a new page or component from a brief | `compose` | correctness + slop + rubric |
| Rework an existing page that feels wrong | `redesign` | correctness + slop + rubric |
| Tighten a page that is already close | `polish` | slop-floor |
| Judge a page without changing it | `critique` | (assessment only) |
| Repair broken tokens / `dark:` / `focus:` / z-index | `fix` | correctness |
| Rebrand the system (colour, type, density) | `retheme` | correctness over affected files |
| Check consistency across the whole app | `audit` | (assessment over n pages) |
| Roll out a pattern or library change everywhere | `migrate` | correctness per file |

When the intent is ambiguous, prefer the **narrowest** verb that fits: `polish`
before `redesign`, `fix` before `compose`. Escalate only if the narrow verb's
diagnosis shows the problem is bigger than its remit.

## The tools a recipe leans on

- **Knowledge** — `urbicon find` / `get-component` / `pattern` / `recipe` /
  `css-reference` / `icons` / `principles` (add `--rubric` for the 8-criterion
  scorer; `--topic theming` for a paradigm's token profile).
  MCP equivalents: `find_components`, `get_component`, `get_pattern`, `get_recipe`,
  `get_css_reference`, `find_icons`, `get_design_principles`.
- **Judgment** — `urbicon validate` (also the hook/CI gate; reads the project's
  `## Token Overrides` itself), or remote `validate_design(code, extraTokens?)`:
  two axes either way, correctness (the blocking gate) + slop-floor (advisory).
- **Memory** — `urbicon context` / `record-decision` / `sync-manifest`, or your own
  file tools on `./design.manifest.md` and its `*.history.ndjson` sidecar. Local
  only — the stateless remote server never touches project files.

Use only real semantic tokens — never invent `bg-status-*`, `text-*-foreground`,
`bg-card`. When in doubt, `urbicon css-reference`.
