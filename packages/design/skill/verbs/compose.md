# compose — design a new page or component from a brief

**When:** building something new. Runs the full generate → validate → judge →
synthesise loop so a single-shot answer can't regress to a generic template.
**Gate:** correctness (blocking) + craft floor (advisory) + the rubric.

Do not skip steps. The value is in the loop, not any one generation.

1. **Context.** `urbicon context` (or read `./design.manifest.md`) — honour the
   paradigm, theme, density, the Product Intent (design *toward* its voice and
   references, *away* from its anti-references), and the recorded ADRs. Then, if a
   composition pattern fits the brief, `urbicon pattern <name>` (settings-page,
   dashboard, form-page, tab-navigation, onboarding-guide, planning-board; MCP:
   `get_pattern`) and follow its layout, component-selection, and behavioural rules.
2. **Ground rules.** `urbicon principles` for the heuristics, `urbicon principles
   --topic theming` for the paradigm's token profile, and `urbicon css-reference`
   for the exact token names (MCP: `get_design_principles` / `get_css_reference`).
   `urbicon find` / `get-component` to pick the right primitives rather than
   reinventing them (MCP: `find_components` / `suggest_implementation`).
3. **Generate variants.** Produce a few genuinely different implementations (2–5;
   default 3), each a distinct compositional approach *within* the paradigm — vary
   density, hierarchy emphasis, and the one signature moment. Do not let them
   converge. Use only real semantic tokens (no `bg-status-*`, no `*-foreground`, no
   invented names); if the project defines its own, they're in `## Token Overrides`.
4. **Validate.** Run `urbicon validate` (or the `validate_design` MCP tool) on every
   variant. Fix each error and warning. A variant that can't reach a clean
   correctness score is disqualified. Note each one's craft score — the lower it is,
   the more the variant reads as generic defaults.
5. **Judge.** `urbicon principles --rubric` (MCP: `get_design_principles(as="rubric")`)
   and score each survivor /40. Prefer a panel: judge correctness, hierarchy,
   paradigm-fidelity, and distinctiveness as separate lenses, not one gut number.
6. **Synthesise.** Pick the winner, then graft the best ideas from the runners-up.
   Run `urbicon validate` once more on the merged result — it must come back clean.
7. **Record.** If the page follows a pattern, add `data-design-pattern="<name>"` to
   its root and refresh Pattern Usages (`urbicon sync-manifest`). Append an ADR
   (`urbicon record-decision`) for any deliberate deviation from a pattern or
   principle.

Output the final code, then a one-line, honest rationale per major choice — name the
trade-offs.
