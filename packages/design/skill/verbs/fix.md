# fix — repair correctness defects

**When:** the linter's blocking gate is red — raw Tailwind colours, `dark:` overrides,
`focus:` instead of `focus-visible:`, hardcoded z-index, broken dynamic classes, or
hallucinated tokens. Mechanical, behaviour-preserving corrections.
**Gate:** correctness — every error and warning must clear.

1. **Context.** `urbicon context` — so a token you're tempted to "fix" that is
   actually a declared project token (in `## Token Overrides`) is left alone.
   `urbicon validate` reads those from the manifest automatically; the remote
   `validate_design` needs them passed as `extraTokens`.
2. **Enumerate.** Run `urbicon validate` (or the `validate_design` MCP tool) and list
   every **error** and **warning** with its rule id and location. Ignore the
   craft notes here — that's `polish`.
3. **Map each to its correct token.** `urbicon css-reference` for the real names:
   - raw palette (`bg-red-500`) → the semantic intent (`bg-danger`, `text-on-primary`).
   - `dark:` override → delete it; semantic tokens handle dark mode via `light-dark()`.
   - `focus:` → `focus-visible:`.
   - hardcoded z-index → a `z-[var(--z-*)]` token.
   - hallucinated token (`bg-status-danger`, `text-*-foreground`) → the real one, or a
     `## Token Override` if the project genuinely defines it.
4. **Apply and re-validate.** Make the substitutions, change nothing else, and run the
   linter again. Repeat until correctness is clean. Behaviour and layout must be
   identical — this verb does not redesign.
5. **Record only a systemic fix.** A scattered cleanup needs no ADR. If you
   discovered the project legitimately needs a token, add it to `## Token Overrides`
   (so it stops being flagged) and note why.

Output the diff and confirm a clean correctness score.
