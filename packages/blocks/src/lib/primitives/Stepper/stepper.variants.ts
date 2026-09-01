import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const stepperVariants = tv({
  slots: {
    base: 'w-full',
    stepItem: '',
    // No `shrink-0` here: a horizontal step must be allowed to shrink into its
    // flex share, or a long label/description overflows the item and the next
    // step's indicator paints on top of it (measured on the decision-tree
    // wizard recipe). The min-w-0 chain + truncate below turn that overflow
    // into an ellipsis instead.
    step: [
      'group/step flex select-none',
      'transition-[color,opacity] duration-[var(--blocks-duration-fast)]'
    ],
    indicatorColumn: 'flex shrink-0 items-center justify-center',
    // Geometry tier moves to the `tier` variant below. Default `commit`
    // (circular step indicator + pill separator) — a step declares status
    // and reads as identity. `modify` softens both for compact navigation
    // bars and is usually inherited from a wrapping tier-aware container.
    indicator: [
      'flex items-center justify-center shrink-0 font-semibold',
      'border-2',
      'transition-[color,background-color,border-color,box-shadow] duration-[var(--blocks-duration-fast)]'
    ],
    labelGroup: 'flex flex-col min-w-0',
    label: [
      'font-medium leading-tight',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    description: 'text-text-tertiary leading-tight mt-0.5',
    separator: [
      'bg-border-subtle',
      'transition-[background-color] duration-[var(--blocks-duration-normal)]'
    ],
    content: 'text-text-secondary'
  },
  variants: {
    /**
     * The "(optional)" note under the label. Its own axis rather than a class
     * beside `slot('description')`, because it shares that slot's element
     * type: an axis passes through the fold, so a consumer's
     * `slotClasses.description` can still beat it.
     */
    optionalNote: {
      true: { description: 'italic' },
      false: {}
    },
    // 3-tier semantic radius. Default `commit` — step indicators are
    // circular by convention (Material, HIG, Carbon). `modify` produces
    // a soft-rectangle indicator + separator for compact wizard bars
    // (usually inherited via TierContext from a wrapping navigation
    // surface).
    tier: {
      commit: {
        indicator: 'rounded-commit',
        separator: 'rounded-commit'
      },
      modify: {
        indicator: 'rounded-modify',
        separator: 'rounded-modify'
      }
    },
    orientation: {
      horizontal: {
        base: 'flex items-center [&>li:last-child_[data-stepper-separator]]:hidden',
        stepItem: 'flex min-w-0 items-center [&:not(:last-child)]:flex-1',
        step: 'min-w-0 items-center',
        // Single-line with ellipsis: horizontal rails have no vertical room
        // for wrapping, and an overflowing label used to slide under the next
        // indicator. Vertical steps keep multi-line labels.
        label: 'truncate',
        description: 'truncate',
        separator: 'h-0.5 flex-1 mx-3'
      },
      vertical: {
        base: 'flex flex-col [&>li:last-child_[data-stepper-separator]]:hidden',
        step: 'items-center w-full',
        // `flex-col` on the indicator column makes the separator's `flex-1`
        // grow vertically (= the intended thin line) instead of horizontally
        // (which produced a wide rounded pill — STP-2).
        indicatorColumn: 'flex-col',
        separator: 'w-0.5 flex-1 my-1.5 min-h-6',
        content: 'pt-2 pb-1'
      }
    },
    size: {
      sm: {
        indicator: 'size-7 text-xs',
        step: 'gap-2',
        label: 'text-xs',
        // Body-copy floor — see the same note in radioGroup.variants.ts.
        description: 'text-xs',
        content: 'text-sm',
        indicatorColumn: 'w-7'
      },
      md: {
        indicator: 'size-9 text-sm',
        step: 'gap-2.5',
        label: 'text-sm',
        description: 'text-xs',
        content: 'text-sm',
        indicatorColumn: 'w-9'
      },
      lg: {
        indicator: 'size-11 text-base',
        step: 'gap-3',
        label: 'text-base',
        description: 'text-sm',
        content: 'text-base',
        indicatorColumn: 'w-11'
      }
    },
    // Variant contract (XC-13):
    //   default  → tinted surface, subtle border — reads as "in-page step"
    //   outlined → transparent surface, stronger border — reads as "outline of
    //              a step"; visually distinct from default on bg-surface-base
    //   minimal  → tinted bg, no border — reads as "muted step"
    variant: {
      default: {
        indicator: 'border-border-subtle bg-surface-subtle text-text-tertiary'
      },
      outlined: {
        indicator: 'border-border-default bg-transparent text-text-tertiary'
      },
      minimal: {
        indicator: 'border-transparent bg-surface-hover text-text-tertiary'
      }
    },
    state: {
      inactive: {
        label: 'text-text-tertiary'
      },
      active: {
        indicator:
          'border-primary bg-primary text-text-on-primary shadow-[var(--blocks-shadow-sm)]',
        label: 'text-text-primary'
      },
      complete: {
        indicator: 'border-primary bg-primary text-text-on-primary',
        label: 'text-text-primary'
      },
      error: {
        indicator: 'border-danger bg-danger text-text-on-fill',
        label: 'text-danger-text'
      },
      warning: {
        indicator: 'border-warning bg-warning text-text-on-warning',
        label: 'text-warning-emphasis'
      }
    },
    clickable: {
      true: {
        step: 'cursor-pointer'
      }
    },
    disabled: {
      true: {
        // Intentionally no `opacity-50` here — a blanket opacity compounded
        // with the already-muted tertiary tones on the label/description
        // below the WCAG AA threshold. The disabled visual is carried by
        // the cursor and the muted indicator rather than an opacity wash.
        step: 'cursor-not-allowed pointer-events-none'
      }
    },
    separatorComplete: {
      true: {
        separator: 'bg-primary'
      }
    }
  },
  compoundVariants: [
    {
      clickable: true,
      disabled: false,
      class: {
        step: 'focus-visible:outline-none',
        indicator: [
          'group-hover/step:shadow-[var(--blocks-shadow-sm)]',
          'group-focus-visible/step:ring-2 group-focus-visible/step:ring-primary/50 group-focus-visible/step:ring-offset-2'
        ]
      }
    },
    {
      clickable: true,
      disabled: false,
      state: 'inactive',
      class: {
        label: 'group-hover/step:text-text-secondary'
      }
    }
  ],
  defaultVariants: {
    tier: 'commit',
    orientation: 'horizontal',
    size: 'md',
    variant: 'default',
    state: 'inactive',
    clickable: false,
    disabled: false,
    separatorComplete: false
  }
});

export type StepperVariants = VariantProps<typeof stepperVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type StepperSlots = SlotNames<typeof stepperVariants>;
