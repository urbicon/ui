# polish — tighten a page that is already close

**When:** the structure is right but it reads a little generic — uniform spacing, a
default font, low-contrast text, a magic-number size. Small targeted fixes, no
rebuild.
**Gate:** slop-floor (the advisory "looks generic" axis) — and never regress
correctness.

1. **Context.** `urbicon context` for the Product Intent — polish moves the page
   *toward* its voice, not toward your taste.
2. **Find the slop.** Run `urbicon validate` (or the `validate_design` MCP tool) and read the
   **slop-floor** findings specifically (the advisory notes): generic font, uniform
   spacing/weights, identical cards, grey-on-colour, animated dimensions,
   magic-number sizes, small touch targets, emoji-as-icon, and so on.
3. **Fix the smallest things that raise the slop-floor score.** One change at a time;
   keep each reversible. Reach for the design system's real tokens and scale steps —
   `urbicon css-reference` for names — rather than ad-hoc values. Do **not** restructure;
   if a finding needs structural change, that's `redesign`, not `polish`.
4. **Re-validate.** Run the linter again. The correctness score must not drop; the
   slop-floor score should rise. Stop when the remaining findings are deliberate.
5. **Record only if it's a rule.** A one-off tweak needs no ADR. If you set a
   repeatable convention (e.g. "stat tiles use `surface-elevated`, not a border"),
   append an ADR so the next page inherits it.

Output the diff (or the changed snippets) and the slop-floor score before → after.
