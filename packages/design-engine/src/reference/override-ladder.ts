/**
 * The override ladder: the styling hooks a consumer has, in the order to reach for
 * them, and what wins when two of them set the same Tailwind bucket. The contract
 * is docs/COMPONENT-API-CONVENTIONS.md § The override ladder; this is the copy that
 * reaches an agent, and it is authored once so that the primer, the theming
 * section of the CSS reference and the generated `class` / `slotClasses` prop rows
 * cannot state three different orders.
 */

/** Which source wins when two set the same Tailwind bucket: the later one in this chain. */
export const OVERRIDE_CASCADE =
  'Cascade (conflict-resolved per Tailwind bucket, later wins): `defaults.slotClasses → defaults.overrides → preset.slotClasses → preset.overrides → instance slotClasses → instance class`.';

/** The cascade's last two rungs, as one clause that fits a prop-table cell. */
export const CLASS_OVER_SLOT_CLASSES =
  'In the same Tailwind bucket `class` wins over `slotClasses`; presets and provider defaults sit below both.';

/** The five rungs, most local first, closing on the cascade — one screen, for the primer. */
export const OVERRIDE_LADDER = `# Override Ladder

Reach for the lowest rung that solves the problem — lower rungs preserve more of the system's behavior (dark mode, hover/active cascade, focus rings):

1. **\`class\`** — restyle one element (the one its \`class\` prop names — usually the root slot) on one instance.
2. **\`slotClasses.<slot>\`** — restyle an inner element on one instance.
3. **\`preset\` / \`BlocksProvider\` defaults** — app-wide look for a component type.
4. **\`overrides\`** — style only one variant / intent / state (prop-conditional — what unconditional \`slotClasses\` cannot express).
5. **\`unstyled\` + \`slotClasses\`** — strip every default and rebuild the look.

${OVERRIDE_CASCADE}
`;
