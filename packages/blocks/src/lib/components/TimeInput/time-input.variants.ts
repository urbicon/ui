import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const timeInputVariants = tv({
  slots: {
    wrapper: ['flex flex-col gap-1.5 w-full'],
    label: ['block font-medium text-text-secondary text-sm'],
    // The bordered container reads as a single field; the segment inputs inside
    // are borderless. The focus ring lives here via focus-within so tabbing
    // between segments keeps the whole field lit.
    field: [
      'inline-flex items-center box-border w-fit',
      'border text-text-primary bg-surface-base',
      'transition-[color,background-color,border-color,box-shadow] duration-[var(--blocks-duration-fast)] ease-out',
      'hover:border-border-default',
      'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
    ],
    icon: ['pointer-events-none inline-flex items-center justify-center text-text-tertiary'],
    segment: [
      'bg-transparent text-center tabular-nums text-text-primary caret-transparent',
      'border-0 outline-none p-0 rounded-sm',
      'focus-visible:bg-primary-subtle',
      'placeholder:text-text-quaternary',
      'disabled:cursor-not-allowed'
    ],
    separator: ['text-text-tertiary select-none'],
    meridiem: [
      'ml-1 font-medium text-text-secondary rounded-sm cursor-pointer select-none',
      'hover:bg-surface-hover focus-visible:outline-none focus-visible:bg-primary-subtle',
      // The segment is a span-hosted spinbutton — no native :disabled state.
      'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'
    ],
    message: ['text-xs']
  },
  variants: {
    // 3-tier semantic radius, default `modify` (soft field). Inherited from a
    // wrapping <Toolbar tier="commit"> via TierContext.
    tier: {
      modify: { field: 'rounded-modify' },
      commit: { field: 'rounded-commit' }
    },
    variant: {
      outlined: { field: 'border-border-subtle' },
      filled: {
        field:
          'bg-surface-interactive border-transparent hover:bg-surface-hover focus-within:bg-surface-base'
      },
      ghost: {
        field:
          'bg-transparent hover:bg-surface-subtle focus-within:bg-surface-base focus-within:border-border-subtle'
      }
    },
    size: {
      sm: {
        // `pointer-coarse:text-base` floors to 16px on touch to avoid iOS zoom.
        field: 'h-8 px-2 gap-0.5 text-sm pointer-coarse:text-base',
        segment: 'w-[2ch] text-sm pointer-coarse:text-base',
        icon: 'mr-1.5 [&_svg]:w-3.5 [&_svg]:h-3.5',
        meridiem: 'px-1 text-sm pointer-coarse:text-base'
      },
      md: {
        field: 'h-10 px-3 gap-0.5 text-base',
        segment: 'w-[2ch] text-base',
        icon: 'mr-2 [&_svg]:w-4 [&_svg]:h-4',
        meridiem: 'px-1 text-base'
      },
      lg: {
        field: 'h-12 px-4 gap-1 text-lg',
        segment: 'w-[2ch] text-lg',
        icon: 'mr-2.5 [&_svg]:w-5 [&_svg]:h-5',
        meridiem: 'px-1.5 text-lg'
      }
    },
    intent: {
      default: {},
      success: { field: 'border-success focus-within:border-success focus-within:ring-success/20' },
      warning: { field: 'border-warning focus-within:border-warning focus-within:ring-warning/20' },
      danger: { field: 'border-danger focus-within:border-danger focus-within:ring-danger/20' }
    },
    disabled: {
      true: {
        field: 'opacity-50 cursor-not-allowed bg-surface-disabled pointer-events-none',
        label: 'text-text-disabled'
      }
    },
    readonly: {
      true: { field: 'bg-surface-subtle' }
    },
    messageType: {
      error: { message: 'text-danger' },
      helper: { message: 'text-text-tertiary' }
    },
    error: {
      true: {
        field: 'border-danger focus-within:border-danger focus-within:ring-danger/20',
        message: 'text-danger'
      }
    },
    required: {
      true: { label: "after:content-['*'] after:ml-1 after:text-danger" }
    },
    fullWidth: {
      true: { field: 'w-full justify-start' }
    }
  },
  compoundVariants: [
    {
      variant: 'ghost',
      error: false,
      class: { field: 'border-transparent' }
    }
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
    fullWidth: false,
    messageType: 'helper'
  }
});

export type TimeInputVariants = VariantProps<typeof timeInputVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type TimeInputSlots = SlotNames<typeof timeInputVariants>;
