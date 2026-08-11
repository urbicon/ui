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
 * Hence the caveat on step 7, and it is narrower than it reads: `class` is
 * inside that final source, not above it, so the only stage it reliably wins
 * against is step 1. Against steps 2–6 it is a peer — `variants.ts` leaves
 * same-bucket pairs within one source to the CSS cascade rather than picking a
 * winner — so a provider `rounded-none` and an instance `class="rounded-full"`
 * both survive and stylesheet order decides. Measured in precedence.test.ts.
 */
export const precedenceChain = [
  'tv() variant styles (library default — the only stage a class prop reliably beats)',
  'BlocksProvider defaults.slotClasses',
  'BlocksProvider defaults.overrides[match]',
  'preset.slotClasses (when preset="…" is set)',
  'preset.overrides[match]',
  'Instance slotClasses prop',
  'Instance class prop (root slot only; same stage as slotClasses)'
];
