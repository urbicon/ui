/**
 * The override-precedence chain (weakest → strongest), rendered on both the
 * Customization hub and the BlocksProvider page. One array so the two
 * renderings cannot disagree again (they did: the hub listed seven steps, the
 * provider page six, with presets folded into one entry).
 *
 * Steps 2–6 are `resolveSlotClasses` in
 * packages/blocks/src/lib/provider/blocks-context.ts, which folds them with
 * `resolveClassChain` so each source strips the earlier ones' conflicting
 * Tailwind buckets. The result plus the instance `class` prop are then handed
 * to the component's `tv()` slot fn as ONE final source (Button.svelte:
 * `styles.base({ class: [slotClasses?.base, className] })`), which strips the
 * library's own conflicting classes — step 1.
 *
 * Hence the caveat on step 7: `class` outranks everything the library and the
 * provider set, but it shares its stage with instance `slotClasses`, and
 * within one source `variants.ts` leaves same-bucket pairs to the CSS cascade
 * rather than picking a winner.
 */
export const precedenceChain = [
  'tv() variant styles (library default)',
  'BlocksProvider defaults.slotClasses',
  'BlocksProvider defaults.overrides[match]',
  'preset.slotClasses (when preset="…" is set)',
  'preset.overrides[match]',
  'Instance slotClasses prop',
  'Instance class prop (root slot only; same stage as slotClasses)'
];
