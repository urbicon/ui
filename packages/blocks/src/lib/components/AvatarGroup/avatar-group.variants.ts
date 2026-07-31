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
    /**
     * The overlap, and the counter-shift that keeps initials readable under it.
     *
     * Each avatar centres its initials and the next one covers its right edge,
     * so with two-letter initials the second letter disappears: "Io Nakamura"
     * read "II", "Ada Lovelace" read "AI". With image avatars that same overlap
     * is the intended stack, which is why the shift targets
     * `[data-avatar-fallback]` — the initials span specifically — and not the
     * frame.
     *
     * The offset is half the overlap, so the initials end up centred in the
     * *visible* part rather than in the whole circle: -space-x-4 hides 16px and
     * shifts 8, -3 hides 12 and shifts 6, -2 hides 8 and shifts 4.
     *
     * `:not(:last-child)` means the rightmost avatar keeps its initials centred,
     * since nothing covers it. When an overflow chip is present the last real
     * avatar IS covered — and it is no longer `:last-child`, so it shifts. That
     * falls out of the selector rather than needing a second rule.
     *
     * `rtl:` flips the direction: in a right-to-left row the covered half is the
     * left one.
     */
    spacing: {
      tight: {
        base: [
          '-space-x-4',
          '[&>*:not(:last-child)_[data-avatar-fallback]]:-translate-x-[8px]',
          'rtl:[&>*:not(:last-child)_[data-avatar-fallback]]:translate-x-[8px]'
        ]
      },
      normal: {
        base: [
          '-space-x-3',
          '[&>*:not(:last-child)_[data-avatar-fallback]]:-translate-x-[6px]',
          'rtl:[&>*:not(:last-child)_[data-avatar-fallback]]:translate-x-[6px]'
        ]
      },
      loose: {
        base: [
          '-space-x-2',
          '[&>*:not(:last-child)_[data-avatar-fallback]]:-translate-x-[4px]',
          'rtl:[&>*:not(:last-child)_[data-avatar-fallback]]:translate-x-[4px]'
        ]
      }
    }
  },
  defaultVariants: {
    spacing: 'normal'
  }
});

export type AvatarGroupVariants = VariantProps<typeof avatarGroupVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type AvatarGroupSlots = SlotNames<typeof avatarGroupVariants>;
