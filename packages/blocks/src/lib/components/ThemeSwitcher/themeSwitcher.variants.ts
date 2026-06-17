import { tv, type VariantProps } from '$lib/utils/variants';

export const themeSwitcherVariants = tv({
  slots: {
    // tier: commit — icon-button action surface (mirrors Button default).
    button: [
      'inline-flex items-center justify-center rounded-commit',
      'text-text-tertiary transition-colors',
      'hover:bg-surface-hover hover:text-text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2'
    ],
    icon: 'shrink-0'
  },
  variants: {
    variant: {
      ghost: { button: 'bg-transparent' },
      outlined: {
        button: 'border border-border-subtle bg-transparent hover:border-border-default'
      },
      filled: { button: 'bg-surface-subtle hover:bg-surface-hover' }
    },
    size: {
      sm: { button: 'h-7 w-7', icon: 'h-3.5 w-3.5' },
      md: { button: 'h-8 w-8', icon: 'h-4 w-4' },
      lg: { button: 'h-10 w-10', icon: 'h-5 w-5' }
    },
    disabled: {
      true: { button: 'pointer-events-none opacity-50' }
    }
  },
  defaultVariants: {
    variant: 'ghost',
    size: 'md',
    disabled: false
  }
});

export type ThemeSwitcherVariants = VariantProps<typeof themeSwitcherVariants>;
