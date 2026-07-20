import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const radioGroupVariants = tv({
  slots: {
    root: ['flex flex-col gap-1.5'],
    group: ['flex gap-3'],
    label: ['block font-medium text-text-secondary text-sm'],
    message: ['text-xs text-text-tertiary']
  },
  variants: {
    orientation: {
      horizontal: { group: 'flex-row flex-wrap' },
      vertical: { group: 'flex-col' }
    },
    required: {
      true: {
        label: "after:content-['*'] after:ml-1 after:text-danger"
      }
    },
    error: {
      true: {
        message: 'text-danger'
      }
    },
    disabled: {
      true: {}
    }
  },
  defaultVariants: {
    orientation: 'vertical',
    required: false,
    error: false,
    disabled: false
  }
});

export const radioItemVariants = tv({
  slots: {
    item: ['group inline-flex items-start gap-2 select-none cursor-pointer'],
    // Geometry tier moves to the `tier` variant below. Default `commit` —
    // a radio indicator declares status, conventionally circular.
    indicator: [
      'relative flex items-center justify-center shrink-0 border',
      'transition-[color,background-color,border-color,box-shadow] duration-[var(--blocks-duration-fast)] ease-out',
      'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50',
      'peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-base'
    ],
    dot: [
      'opacity-0 scale-0',
      'transition-[opacity,transform] duration-[var(--blocks-duration-fast)] ease-out'
    ],
    label: ['text-text-primary select-none leading-snug'],
    description: ['text-text-tertiary leading-snug']
  },
  variants: {
    // 3-tier semantic radius. Default `commit` (circle) — the canonical
    // radio shape (Material, HIG, Carbon). `modify` produces a soft-
    // rectangle indicator + dot for compact inline-toolbar contexts where
    // the circle would feel oversized — usually inherited from the
    // wrapping RadioGroup's `tier`-prop / TierContext.
    tier: {
      commit: { indicator: 'rounded-commit', dot: 'rounded-commit' },
      modify: { indicator: 'rounded-modify', dot: 'rounded-modify' }
    },
    size: {
      xs: {
        item: 'gap-1.5',
        indicator: 'w-3.5 h-3.5 mt-px',
        dot: 'w-1.5 h-1.5',
        label: 'text-xs',
        description: 'text-3xs'
      },
      sm: {
        item: 'gap-2',
        indicator: 'w-4 h-4 mt-0.5',
        dot: 'w-2 h-2',
        label: 'text-sm',
        description: 'text-xs'
      },
      md: {
        item: 'gap-2.5',
        indicator: 'w-5 h-5 mt-0.5',
        dot: 'w-2.5 h-2.5',
        label: 'text-base',
        description: 'text-sm'
      },
      lg: {
        item: 'gap-3',
        indicator: 'w-6 h-6 mt-0.5',
        dot: 'w-3 h-3',
        label: 'text-lg',
        description: 'text-base'
      }
    },
    intent: {
      primary: {},
      secondary: {},
      success: {},
      warning: {},
      danger: {},
      neutral: {}
    },
    variant: {
      outlined: {},
      filled: {},
      ghost: {}
    },
    checked: {
      true: {
        dot: 'opacity-100 scale-100'
      }
    },
    disabled: {
      true: {
        item: 'opacity-50 cursor-not-allowed pointer-events-none'
      }
    },
    error: {
      true: {}
    }
  },
  compoundVariants: [
    // Unchecked appearance per variant
    {
      checked: false,
      variant: 'outlined',
      class: {
        indicator: 'bg-surface-base border-border-default group-hover:border-border-emphasis'
      }
    },
    {
      checked: false,
      variant: 'filled',
      class: {
        indicator: 'bg-surface-subtle border-border-subtle group-hover:border-border-default'
      }
    },
    {
      checked: false,
      variant: 'ghost',
      class: { indicator: 'bg-transparent border-transparent group-hover:bg-surface-subtle' }
    },

    // Checked intent colors
    {
      checked: true,
      intent: 'primary',
      class: { indicator: 'bg-primary border-primary', dot: 'bg-text-on-primary' }
    },
    {
      checked: true,
      intent: 'secondary',
      class: { indicator: 'bg-secondary border-secondary', dot: 'bg-text-on-primary' }
    },
    {
      checked: true,
      intent: 'success',
      class: { indicator: 'bg-success border-success', dot: 'bg-text-on-primary' }
    },
    {
      checked: true,
      intent: 'warning',
      class: { indicator: 'bg-warning border-warning', dot: 'bg-text-on-warning' }
    },
    {
      checked: true,
      intent: 'danger',
      class: { indicator: 'bg-danger border-danger', dot: 'bg-text-on-primary' }
    },
    {
      checked: true,
      intent: 'neutral',
      class: { indicator: 'bg-neutral border-neutral', dot: 'bg-text-on-primary' }
    },

    // Error overrides unchecked border
    {
      error: true,
      checked: false,
      class: { indicator: 'border-danger peer-focus-visible:ring-danger/40' }
    }
  ],
  defaultVariants: {
    tier: 'commit',
    size: 'md',
    intent: 'primary',
    variant: 'outlined',
    checked: false,
    disabled: false,
    error: false
  }
});

export type RadioGroupVariants = VariantProps<typeof radioGroupVariants>;
export type RadioItemVariants = VariantProps<typeof radioItemVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type RadioGroupSlots = SlotNames<typeof radioGroupVariants>;
export type RadioItemSlots = SlotNames<typeof radioItemVariants>;
