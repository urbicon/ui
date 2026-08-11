/**
 * The override-precedence chain (weakest → strongest), rendered on both the
 * Customization hub and the BlocksProvider page. One array so the two
 * renderings cannot disagree again (they did: the hub listed seven steps, the
 * provider page six, with presets folded into one entry).
 *
 * The order itself comes from `resolveSlotClasses` in
 * packages/blocks/src/lib/provider/blocks-context.ts (guarded by its tests)
 * plus the component-level `class` merge.
 */
export const precedenceChain = [
  'tv() variant styles (library default)',
  'BlocksProvider defaults.slotClasses',
  'BlocksProvider defaults.overrides[match]',
  'preset.slotClasses (when preset="…" is set)',
  'preset.overrides[match]',
  'Instance slotClasses prop',
  'Instance class prop (root slot only; appended without bucket resolution)'
];
