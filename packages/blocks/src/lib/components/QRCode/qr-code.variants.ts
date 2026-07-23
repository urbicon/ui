import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const qrCodeVariants = tv({
  slots: {
    root: ['inline-flex items-center justify-center'],
    svg: ['block h-auto max-w-full'],
    fallback: [
      'inline-flex items-center justify-center text-center text-xs',
      'border border-dashed border-border-default text-text-tertiary bg-surface-subtle rounded-modify p-2'
    ]
  },
  variants: {
    // Optional framing so the code can sit on a guaranteed-light card (the
    // scan-safe default look) without the consumer hand-building one.
    // `scheme-light` pins `color-scheme: light` on the card, so every
    // `light-dark()` token inside resolves to its light value even in dark
    // mode — without it the card ground flips dark and the `currentColor`
    // modules invert (light-on-dark QR codes fail many scanners). The explicit
    // `text-text-primary` re-derives the module colour under that scheme
    // (inherited `color` is computed on the dark ancestor and would leak in).
    frame: {
      none: {},
      card: {
        root: 'scheme-light bg-surface-base text-text-primary border border-border-subtle rounded-lg p-3 shadow-[var(--blocks-shadow-sm)]'
      }
    }
  },
  defaultVariants: {
    frame: 'none'
  }
});

export type QRCodeVariants = VariantProps<typeof qrCodeVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type QRCodeSlots = SlotNames<typeof qrCodeVariants>;
