import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

/**
 * The Navigation family's anchor voice. One slot, because a Link is one box —
 * a word with an address, never a surface.
 *
 * Tailwind's preflight strips every default from `<a>`, so an unstyled anchor
 * carries no affordance at all; this config is what the library puts back.
 *
 * Axis order matters: `active` and `disabled` are declared after `variant` so
 * their colour and opacity win the fold over the per-voice defaults.
 */
export const linkVariants = tv({
  slots: {
    base: [
      'transition-colors duration-[var(--blocks-duration-fast)]',
      // `rounded-modify` is the shape of the focus ring, not of a surface — a
      // Link paints no box. The ring reads the `--blocks-focus-ring-*` tokens
      // rather than naming a colour, so a consumer retunes it centrally and the
      // `prefers-contrast: more` step in style/interaction.css reaches it too.
      'rounded-modify',
      'focus-visible:outline-solid focus-visible:outline-[length:var(--blocks-focus-ring-width)] focus-visible:outline-offset-[length:var(--blocks-focus-ring-offset)] focus-visible:outline-(color:--blocks-focus-ring-color)'
    ]
  },
  variants: {
    variant: {
      /** A link inside running prose — document ink, marked by its underline. */
      inline: {
        // The underline is the affordance, so the decoration carries the state
        // and the text colour does not: colour alone is not a distinguishable
        // link cue (WCAG 1.4.1), and a prose link that changes hue on hover
        // makes the paragraph flicker.
        base: 'text-text-primary underline underline-offset-4 decoration-text-quaternary'
      },
      /** A handle in a nav strip, a filter row, a table header — no underline. */
      standalone: {
        base: 'no-underline text-text-tertiary'
      }
    },
    active: {
      true: { base: 'text-text-primary font-medium' }
    },
    disabled: {
      // Plain, not `aria-disabled:`-prefixed as `paginationLinkVariants` spells
      // it: the axis is what the provider `overrides` ladder keys on, and the
      // class set has to hold for `linkVariants()` called directly on a
      // consumer's own anchor, which carries no attribute of ours.
      true: { base: 'opacity-50 cursor-not-allowed pointer-events-none' }
    }
  },
  compoundVariants: [
    // Hover belongs to a link you are not already on. Keeping it off the active
    // link is what lets a consumer repaint that link through `class` alone: an
    // unprefixed `text-*` wins the colour bucket but never a `hover:` one, so a
    // hover class here would outlive the override and repaint on pointer-over.
    { variant: 'inline', active: false, class: { base: 'hover:decoration-text-primary' } },
    // Tertiary → PRIMARY, not secondary: `--color-text-secondary` and
    // `--color-text-tertiary` share one dark-mode stop (`neutral-300` in
    // style/semantic.css), so a tertiary→secondary hover paints nothing at all
    // for a dark-mode reader — link.variants.test.ts asks the stylesheet. It
    // also makes hover a preview of `active`, which is what a nav strip wants.
    { variant: 'standalone', active: false, class: { base: 'hover:text-text-primary' } }
  ],
  defaultVariants: {
    variant: 'inline',
    active: false,
    disabled: false
  }
});

export type LinkVariants = VariantProps<typeof linkVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type LinkSlots = SlotNames<typeof linkVariants>;
