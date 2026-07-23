import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

// AvatarGroup stacks avatars with a controlled overlap and an optional "+N"
// overflow chip. It composes the public Avatar for each entry (and the chip),
// so per-avatar sizing/shape/ring come from Avatar — these variants own only the
// row layout (overlap amount) and a light emphasis on the overflow chip.
export const avatarGroupVariants = tv({
  slots: {
    base: ['inline-flex items-center'],
    overflow: ['font-medium']
  },
  variants: {
    spacing: {
      tight: { base: '-space-x-4' },
      normal: { base: '-space-x-3' },
      loose: { base: '-space-x-2' }
    }
  },
  defaultVariants: {
    spacing: 'normal'
  }
});

export type AvatarGroupVariants = VariantProps<typeof avatarGroupVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type AvatarGroupSlots = SlotNames<typeof avatarGroupVariants>;
