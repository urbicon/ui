# adopt — bring an existing codebase under the design system

**When:** a project already has UI but no (or a thin) `design.manifest.md`. Infers
the de-facto design language from the code and records it, surfacing the drift
between what the code does and what Urbicon expects.
**Gate:** none — this verb writes memory and reports; it doesn't rewrite UI.

1. **Read what's already recorded.** `urbicon context`. Anything present (a chosen
   paradigm, a prior ADR) constrains what you infer — don't contradict it silently.
2. **Index the patterns.** `urbicon sync-manifest` to scan for
   `data-design-pattern="…"` markers and (re)build the Pattern Usages section. If
   the code has no markers yet, note which page archetypes you recognise and propose
   adding markers (`urbicon pattern` lists the archetype names; MCP: `get_pattern`).
3. **Infer the token reality.** Grep the source for the colour / spacing / radius
   utilities actually in use. Sort them into: real Urbicon semantic tokens; project
   tokens defined on top of Urbicon (→ candidates for `## Token Overrides`); and raw
   palette / hallucinated tokens (→ drift to fix later with `fix`). Cross-check
   names against `urbicon css-reference` (MCP: `get_css_reference`).
4. **Infer the intent.** From the components, copy, and density, draft a **Product
   Intent** (audience, voice, references, anti-references) and confirm it with the
   user — inference seeds it, the user ratifies it. Don't invent an audience the
   code doesn't evidence.
5. **Measure the drift.** Run `urbicon validate src/ --record` over the tree. The
   correctness score is the gap to close; the craft score is how considered it
   reads today — a low one means the page is coasting on defaults. `--record` writes
   the first history entry so future runs show the trend.
6. **Seed the manifest.** Write the inferred `## Product Intent`, the confirmed
   `## Token Overrides`, and the synced `## Pattern Usages`. Append an ADR recording
   that the manifest was *adopted from existing code* on this date (so later readers
   know it's inferred, not designed-first).
7. **Report.** Summarise: paradigm, intent, N project tokens, M patterns in use, and
   the top correctness/craft offenders — with `fix` / `retheme` / `audit` as the
   suggested follow-ups.
