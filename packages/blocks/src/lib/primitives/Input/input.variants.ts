import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const inputVariants = tv({
  slots: {
    wrapper: ['flex flex-col w-full gap-1.5'],
    container: ['relative flex items-center'],
    base: [
      'w-full box-border transition-[color,background-color,border-color,box-shadow] duration-[var(--blocks-duration-fast)] ease-out',
      // Radius driven by `tier` axis below.
      'focus-visible:outline-none',
      'border text-text-primary bg-surface-base placeholder:text-text-quaternary',
      'hover:border-border-default focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-subtle',
      'read-only:bg-surface-subtle read-only:cursor-default'
    ],
    label: ['block font-medium text-text-secondary text-sm'],
    message: ['text-xs mt-1.5'],
    iconContainer: [
      'absolute top-0 bottom-0 flex items-center justify-center z-10 pointer-events-none'
    ],
    iconButton: [
      'pointer-events-auto inline-flex items-center justify-center rounded-modify cursor-pointer',
      'text-text-tertiary hover:text-text-primary hover:bg-surface-hover',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent'
    ],
    iconDecoration: [
      'pointer-events-none inline-flex items-center justify-center text-text-tertiary'
    ]
  },
  variants: {
    // 3-tier semantic radius. Default `modify` (soft) — inputs read as
    // tap areas / fields, not CTAs. Opt-in `commit` (pill) for search
    // bars, marketing newsletter inputs, or OS-style command bars.
    // Usually inherited from a wrapping <Toolbar tier="commit"> via
    // TierContext when appropriate.
    tier: {
      modify: { base: 'rounded-modify' },
      commit: { base: 'rounded-commit' }
    },
    variant: {
      outlined: {
        base: 'border-border-subtle'
      },
      filled: {
        base: 'bg-surface-interactive border-transparent hover:bg-surface-hover focus-visible:bg-surface-base'
      },
      ghost: {
        base: 'bg-transparent hover:bg-surface-subtle focus-visible:bg-surface-base focus-visible:border-border-subtle'
      },
      underline: {
        base: 'bg-transparent border-0 border-b-2 border-border-subtle rounded-none focus-visible:ring-0'
      }
    },
    size: {
      xs: {
        // `pointer-coarse:text-base` floors the font to 16px on touch-primary
        // devices (iPhone/iPad) — below 16px iOS Safari auto-zooms the field on
        // focus and never restores the zoom. Desktop keeps the designed 12px.
        base: 'h-7 px-2 text-xs pointer-coarse:text-base',
        iconContainer: 'w-7',
        iconButton: 'p-0.5 [&_svg]:w-3 [&_svg]:h-3',
        iconDecoration: '[&_svg]:w-3 [&_svg]:h-3'
      },
      sm: {
        // See `xs` — floor to 16px on touch to avoid iOS Safari focus-zoom.
        base: 'h-8 px-3 text-sm pointer-coarse:text-base',
        iconContainer: 'w-8',
        iconButton: 'p-0.5 [&_svg]:w-3.5 [&_svg]:h-3.5',
        iconDecoration: '[&_svg]:w-3.5 [&_svg]:h-3.5'
      },
      md: {
        base: 'h-10 px-4 text-base',
        iconContainer: 'w-10',
        iconButton: 'p-1 [&_svg]:w-4 [&_svg]:h-4',
        iconDecoration: '[&_svg]:w-4 [&_svg]:h-4'
      },
      lg: {
        base: 'h-12 px-6 text-lg',
        iconContainer: 'w-12',
        iconButton: 'p-1 [&_svg]:w-5 [&_svg]:h-5',
        iconDecoration: '[&_svg]:w-5 [&_svg]:h-5'
      },
      xl: {
        base: 'h-14 px-8 text-xl',
        iconContainer: 'w-14',
        iconButton: 'p-1.5 [&_svg]:w-6 [&_svg]:h-6',
        iconDecoration: '[&_svg]:w-6 [&_svg]:h-6'
      }
    },
    intent: {
      default: {},
      success: {
        base: 'border-success focus-visible:border-success focus-visible:ring-success/20',
        message: 'text-success'
      },
      warning: {
        base: 'border-warning focus-visible:border-warning focus-visible:ring-warning/20',
        message: 'text-warning-emphasis'
      },
      danger: {
        base: 'border-danger focus-visible:border-danger focus-visible:ring-danger/20',
        message: 'text-danger'
      }
    },
    disabled: {
      true: {
        base: 'opacity-50 cursor-not-allowed bg-surface-disabled pointer-events-none',
        label: 'text-text-disabled'
      }
    },
    readonly: {
      true: {
        base: 'bg-surface-subtle cursor-default'
      }
    },
    error: {
      true: {
        base: 'border-danger focus-visible:border-danger focus-visible:ring-danger/20',
        message: 'text-danger'
      }
    },
    required: {
      true: {
        label: "after:content-['*'] after:ml-1 after:text-danger"
      }
    },
    hasLeftIcon: { true: {} },
    hasRightIcon: { true: {} },
    messageType: {
      error: { message: 'text-danger' },
      helper: { message: 'text-text-tertiary' }
    },
    iconPosition: {
      left: { iconContainer: 'left-0' },
      right: { iconContainer: 'right-0' }
    }
  },
  compoundVariants: [
    // Ghost keeps a transparent border in its resting state — even when an
    // intent would otherwise colour it. The error state intentionally drops
    // this override so validation feedback (`border-danger`) stays visible.
    {
      variant: 'ghost',
      error: false,
      class: { base: 'border-transparent' }
    },
    { hasLeftIcon: true, size: 'xs', class: { base: 'pl-7' } },
    { hasLeftIcon: true, size: 'sm', class: { base: 'pl-8' } },
    { hasLeftIcon: true, size: 'md', class: { base: 'pl-10' } },
    { hasLeftIcon: true, size: 'lg', class: { base: 'pl-12' } },
    { hasLeftIcon: true, size: 'xl', class: { base: 'pl-14' } },
    { hasRightIcon: true, size: 'xs', class: { base: 'pr-7' } },
    { hasRightIcon: true, size: 'sm', class: { base: 'pr-8' } },
    { hasRightIcon: true, size: 'md', class: { base: 'pr-10' } },
    { hasRightIcon: true, size: 'lg', class: { base: 'pr-12' } },
    { hasRightIcon: true, size: 'xl', class: { base: 'pr-14' } }
  ],
  defaultVariants: {
    tier: 'modify',
    variant: 'outlined',
    size: 'md',
    intent: 'default',
    disabled: false,
    readonly: false,
    error: false,
    required: false,
    hasLeftIcon: false,
    hasRightIcon: false,
    messageType: 'helper',
    iconPosition: 'left'
  }
});

export type InputVariants = VariantProps<typeof inputVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type InputSlots = SlotNames<typeof inputVariants>;
