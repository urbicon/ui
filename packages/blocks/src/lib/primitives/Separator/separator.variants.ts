import { tv, type VariantProps } from '$lib/utils/variants';

// Separator is a purely visual primitive. Spacing belongs to the surrounding
// layout (flex/grid gap, `space-y-*`, `space-x-*`) — not to the separator
// itself. Pre-v1.0 we dropped the built-in margins that forced consumers to
// override with `!my-0` (SEP-1). The `size` axis is retained but now controls
// the *thickness* of the rule, which is what consumers actually need to vary.
export const separatorVariants = tv({
  base: ['shrink-0 bg-border-subtle'],
  variants: {
    orientation: {
      horizontal: 'w-full',
      vertical: 'h-full'
    },
    size: {
      sm: '',
      md: '',
      lg: ''
    }
  },
  compoundVariants: [
    { orientation: 'horizontal', size: 'sm', class: 'h-px' },
    { orientation: 'horizontal', size: 'md', class: 'h-px' },
    { orientation: 'horizontal', size: 'lg', class: 'h-0.5' },
    { orientation: 'vertical', size: 'sm', class: 'w-px' },
    { orientation: 'vertical', size: 'md', class: 'w-px' },
    { orientation: 'vertical', size: 'lg', class: 'w-0.5' }
  ],
  defaultVariants: {
    orientation: 'horizontal',
    size: 'md'
  }
});

export type SeparatorVariants = VariantProps<typeof separatorVariants>;
