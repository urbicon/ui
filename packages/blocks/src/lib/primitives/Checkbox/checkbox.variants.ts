import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const checkboxVariants = tv({
  slots: {
    wrapper: ['inline-flex flex-col gap-1.5'],
    control: ['group inline-flex items-center gap-2 select-none cursor-pointer min-h-11'],
    // Geometry tier moves to the `tier` variant below. Default `modify` —
    // the checkbox box is an input-tap surface.
    box: [
      'relative flex items-center justify-center shrink-0 border',
      'transition-[color,background-color,border-color,box-shadow,scale] duration-[var(--blocks-duration-fast)] ease-out',
      // Press feedback on the control surface — same small-element press cue
      // as Badge/Avatar (`scale-95`); `group-active` so pressing the label
      // squeezes the box too. `scale` is in the transition list above, and
      // reduced motion collapses `--blocks-duration-fast` to 1ms.
      'group-active:scale-95',
      'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50',
      'peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-base'
    ],
    icon: [
      // Check/minus draw in along their stroke: the paths hide behind a full
      // dash offset and the checked/indeterminate variants pull it to 0.
      // 22px covers both geometries (check ≈ 20.2, minus = 14 user units);
      // the offset sits 1px past the dash edge so no round-cap dot can bleed
      // at the path start. A fast opacity fade rides along so the un-draw on
      // uncheck can't flash in the inherited text colour once the box's
      // intent fill (and its `text-on-*`) has left. Both durations are
      // tokens, so `prefers-reduced-motion` collapses the whole draw to 1ms.
      'opacity-0 transition-opacity duration-[var(--blocks-duration-fast)] ease-out',
      '[&_path]:[stroke-dasharray:22px] [&_path]:[stroke-dashoffset:23px]',
      '[&_path]:transition-[stroke-dashoffset] [&_path]:duration-[var(--blocks-duration-normal)] [&_path]:ease-out'
    ],
    label: ['text-text-primary select-none'],
    message: ['text-xs text-text-tertiary']
  },
  variants: {
    // 3-tier semantic radius. Default `modify` — a checkbox is an input-
    // tap surface. `commit` (pill) is rare but available for status-style
    // checklists where the box should read as identity rather than
    // selection. Inherited from TierContext when omitted.
    tier: {
      commit: { box: 'rounded-commit' },
      modify: { box: 'rounded-modify' }
    },
    size: {
      xs: {
        box: 'w-3.5 h-3.5',
        icon: 'w-2.5 h-2.5',
        label: 'text-xs'
      },
      sm: {
        box: 'w-4 h-4',
        icon: 'w-3 h-3',
        label: 'text-sm'
      },
      md: {
        box: 'w-5 h-5',
        icon: 'w-3.5 h-3.5',
        label: 'text-base'
      },
      lg: {
        box: 'w-6 h-6',
        icon: 'w-4 h-4',
        label: 'text-lg'
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
        icon: 'opacity-100 [&_path]:[stroke-dashoffset:0]'
      }
    },
    indeterminate: {
      true: {
        icon: 'opacity-100 [&_path]:[stroke-dashoffset:0]'
      }
    },
    disabled: {
      true: {
        control: 'opacity-50 cursor-not-allowed pointer-events-none'
      }
    },
    error: {
      true: {
        message: 'text-danger'
      }
    }
  },
  compoundVariants: [
    // ── Unchecked appearance per variant ──
    {
      checked: false,
      indeterminate: false,
      variant: 'outlined',
      class: { box: 'bg-surface-base border-border-default group-hover:border-border-emphasis' }
    },
    {
      checked: false,
      indeterminate: false,
      variant: 'filled',
      class: { box: 'bg-surface-subtle border-border-subtle group-hover:border-border-default' }
    },
    {
      checked: false,
      indeterminate: false,
      variant: 'ghost',
      class: { box: 'bg-transparent border-transparent group-hover:bg-surface-subtle' }
    },

    // ── Checked intent colors (identical across all variants) ──
    // Hover/active darken through the intent interaction-layer tokens —
    // the same `bg-<intent>-hover` / `bg-<intent>-active` ladder Button
    // uses — via `group-*` so hovering/pressing the label counts too.
    {
      checked: true,
      intent: 'primary',
      class: {
        box: 'bg-primary border-primary text-text-on-primary group-hover:bg-primary-hover group-active:bg-primary-active'
      }
    },
    {
      checked: true,
      intent: 'secondary',
      class: {
        box: 'bg-secondary border-secondary text-text-on-primary group-hover:bg-secondary-hover group-active:bg-secondary-active'
      }
    },
    {
      checked: true,
      intent: 'success',
      class: {
        box: 'bg-success border-success text-text-on-primary group-hover:bg-success-hover group-active:bg-success-active'
      }
    },
    {
      checked: true,
      intent: 'warning',
      class: {
        box: 'bg-warning border-warning text-text-on-surface group-hover:bg-warning-hover group-active:bg-warning-active'
      }
    },
    {
      checked: true,
      intent: 'danger',
      class: {
        box: 'bg-danger border-danger text-text-on-primary group-hover:bg-danger-hover group-active:bg-danger-active'
      }
    },
    {
      checked: true,
      intent: 'neutral',
      class: {
        box: 'bg-neutral border-neutral text-text-on-primary group-hover:bg-neutral-hover group-active:bg-neutral-active'
      }
    },

    // ── Indeterminate mirrors checked ──
    {
      indeterminate: true,
      intent: 'primary',
      class: {
        box: 'bg-primary border-primary text-text-on-primary group-hover:bg-primary-hover group-active:bg-primary-active'
      }
    },
    {
      indeterminate: true,
      intent: 'secondary',
      class: {
        box: 'bg-secondary border-secondary text-text-on-primary group-hover:bg-secondary-hover group-active:bg-secondary-active'
      }
    },
    {
      indeterminate: true,
      intent: 'success',
      class: {
        box: 'bg-success border-success text-text-on-primary group-hover:bg-success-hover group-active:bg-success-active'
      }
    },
    {
      indeterminate: true,
      intent: 'warning',
      class: {
        box: 'bg-warning border-warning text-text-on-surface group-hover:bg-warning-hover group-active:bg-warning-active'
      }
    },
    {
      indeterminate: true,
      intent: 'danger',
      class: {
        box: 'bg-danger border-danger text-text-on-primary group-hover:bg-danger-hover group-active:bg-danger-active'
      }
    },
    {
      indeterminate: true,
      intent: 'neutral',
      class: {
        box: 'bg-neutral border-neutral text-text-on-primary group-hover:bg-neutral-hover group-active:bg-neutral-active'
      }
    },

    // ── Error overrides unchecked border ──
    {
      error: true,
      checked: false,
      indeterminate: false,
      class: { box: 'border-danger peer-focus-visible:ring-danger/40' }
    }
  ],
  defaultVariants: {
    tier: 'modify',
    size: 'md',
    intent: 'primary',
    variant: 'outlined',
    checked: false,
    indeterminate: false,
    disabled: false,
    error: false
  }
});

export type CheckboxVariants = VariantProps<typeof checkboxVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type CheckboxSlots = SlotNames<typeof checkboxVariants>;
