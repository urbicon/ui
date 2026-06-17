import { tv, type VariantProps } from '$lib/utils/variants';

export const popoverVariants = tv({
  // tier: contain — floating panel surface.
  base: [
    'bg-surface-elevated border border-border-hairline rounded-contain',
    'shadow-[var(--blocks-shadow-md)] backdrop-blur-sm',
    'overflow-y-auto max-h-[calc(100dvh-4rem)]'
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
