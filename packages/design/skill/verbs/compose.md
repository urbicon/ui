# compose — design a new page or component from a brief

**When:** building something new. Runs the full generate → validate → judge →
synthesise loop so a single-shot answer can't regress to a generic template.
**Gate:** correctness (blocking) + slop-floor (advisory) + the rubric.

Do not skip steps. The value is in the loop, not any one generation.

1. **Context.** `urbicon context` (or read `./design.manifest.md`) — honour the
   paradigm, theme, density, the Product Intent (design *toward* its voice and
   references, *away* from its anti-references), and the recorded ADRs. Then, if a
   composition pattern fits the brief, `get_pattern("<name>")` (settings-page,
   dashboard, form-page, tab-navigation, onboarding-guide, planning-board) and
   follow its layout, component-selection, and behavioural rules.
2. **Ground rules.** `get_design_principles` for the heuristics,
   `get_design_principles(topic="theming")` for the paradigm's token profile, and
   `get_css_reference` for the exact token names. `find_components` /
   `suggest_implementation` to pick the right primitives rather than reinventing them.
3. **Generate variants.** Produce a few genuinely different implementations (2–5;
   default 3), each a distinct compositional approach *within* the paradigm — vary
   density, hierarchy emphasis, and the one signature moment. Do not let them
   converge. Use only real semantic tokens (no `bg-status-*`, no `*-foreground`, no
   invented names); if the project defines its own, they're in `## Token Overrides`.
4. **Validate.** Run `validate_design` (or `urbicon validate`) on every variant. Fix
   each error and warning. A variant that can't reach a clean correctness score is
   disqualified. Note each one's slop-floor score — lower is more generic.
5. **Judge.** `get_design_principles(as="rubric")` and score each survivor /40.
   Prefer a panel: judge correctness, hierarchy, paradigm-fidelity, and
   distinctiveness as separate lenses, not one gut number.
6. **Synthesise.** Pick the winner, then graft the best ideas from the runners-up.
   Run `validate_design` once more on the merged result — it must come back clean.
7. **Record.** If the page follows a pattern, add `data-design-pattern="<name>"` to
   its root and refresh Pattern Usages (`urbicon sync-manifest`). Append an ADR
   (`urbicon record-decision`) for any deliberate deviation from a pattern or
   principle.

Output the final code, then a one-line, honest rationale per major choice — name the
trade-offs.
