import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const buttonVariants = tv({
  slots: {
    base: [
      'relative inline-flex items-center justify-center gap-2',
      'font-medium text-center whitespace-nowrap border cursor-pointer select-none',
      'transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-[var(--blocks-duration-fast)] ease-out overflow-hidden',
      // Radius is driven by the `tier` variant axis below — see `tier`.
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'
    ],
    content: [
      // `[gap:inherit]` (arbitrary property), NOT `gap-inherit`: Tailwind v4 has
      // no `gap-inherit` utility — the spacing-based `gap-*` scale has no
      // `inherit` member (unlike `text-inherit`/`border-inherit`), so that class
      // emits no rule and the icon↔label gap silently collapses to 0. The
      // arbitrary property makes `content` inherit `base`'s per-size gap as
      // intended. (Codeberg #21)
      'flex items-center [gap:inherit] transition-opacity duration-[var(--blocks-duration-fast)]'
    ],
    spinner: [
      'flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-[var(--blocks-duration-fast)]'
    ]
  },
  variants: {
    // 3-tier semantic radius. Default `commit` (pill) — Button is a commit
    // surface. Opt-in `modify` (soft) is for tight contexts like icon-only
    // toolbars, where pill-shaped ghost buttons read as tags. Usually
    // inherited from a wrapping <Toolbar> / <ButtonGroup> via TierContext.
    tier: {
      commit: { base: 'rounded-commit' },
      modify: { base: 'rounded-modify' }
    },
    intent: {
      primary: {
        base: [
          'shadow-[var(--blocks-shadow-sm)]',
          'hover:shadow-[var(--blocks-shadow-md)]',
          'active:scale-[0.98] active:shadow-[var(--blocks-shadow-sm)]',
          'focus-visible:ring-primary/50'
        ]
      },
      secondary: {
        base: [
          'shadow-[var(--blocks-shadow-sm)]',
          'hover:shadow-[var(--blocks-shadow-md)]',
          'active:scale-[0.98] active:shadow-[var(--blocks-shadow-sm)]',
          'focus-visible:ring-secondary/50'
        ]
      },
      success: {
        base: [
          'shadow-[var(--blocks-shadow-sm)]',
          'hover:shadow-[var(--blocks-shadow-md)]',
          'active:scale-[0.98] active:shadow-[var(--blocks-shadow-sm)]',
          'focus-visible:ring-success/50'
        ]
      },
      warning: {
        base: [
          'shadow-[var(--blocks-shadow-sm)]',
          'hover:shadow-[var(--blocks-shadow-md)]',
          'active:scale-[0.98] active:shadow-[var(--blocks-shadow-sm)]',
          'focus-visible:ring-warning/50'
        ]
      },
      danger: {
        base: [
          'shadow-[var(--blocks-shadow-sm)]',
          'hover:shadow-[var(--blocks-shadow-md)]',
          'active:scale-[0.98] active:shadow-[var(--blocks-shadow-sm)]',
          'focus-visible:ring-danger/50'
        ]
      },
      neutral: {
        base: [
          'shadow-[var(--blocks-shadow-sm)]',
          'hover:shadow-[var(--blocks-shadow-md)]',
          'active:scale-[0.98] active:shadow-[var(--blocks-shadow-sm)]',
          'focus-visible:ring-neutral/50'
        ]
      }
    },
    // Declared BEFORE `variant` so the flat variants (ghost/text
    // `shadow-none`) win the shadow bucket over the pressed depth cue —
    // a pressed ghost button stays flat. For filled/outlined (no shadow of
    // their own) the pressed `shadow-xs` still applies.
    pressed: {
      true: {
        base: 'scale-[0.98] brightness-90 shadow-[var(--blocks-shadow-xs)]'
      }
    },
    variant: {
      filled: {},
      outlined: {
        base: ['bg-transparent border-1']
      },
      ghost: {
        base: ['bg-transparent border-transparent shadow-none']
      },
      text: {
        // No `px-*` here: the size axis (declared later) always supplies the
        // horizontal padding, so a variant-level `px-2` could never win —
        // it was dead weight under the old CSS-order tie-break too.
        base: ['bg-transparent border-none shadow-none', 'hover:bg-transparent hover:underline']
      }
    },
    size: {
      '2xs': {
        base: 'h-4 px-2 text-xs gap-1'
      },
      xs: {
        base: 'h-6 px-2 text-xs gap-1'
      },
      sm: {
        base: 'h-8 px-3 text-sm gap-1.5'
      },
      md: {
        base: 'h-10 px-4 text-base gap-2'
      },
      lg: {
        base: 'h-12 px-6 text-lg gap-2.5'
      },
      xl: {
        base: 'h-14 px-8 text-xl gap-3'
      }
    },
    loading: {
      true: {
        base: 'cursor-wait'
      },
      false: {
        spinner: 'hidden'
      }
    },
    loadingPlacement: {
      overlay: {},
      start: {},
      end: {}
    },
    active: {
      true: {},
      false: {}
    },
    buttonGroupConnected: {
      true: {
        base: 'rounded-none shadow-none focus-visible:z-10'
      }
    }
  },
  compoundVariants: [
    // Filled Variants per intent
    {
      intent: 'primary',
      variant: 'filled',
      class: {
        base: 'bg-primary text-text-on-primary border-primary hover:bg-primary-hover active:bg-primary-active'
      }
    },
    {
      intent: 'secondary',
      variant: 'filled',
      class: {
        base: 'bg-secondary text-text-on-primary border-secondary hover:bg-secondary-hover active:bg-secondary-active'
      }
    },
    {
      intent: 'success',
      variant: 'filled',
      class: {
        base: 'bg-success text-text-on-primary border-success hover:bg-success-hover active:bg-success-active'
      }
    },
    {
      intent: 'warning',
      variant: 'filled',
      class: {
        base: 'bg-warning text-text-on-warning border-warning hover:bg-warning-hover active:bg-warning-active'
      }
    },
    {
      intent: 'danger',
      variant: 'filled',
      class: {
        base: 'bg-danger text-text-on-primary border-danger hover:bg-danger-hover active:bg-danger-active'
      }
    },
    {
      intent: 'neutral',
      variant: 'filled',
      class: {
        base: 'bg-neutral text-text-on-primary border-neutral hover:bg-neutral-hover active:bg-neutral-active'
      }
    },
    // Loading placement behaviors
    {
      loading: true,
      loadingPlacement: 'overlay',
      class: {
        content: 'opacity-0',
        spinner: 'opacity-100 absolute inset-0 z-10'
      }
    },
    {
      loading: true,
      loadingPlacement: 'start',
      class: {
        base: 'gap-2',
        spinner: 'opacity-100 mr-2 order-first'
      }
    },
    {
      loading: true,
      loadingPlacement: 'end',
      class: {
        base: 'gap-2',
        spinner: 'opacity-100 ml-2 order-last'
      }
    },
    // Outlined variants for each intent
    {
      intent: 'primary',
      variant: 'outlined',
      class: {
        base: 'text-primary-emphasis border-primary hover:bg-primary-subtle'
      }
    },
    {
      intent: 'secondary',
      variant: 'outlined',
      class: {
        base: 'text-secondary-emphasis border-secondary hover:bg-secondary-subtle'
      }
    },
    {
      intent: 'success',
      variant: 'outlined',
      class: {
        base: 'text-success-emphasis border-success hover:bg-success-subtle'
      }
    },
    {
      intent: 'warning',
      variant: 'outlined',
      class: {
        base: 'text-warning-emphasis border-warning hover:bg-warning-subtle'
      }
    },
    {
      intent: 'danger',
      variant: 'outlined',
      class: {
        base: 'text-danger-emphasis border-danger hover:bg-danger-subtle'
      }
    },
    {
      intent: 'neutral',
      variant: 'outlined',
      class: {
        base: 'text-neutral-emphasis border-neutral hover:bg-neutral-subtle'
      }
    },
    // Ghost Variants
    {
      intent: 'primary',
      variant: 'ghost',
      class: {
        base: 'text-primary-emphasis hover:bg-primary-subtle'
      }
    },
    {
      intent: 'secondary',
      variant: 'ghost',
      class: {
        base: 'text-secondary-emphasis hover:bg-secondary-subtle'
      }
    },
    {
      intent: 'success',
      variant: 'ghost',
      class: {
        base: 'text-success-emphasis hover:bg-success-subtle'
      }
    },
    {
      intent: 'warning',
      variant: 'ghost',
      class: {
        base: 'text-warning-emphasis hover:bg-warning-subtle'
      }
    },
    {
      intent: 'danger',
      variant: 'ghost',
      class: {
        base: 'text-danger-emphasis hover:bg-danger-subtle'
      }
    },
    {
      intent: 'neutral',
      variant: 'ghost',
      class: {
        base: 'text-neutral-emphasis hover:bg-neutral-subtle'
      }
    },
    // Text Variants
    {
      intent: 'primary',
      variant: 'text',
      class: {
        base: 'text-primary'
      }
    },
    {
      intent: 'secondary',
      variant: 'text',
      class: {
        base: 'text-secondary'
      }
    },
    {
      intent: 'success',
      variant: 'text',
      class: {
        base: 'text-success'
      }
    },
    {
      intent: 'warning',
      variant: 'text',
      class: {
        base: 'text-warning-emphasis'
      }
    },
    {
      intent: 'danger',
      variant: 'text',
      class: {
        base: 'text-danger'
      }
    },
    {
      intent: 'neutral',
      variant: 'text',
      class: {
        base: 'text-neutral'
      }
    },
    // Active + Outlined: promote to filled appearance, hover matches filled hover
    {
      active: true,
      variant: 'outlined',
      intent: 'primary',
      class: { base: 'bg-primary text-text-on-primary border-primary hover:bg-primary-hover' }
    },
    {
      active: true,
      variant: 'outlined',
      intent: 'secondary',
      class: { base: 'bg-secondary text-text-on-primary border-secondary hover:bg-secondary-hover' }
    },
    {
      active: true,
      variant: 'outlined',
      intent: 'success',
      class: { base: 'bg-success text-text-on-primary border-success hover:bg-success-hover' }
    },
    {
      active: true,
      variant: 'outlined',
      intent: 'warning',
      class: { base: 'bg-warning text-text-on-warning border-warning hover:bg-warning-hover' }
    },
    {
      active: true,
      variant: 'outlined',
      intent: 'danger',
      class: { base: 'bg-danger text-text-on-primary border-danger hover:bg-danger-hover' }
    },
    {
      active: true,
      variant: 'outlined',
      intent: 'neutral',
      class: { base: 'bg-neutral text-text-on-primary border-neutral hover:bg-neutral-hover' }
    },
    // Active + Ghost: subtle intent background + ring outline + bolder text;
    // the subtle-tone alone is too close to surface-base on light pages —
    // the ring is what makes the active state visible (BGR-2).
    {
      active: true,
      variant: 'ghost',
      intent: 'primary',
      class: {
        base: 'bg-primary-subtle text-primary-emphasis font-semibold ring-1 ring-inset ring-primary/30 hover:bg-primary-subtle'
      }
    },
    {
      active: true,
      variant: 'ghost',
      intent: 'secondary',
      class: {
        base: 'bg-secondary-subtle text-secondary-emphasis font-semibold ring-1 ring-inset ring-secondary/30 hover:bg-secondary-subtle'
      }
    },
    {
      active: true,
      variant: 'ghost',
      intent: 'success',
      class: {
        base: 'bg-success-subtle text-success-emphasis font-semibold ring-1 ring-inset ring-success/30 hover:bg-success-subtle'
      }
    },
    {
      active: true,
      variant: 'ghost',
      intent: 'warning',
      class: {
        base: 'bg-warning-subtle text-warning-emphasis font-semibold ring-1 ring-inset ring-warning/30 hover:bg-warning-subtle'
      }
    },
    {
      active: true,
      variant: 'ghost',
      intent: 'danger',
      class: {
        base: 'bg-danger-subtle text-danger-emphasis font-semibold ring-1 ring-inset ring-danger/30 hover:bg-danger-subtle'
      }
    },
    {
      active: true,
      variant: 'ghost',
      intent: 'neutral',
      class: {
        base: 'bg-neutral-subtle text-neutral-emphasis font-semibold ring-1 ring-inset ring-neutral/40 hover:bg-neutral-subtle'
      }
    },
    // Active + Filled: deeper shade, stabilize hover
    {
      active: true,
      variant: 'filled',
      intent: 'primary',
      class: { base: 'bg-primary-active border-primary-active hover:bg-primary-active' }
    },
    {
      active: true,
      variant: 'filled',
      intent: 'secondary',
      class: { base: 'bg-secondary-active border-secondary-active hover:bg-secondary-active' }
    },
    {
      active: true,
      variant: 'filled',
      intent: 'success',
      class: { base: 'bg-success-active border-success-active hover:bg-success-active' }
    },
    {
      active: true,
      variant: 'filled',
      intent: 'warning',
      class: { base: 'bg-warning-active border-warning-active hover:bg-warning-active' }
    },
    {
      active: true,
      variant: 'filled',
      intent: 'danger',
      class: { base: 'bg-danger-active border-danger-active hover:bg-danger-active' }
    },
    {
      active: true,
      variant: 'filled',
      intent: 'neutral',
      class: { base: 'bg-neutral-active border-neutral-active hover:bg-neutral-active' }
    },
    // Active + Text: permanent underline, distinct from ghost active (no background)
    {
      active: true,
      variant: 'text',
      intent: 'primary',
      class: { base: 'text-primary font-semibold underline underline-offset-4 decoration-2' }
    },
    {
      active: true,
      variant: 'text',
      intent: 'secondary',
      class: { base: 'text-secondary font-semibold underline underline-offset-4 decoration-2' }
    },
    {
      active: true,
      variant: 'text',
      intent: 'success',
      class: { base: 'text-success font-semibold underline underline-offset-4 decoration-2' }
    },
    {
      active: true,
      variant: 'text',
      intent: 'warning',
      class: {
        base: 'text-warning-emphasis font-semibold underline underline-offset-4 decoration-2'
      }
    },
    {
      active: true,
      variant: 'text',
      intent: 'danger',
      class: { base: 'text-danger font-semibold underline underline-offset-4 decoration-2' }
    },
    {
      active: true,
      variant: 'text',
      intent: 'neutral',
      class: { base: 'text-neutral font-semibold underline underline-offset-4 decoration-2' }
    },
    // ButtonGroupConnected + Filled: darker per-intent border so the
    // `-ml-px`/`-mt-px` overlap renders a visible divider between
    // adjacent filled buttons (BGR-1).
    {
      buttonGroupConnected: true,
      variant: 'filled',
      intent: 'primary',
      class: { base: 'border-primary-active' }
    },
    {
      buttonGroupConnected: true,
      variant: 'filled',
      intent: 'secondary',
      class: { base: 'border-secondary-active' }
    },
    {
      buttonGroupConnected: true,
      variant: 'filled',
      intent: 'success',
      class: { base: 'border-success-active' }
    },
    {
      buttonGroupConnected: true,
      variant: 'filled',
      intent: 'warning',
      class: { base: 'border-warning-active' }
    },
    {
      buttonGroupConnected: true,
      variant: 'filled',
      intent: 'danger',
      class: { base: 'border-danger-active' }
    },
    {
      buttonGroupConnected: true,
      variant: 'filled',
      intent: 'neutral',
      class: { base: 'border-neutral-active' }
    }
  ],
  defaultVariants: {
    tier: 'commit',
    intent: 'neutral',
    variant: 'filled',
    size: 'md',
    loading: false,
    pressed: false,
    active: false,
    loadingPlacement: 'start'
  }
});

export type ButtonVariants = VariantProps<typeof buttonVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type ButtonSlots = SlotNames<typeof buttonVariants>;
