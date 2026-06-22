import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const buttonGroupVariants = tv({
  slots: {
    base: ['inline-flex']
  },
  variants: {
    orientation: {
      horizontal: { base: 'flex-row' },
      vertical: { base: 'flex-col w-fit' }
    },
    connected: {
      true: { base: '' },
      false: { base: 'gap-1' }
    },
    // 3-tier semantic radius (matches Button.tier). Default `commit` (pill);
    // opt-in `modify` (soft) for tight contexts. Propagated to all child
    // Buttons via TierContext (set in ButtonGroup.svelte).
    tier: {
      commit: {},
      modify: {}
    },
    disabled: {
      true: { base: 'opacity-50 pointer-events-none' }
    }
  },
  compoundVariants: [
    // Connected groups read as one shape — first and last children keep
    // the outer radius on the outer corners; the middle ones (via Button's
    // `buttonGroupConnected: true`) drop to `rounded-none` so neighbours
    // touch cleanly. Cap radius follows the group's tier.
    {
      connected: true,
      orientation: 'horizontal',
      tier: 'commit',
      class: {
        base: [
          '[&>*:not(:first-child)]:-ml-px',
          '[&>:first-child]:rounded-l-commit',
          '[&>:last-child]:rounded-r-commit'
        ]
      }
    },
    {
      connected: true,
      orientation: 'horizontal',
      tier: 'modify',
      class: {
        base: [
          '[&>*:not(:first-child)]:-ml-px',
          '[&>:first-child]:rounded-l-modify',
          '[&>:last-child]:rounded-r-modify'
        ]
      }
    },
    {
      connected: true,
      orientation: 'vertical',
      tier: 'commit',
      class: {
        base: [
          '[&>*:not(:first-child)]:-mt-px',
          '[&>:first-child]:rounded-t-commit',
          '[&>:last-child]:rounded-b-commit'
        ]
      }
    },
    {
      connected: true,
      orientation: 'vertical',
      tier: 'modify',
      class: {
        base: [
          '[&>*:not(:first-child)]:-mt-px',
          '[&>:first-child]:rounded-t-modify',
          '[&>:last-child]:rounded-b-modify'
        ]
      }
    },
    {
      orientation: 'vertical',
      class: { base: 'sm:w-fit w-full' }
    }
  ],
  defaultVariants: {
    orientation: 'horizontal',
    connected: true,
    tier: 'commit',
    disabled: false
  }
});

export type ButtonGroupVariants = VariantProps<typeof buttonGroupVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ButtonGroupSlots = SlotNames<typeof buttonGroupVariants>;
