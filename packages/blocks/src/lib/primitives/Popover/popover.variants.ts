import { tv, type VariantProps } from '$lib/utils/variants';

export const popoverVariants = tv({
  // tier: contain — floating panel surface.
  base: [
    'bg-surface-elevated border border-border-hairline rounded-contain',
    'shadow-[var(--blocks-shadow-md)] backdrop-blur-sm',
    // `calc(100dvh-4rem)` is the static design cap; Floating UI's `size`
    // middleware (via useFloatingPanel) narrows it to the room actually left
    // between the anchor and the visual viewport edge through
    // `--blocks-overlay-available-height`, so the panel shrinks above the iOS
    // keyboard and recovers when it closes. The var falls back to 100dvh when
    // unset (SSR / no JS), leaving the design cap in charge.
    'overflow-y-auto max-h-[min(calc(100dvh-4rem),var(--blocks-overlay-available-height,100dvh))]'
  ],
  variants: {
    size: {
      sm: 'p-1 min-w-32 max-w-64 text-xs',
      md: 'p-2 min-w-48 max-w-96 text-sm',
      lg: 'p-3 min-w-64 max-w-screen-sm text-base'
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

export type PopoverVariants = VariantProps<typeof popoverVariants>;
