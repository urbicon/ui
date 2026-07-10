# onboard — set a greenfield project's design identity

**When:** a new project with no `design.manifest.md` yet. Establishes the target
identity and the enforced intake decisions, so every later verb has an anchor.
**Gate:** none — this verb writes memory, it doesn't generate UI.

Run a short interview, then seed the manifest. Do not skip the interview: a manifest
with only defaults gives later verbs nothing to be consistent *with*.

1. **Check for an existing manifest.** `urbicon context` (or look for
   `./design.manifest.md`). If one already exists with real intent, stop and suggest
   `adopt` or `audit` instead — onboarding twice overwrites a considered identity.
2. **Interview the product intent.** Ask the user — one question at a time, accept
   terse answers — for:
   - **Audience:** who uses this, their context, constraints, expertise.
   - **Voice:** three adjectives (e.g. *calm, precise, trustworthy*).
   - **References:** one or two products whose feel to move toward.
   - **Anti-references:** the generic defaults to avoid (e.g. "Bootstrap admin").
3. **Settle the intake decisions.** Pick a **paradigm** (`urbicon principles
   --topic theming` shows the profiles; MCP: `get_design_principles(topic="theming")`),
   a **theme**, and a **density**. Explain the trade-off in one line each; default to Minimal /
   default / comfortable if the user is unsure.
4. **Seed the manifest.** Write `./design.manifest.md`: the frontmatter
   (`paradigm` / `theme` / `density`), and the `## Product Intent` section with the
   interview answers. `urbicon` writes a scaffold on first command, or author the
   file directly — keep the section headings exactly (`## Product Intent`,
   `## Token Overrides`, `## Pattern Usages`, `## Design Decisions`).
5. **Record the founding decision.** Append one ADR capturing *why* this paradigm
   and voice (`urbicon record-decision --title "…" --decision "…" --rationale "…"`).
   It is the reference the team — and the next session — argues against.
6. **Hand off.** Tell the user the identity is set and point them at `compose` for
   the first page. Confirm the manifest parses: `urbicon context` should echo the
   intent back.
