import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const pinInputVariants = tv({
  slots: {
    root: ['flex flex-col gap-1.5'],
    label: ['block font-medium text-text-secondary text-sm'],
    group: ['flex items-center'],
    cell: [
      'box-border text-center font-medium tabular-nums caret-primary',
      'border text-text-primary bg-surface-base',
      'transition-[color,background-color,border-color,box-shadow] duration-[var(--blocks-duration-fast)] ease-out',
      'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:z-10',
      'hover:border-border-default',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-subtle',
      'read-only:bg-surface-subtle read-only:cursor-default'
    ],
    separator: ['text-text-tertiary select-none'],
    message: ['text-xs']
  },
  variants: {
    // 3-tier semantic radius. Default `modify` (soft) — pin cells read as fields.
    // Inherited from a wrapping <Toolbar tier="commit"> via TierContext.
    tier: {
      modify: { cell: 'rounded-modify' },
      commit: { cell: 'rounded-commit' }
    },
    variant: {
      outlined: { cell: 'border-border-subtle' },
      filled: {
        cell: 'bg-surface-interactive border-transparent hover:bg-surface-hover focus-visible:bg-surface-base'
      },
      ghost: {
        cell: 'bg-transparent hover:bg-surface-subtle focus-visible:bg-surface-base focus-visible:border-border-subtle'
      }
    },
    size: {
      sm: {
        // `pointer-coarse:text-base` floors the font to 16px on touch-primary
        // devices — below 16px iOS Safari auto-zooms the field on focus.
        cell: 'h-9 w-9 text-sm pointer-coarse:text-base',
        group: 'gap-1.5',
        separator: 'mx-0.5 text-sm'
      },
      md: {
        cell: 'h-11 w-11 text-lg',
        group: 'gap-2',
        separator: 'mx-1 text-lg'
      },
      lg: {
        cell: 'h-14 w-14 text-2xl',
        group: 'gap-2.5',
        separator: 'mx-1.5 text-2xl'
      }
    },
    intent: {
      default: {},
      success: {
        cell: 'border-success focus-visible:border-success focus-visible:ring-success/20'
      },
      warning: {
        cell: 'border-warning focus-visible:border-warning focus-visible:ring-warning/20'
      },
      danger: {
        cell: 'border-danger focus-visible:border-danger focus-visible:ring-danger/20'
      }
    },
    disabled: {
      true: {
        cell: 'opacity-50 cursor-not-allowed bg-surface-disabled pointer-events-none',
        label: 'text-text-disabled'
      }
    },
    readonly: {
      true: { cell: 'bg-surface-subtle cursor-default' }
    },
    // Declared BEFORE `error` so the error tone wins the message-color bucket
    // in every call shape — `{ error: true }` alone must read red.
    messageType: {
      error: { message: 'text-danger' },
      helper: { message: 'text-text-tertiary' }
    },
    error: {
      true: {
        cell: 'border-danger focus-visible:border-danger focus-visible:ring-danger/20',
        message: 'text-danger'
      }
    },
    required: {
      true: { label: "after:content-['*'] after:ml-1 after:text-danger" }
    }
  },
  compoundVariants: [
    // Ghost keeps a transparent border at rest — even under an intent. The error
    // state drops this so validation feedback (border-danger) stays visible.
    {
      variant: 'ghost',
      error: false,
      class: { cell: 'border-transparent' }
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
    messageType: 'helper'
  }
});

export type PinInputVariants = VariantProps<typeof pinInputVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type PinInputSlots = SlotNames<typeof pinInputVariants>;
