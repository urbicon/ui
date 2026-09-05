/**
 * The override ladder: the styling hooks a consumer has, in the order to reach for
 * them, and what wins when two of them set the same Tailwind bucket. The contract
 * is docs/COMPONENT-API-CONVENTIONS.md — § `slotClasses` for the cascade line,
 * § The override ladder for the rungs. This is the copy that reaches an agent, and
 * it is authored once so that the primer, the theming section of the CSS reference,
 * the llms-full template and the generated `class` / `slotClasses` prop rows cannot
 * state different orders.
 */

/**
 * Which source wins when two set the same Tailwind bucket: the later one in this
 * chain. `[match]` is load-bearing — an `overrides` rule whose condition does not
 * match the instance's props contributes nothing.
 */
export const OVERRIDE_CASCADE =
  'Cascade (conflict-resolved per Tailwind bucket, later wins): `defaults.slotClasses → defaults.overrides[match] → preset.slotClasses → preset.overrides[match] → instance slotClasses → instance class`.';

/**
 * The chain's last two rungs, as one sentence for a prop-table cell. `class` lands
 * on exactly one slot (§ `class` hits exactly one slot), so it only ever outranks
 * that slot's entry.
 */
export const CLASS_OVER_SLOT_CLASSES =
  'In the same Tailwind bucket `class` wins over the `slotClasses` entry for the element it lands on.';

/**
 * The chain's first four rungs, as one sentence for a prop-table cell — true only of
 * a component that resolves the provider cascade at all, which is why it is a
 * separate sentence from {@link CLASS_OVER_SLOT_CLASSES}.
 */
export const PROVIDER_BELOW_INSTANCE = 'Presets and provider defaults sit below both.';

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
