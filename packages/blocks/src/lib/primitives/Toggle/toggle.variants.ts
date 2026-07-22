import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const toggleVariants = tv({
  slots: {
    wrapper: ['inline-flex flex-col gap-1.5'],
    control: ['group inline-flex items-center gap-3 select-none cursor-pointer min-h-11'],
    // Geometry tier moves to the `tier` variant below. Track + thumb share
    // the same tier — commit yields the classic Switch-Pill, modify a soft-
    // rectangle switch that reads as inline-toolbar control.
    track: [
      'relative inline-flex items-center',
      'transition-[color,background-color,border-color,box-shadow] duration-[var(--blocks-duration-fast)] ease-out',
      'border border-transparent',
      'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50',
      'peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-base'
    ],
    thumb: [
      'absolute bg-surface-base shadow-sm',
      'transition-transform duration-[var(--blocks-duration-fast)] ease-out',
      'left-0.5 top-1/2 -translate-y-1/2'
    ],
    label: ['text-text-primary select-none'],
    message: ['text-xs text-text-tertiary']
  },
  variants: {
    // 3-tier semantic radius. Default `commit` (classic Switch-Pill) — a
    // toggle is a status declaration, identity-shaped. Opt-in `modify`
    // renders a soft-rectangle switch for compact inline-toolbar contexts
    // (usually inherited from a wrapping `<Toolbar tier="modify">` via
    // TierContext). The `dot` variant overrides geometry in compounds
    // below, so tier is functionally a no-op there — both still type-check.
    tier: {
      commit: { track: 'rounded-commit', thumb: 'rounded-commit' },
      modify: { track: 'rounded-modify', thumb: 'rounded-modify' }
    },
    size: {
      xs: {
        track: 'w-8 h-4',
        thumb: 'w-3 h-3',
        label: 'text-xs'
      },
      sm: {
        track: 'w-10 h-5',
        thumb: 'w-4 h-4',
        label: 'text-sm'
      },
      md: {
        track: 'w-12 h-6',
        thumb: 'w-5 h-5',
        label: 'text-base'
      },
      lg: {
        track: 'w-14 h-7',
        thumb: 'w-6 h-6',
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
    // Variant contract (see docs/ARCHITECTURE.md §Tier System
    // for the commit/modify radius semantics).
    //   default → classic switch pill (track + animated thumb).
    //   dot     → small indicator dot left of the label. Off = outline only,
    //             on = fill-intent. Monochrome, no pill background. Ideal
    //             for inline settings, dense toolbars, knob-strips —
    //             or anywhere the switch is visually too dominant.
    variant: {
      default: {},
      // Concrete styles for `dot` live in compoundVariants below, so that
      // the override-bucket (w/h/rounded) can strip the corresponding
      // size-variant classes. tv() does not dedupe across variants in the
      // same pipeline stage — compoundVariants is the next stage.
      dot: {}
    },
    checked: {
      true: {},
      false: {}
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
    },
    withBorder: {
      true: {},
      false: {}
    }
  },
  compoundVariants: [
    // ── Default-variant compounds (classic Switch-Pill) ──
    // All filter on `variant: 'default'` so the new `dot` mode picks
    // up only its own monochrome compounds (defined further below).
    {
      variant: 'default',
      checked: false,
      class: {
        track: 'bg-surface-interactive',
        thumb: 'translate-x-0'
      }
    },

    // ── withBorder: visible boundary in both states ──
    {
      variant: 'default',
      checked: false,
      withBorder: true,
      class: { track: 'border-border-strong' }
    },
    {
      variant: 'default',
      checked: true,
      withBorder: true,
      class: { track: 'ring-1 ring-inset ring-surface-base/40' }
    },

    // ── Checked track per intent (Switch-Pill only) ──
    {
      variant: 'default',
      checked: true,
      intent: 'primary',
      class: { track: 'bg-primary border-primary' }
    },
    {
      variant: 'default',
      checked: true,
      intent: 'secondary',
      class: { track: 'bg-secondary border-secondary' }
    },
    {
      variant: 'default',
      checked: true,
      intent: 'success',
      class: { track: 'bg-success border-success' }
    },
    {
      variant: 'default',
      checked: true,
      intent: 'warning',
      class: { track: 'bg-warning border-warning' }
    },
    {
      variant: 'default',
      checked: true,
      intent: 'danger',
      class: { track: 'bg-danger border-danger' }
    },
    {
      variant: 'default',
      checked: true,
      intent: 'neutral',
      class: { track: 'bg-neutral border-neutral' }
    },

    // ── Error state: danger boundary on the unchecked track (Switch-Pill) ──
    // Mirrors Checkbox ("error overrides unchecked border"): the off state
    // carries the danger mark, the on state keeps its intent colour — an
    // error on a boolean control usually means "must be switched on".
    // The dot-variant twin lives at the END of the compound list so it
    // folds over the dot-unchecked `border-border-default` (order is
    // semantic — later compounds win conflicting buckets).
    {
      variant: 'default',
      error: true,
      checked: false,
      class: { track: 'border-danger peer-focus-visible:ring-danger/40' }
    },

    // ── Thumb translation per size when checked (Switch-Pill only) ──
    { variant: 'default', checked: true, size: 'xs', class: { thumb: 'translate-x-4' } },
    { variant: 'default', checked: true, size: 'sm', class: { thumb: 'translate-x-5' } },
    { variant: 'default', checked: true, size: 'md', class: { thumb: 'translate-x-6' } },
    { variant: 'default', checked: true, size: 'lg', class: { thumb: 'translate-x-7' } },

    // ── Dot variant: monochrome circular indicator ──
    // The base track is overridden to a tiny outline-only circle. The thumb
    // is hidden. Off = border-only (no bg-class so CSS default `transparent`
    // applies), on = fill-intent. compoundVariants run after the size-variant
    // stage, so `w-3.5/h-3.5/rounded-full` strip the size-based
    // `w-12/h-6/rounded-commit` from the resolved class set.
    {
      variant: 'dot',
      class: {
        track: 'w-3.5 h-3.5 rounded-full border shadow-none',
        thumb: 'hidden',
        control: 'min-h-6 gap-2'
      }
    },
    {
      variant: 'dot',
      checked: false,
      class: { track: 'border-border-default' }
    },
    {
      variant: 'dot',
      checked: true,
      intent: 'primary',
      class: { track: 'border-primary bg-primary' }
    },
    {
      variant: 'dot',
      checked: true,
      intent: 'secondary',
      class: { track: 'border-secondary bg-secondary' }
    },
    {
      variant: 'dot',
      checked: true,
      intent: 'success',
      class: { track: 'border-success bg-success' }
    },
    {
      variant: 'dot',
      checked: true,
      intent: 'warning',
      class: { track: 'border-warning bg-warning' }
    },
    {
      variant: 'dot',
      checked: true,
      intent: 'danger',
      class: { track: 'border-danger bg-danger' }
    },
    {
      variant: 'dot',
      checked: true,
      intent: 'neutral',
      class: { track: 'border-neutral bg-neutral' }
    },

    // ── Error state, dot variant (must fold over dot-unchecked border) ──
    {
      variant: 'dot',
      error: true,
      checked: false,
      class: { track: 'border-danger' }
    }
  ],
  defaultVariants: {
    tier: 'commit',
    size: 'md',
    intent: 'primary',
    variant: 'default',
    checked: false,
    disabled: false,
    error: false,
    withBorder: false
  }
});

export type ToggleVariants = VariantProps<typeof toggleVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type ToggleSlots = SlotNames<typeof toggleVariants>;
