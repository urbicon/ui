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
     * The offset is half the covered width, so the initials end up centred in
     * the *visible* part rather than in the whole circle. The covered width is
     * the negative margin **plus the ring**: AvatarGroup renders every avatar
     * with `ring`, which is `ring-2 ring-offset-2` — a 4px opaque annulus
     * outside the border box, painted over by the later sibling. So -space-x-4
     * covers 16+4 and shifts 10, -3 covers 12+4 and shifts 8, -2 covers 8+4 and
     * shifts 6.
     *
     * Scale steps, not arbitrary px: the overlap is `calc(var(--spacing) * -n)`,
     * so half of it is a scale value too (2.5 / 2 / 1.5). An arbitrary `[8px]`
     * would stop tracking a `--spacing` override or the user's root font size —
     * and arbitrary values fall outside what `variants:lint` can check.
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
          '[&>*:not(:last-child)_[data-avatar-fallback]]:-translate-x-2.5',
          'rtl:[&>*:not(:last-child)_[data-avatar-fallback]]:translate-x-2.5'
        ]
      },
      normal: {
        base: [
          '-space-x-3',
          '[&>*:not(:last-child)_[data-avatar-fallback]]:-translate-x-2',
          'rtl:[&>*:not(:last-child)_[data-avatar-fallback]]:translate-x-2'
        ]
      },
      loose: {
        base: [
          '-space-x-2',
          '[&>*:not(:last-child)_[data-avatar-fallback]]:-translate-x-1.5',
          'rtl:[&>*:not(:last-child)_[data-avatar-fallback]]:translate-x-1.5'
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
