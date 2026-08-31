/**
 * The override-precedence chain (weakest → strongest), rendered on both the
 * Customization hub and the BlocksProvider page. One array so the two
 * renderings cannot disagree again (they did: the hub listed seven steps, the
 * provider page six, with presets folded into one entry).
 *
 * Steps 2–6 are `resolveSlotClasses` in
 * packages/blocks/src/lib/provider/blocks-context.ts, which folds them with
 * `resolveClassChain` so each source strips the earlier ones' conflicting
 * Tailwind buckets. That result and the instance `class` prop reach the
 * component's `tv()` slot fn as an ARRAY (Button.svelte:
 * `styles.base({ class: [slotClasses?.base, className] })`), and the engine
 * reads each top-level array element as its own source — so step 7 strips
 * step 6 the same way step 6 strips step 5, and the whole chain strips the
 * library's own classes, step 1. Measured in precedence.test.ts.
 */
/**
 * What an instance `class` prop outranks, in one sentence, rendered wherever a
 * page states it — the hub's decision table and the BlocksProvider page.
 *
 * Shared rather than retyped because it has now been wrong twice in the same
 * direction, and the second time it was wrong in a table 110 lines above the
 * paragraph that corrected it. One string cannot disagree with itself.
 * Measured in precedence.test.ts.
 */
export const classCaveat =
  'Beats every other rung in a shared Tailwind bucket — the library default, a ' +
  'provider default, a preset and slotClasses alike. It reaches the root slot ' +
  'only, so an inner element still needs slotClasses.';

export const precedenceChain = [
  'tv() variant styles (library default)',
  'BlocksProvider defaults.slotClasses',
  'BlocksProvider defaults.overrides[match]',
  'preset.slotClasses (when preset="…" is set)',
  'preset.overrides[match]',
  'Instance slotClasses prop',
  'Instance class prop (root slot only — the strongest rung)'
];
