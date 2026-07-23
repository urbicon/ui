import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

// CopyButton is-a Button (it forwards variant/intent/size/tier to the public
// Button). These variants only size the embedded icon and carry the tiny
// success micro-interaction — the button chrome itself comes from Button.
export const copyButtonVariants = tv({
  slots: {
    // Merged onto the underlying Button's `class`. Usually empty; present so
    // consumers get a stable `slotClasses.base` hook and `unstyled` symmetry.
    base: [],
    icon: ['shrink-0 transition-transform duration-[var(--blocks-duration-fast)]'],
    label: ['whitespace-nowrap']
  },
  variants: {
    size: {
      '2xs': { icon: 'size-3' },
      xs: { icon: 'size-3' },
      sm: { icon: 'size-3.5' },
      md: { icon: 'size-4' },
      lg: { icon: 'size-5' },
      xl: { icon: 'size-5' }
    },
    state: {
      idle: {},
      copied: { icon: 'scale-110' },
      error: {}
    }
  },
  defaultVariants: {
    size: 'md',
    state: 'idle'
  }
});

export type CopyButtonVariants = VariantProps<typeof copyButtonVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type CopyButtonSlots = SlotNames<typeof copyButtonVariants>;
