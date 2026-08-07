import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const toolbarVariants = tv({
  slots: {
    // Structure radius — a toolbar is a container/surface, not a CTA.
    base: ['flex items-center rounded-contain']
  },
  variants: {
    // Variant contract (see docs/ARCHITECTURE.md §Tier System
    // for the tier-aware toolbar context):
    //   quiet    → softly tinted surface, no border, no shadow — reading-flow default
    //   elevated → elevated surface, medium shadow, no border — reads as "floating toolbar"
    //   outlined → transparent, stronger border — reads as in-page chrome
    //   ghost    → no chrome, just padding around children
    variant: {
      quiet: {
        base: 'bg-surface-quiet'
      },
      elevated: {
        base: 'bg-surface-elevated shadow-[var(--blocks-shadow-md)]'
      },
      outlined: {
        base: 'border border-border-default bg-transparent'
      },
      ghost: {
        base: 'bg-transparent'
      }
    },
    orientation: {
      horizontal: {
        base: 'flex-row items-center overflow-x-auto'
      },
      vertical: {
        base: 'flex-col items-stretch'
      }
    },
    gap: {
      xs: { base: 'gap-0.5' },
      sm: { base: 'gap-1' },
      md: { base: 'gap-1.5' },
      lg: { base: 'gap-3' },
      xl: { base: 'gap-4' }
    },
    padding: {
      xs: { base: 'p-0.5' },
      sm: { base: 'p-1' },
      md: { base: 'p-1.5' },
      lg: { base: 'p-2' },
      xl: { base: 'p-3' }
    }
  },
  compoundVariants: [
    {
      // A horizontal toolbar is a scroll container (`overflow-x-auto` above),
      // and a scroll container clips at its padding box — so its padding is
      // also the room a child's focus ring has to survive in. `ring-2` +
      // `ring-offset-2` reaches 4px, which every step from `sm` up already
      // covers; `xs` is 2px and cut half the ring off. Measured rather than
      // reasoned, and guarded — e2e/tab-focus-ring.spec.ts walks every padding
      // step here and every Tab variant, which is where the shape was found.
      //
      // Only the vertical padding is raised: `xs` exists to be tight, and on
      // this axis the tightness a caller asked for is the horizontal one.
      // Vertical toolbars scroll on no axis and need none of this.
      orientation: 'horizontal',
      padding: 'xs',
      class: { base: 'py-1' }
    }
  ],
  defaultVariants: {
    variant: 'quiet',
    orientation: 'horizontal',
    gap: 'sm',
    padding: 'sm'
  }
});

export type ToolbarVariants = VariantProps<typeof toolbarVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ToolbarSlots = SlotNames<typeof toolbarVariants>;
