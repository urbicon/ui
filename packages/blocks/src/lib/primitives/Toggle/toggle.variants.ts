import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const toggleVariants = tv({
  slots: {
    // Block-level like the rest of the form family: stacked toggles must
    // stack (#91). Inline placement stays one token away — `class="inline-flex"`
    // wins through the display conflict group.
    wrapper: ['flex flex-col gap-1.5'],
    control: ['group inline-flex items-center gap-3 select-none cursor-pointer min-h-11'],
    // Geometry tier moves to the `tier` variant below. Track + thumb share
    // the same tier — commit yields the classic Switch-Pill, modify a soft-
    // rectangle switch that reads as inline-toolbar control.
    track: [
      // `shrink-0`: the track is a flex item next to the label, and the thumb
      // travels by a per-size `translate-x-*` measured against the track's
      // NOMINAL width. Let flex shrink the track (long label, narrow card) and
      // the translation no longer lands inside it — the knob slides out past
      // the right edge. Measured on a 393px viewport: track 36.4px instead of
      // 40px, thumb overhanging by 2.6px.
      'relative inline-flex shrink-0 items-center',
      'transition-[color,background-color,border-color,box-shadow,scale] duration-[var(--blocks-duration-fast)] ease-out',
      // Press feedback on the control surface — the same small-element press
      // cue Checkbox took from Badge/Avatar (`scale-95`), with `group-active`
      // so pressing the label squeezes the switch too. It rides the TRACK,
      // not the thumb, for three reasons:
      //   1. the track is the switch's control surface — Checkbox puts the
      //      cue on `box`, and the whole subtree (thumb included) squeezes
      //      with it, so one class covers the entire control;
      //   2. the `dot` variant *hides* the thumb, so a thumb-mounted cue
      //      would silently vanish exactly where the control is smallest;
      //   3. the thumb already drives motion through `translate` (its
      //      resting `-translate-y-1/2` plus the per-size `translate-x-*`).
      //      Tailwind 4 compiles `scale-*` to the discrete `scale` property,
      //      which CSS applies AFTER `translate` about the element's own
      //      centre — so a thumb-mounted cue would shrink the knob in place
      //      at whichever end of the track it sits, reading as a rendering
      //      glitch rather than a press.
      // `scale` is in the transition list above, and reduced motion collapses
      // `--blocks-duration-fast` to 1ms.
      'group-active:scale-95',
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
    variant: {
      /** Classic switch pill — a track with an animated thumb. */
      default: {},
      // Concrete styles for `dot` live in compoundVariants below, so that
      // the override-bucket (w/h/rounded) can strip the corresponding
      // size-variant classes. tv() does not dedupe across variants in the
      // same pipeline stage — compoundVariants is the next stage.
      /**
       * Small indicator dot left of the label — outline only when off, filled
       * in the intent colour when on. Monochrome, no pill background: for
       * inline settings, dense toolbars, knob-strips, or anywhere the switch
       * is visually too dominant.
       */
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
        message: 'text-danger-text'
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
        // Off-state hover steps the boundary up to `border-emphasis` — the
        // same destination Checkbox's unchecked `outlined` box reaches, on
        // the border the track already reserves (`border border-transparent`
        // in the slot base, so nothing shifts).
        //
        // A fill step is now possible — `surface-interactive-hover` (added
        // 2026-07-25) is the rung the filled fields use, and it reads in both
        // modes. The border step stays anyway, for a Toggle-specific reason:
        // the `dot` variant hides the thumb, so the track IS the control, and a
        // boundary change reads there where a fill wash does not. (The original
        // reason was that no fill token worked at all — `surface-interactive`
        // resolved to `surface-hover` in light and `surface-active` in dark.
        // That is fixed; this is now a choice, not a constraint.)
        track: 'bg-surface-interactive group-hover:border-border-emphasis',
        thumb: 'translate-x-0'
      }
    },

    // ── withBorder: visible boundary in both states ──
    {
      variant: 'default',
      checked: false,
      withBorder: true,
      // `border-strong` is the top of the border ladder, so the off-state
      // hover above would *weaken* it (strong → emphasis). Pin the hover
      // bucket to strong: an opt-in permanent boundary must not soften when
      // the pointer arrives.
      class: { track: 'border-border-strong group-hover:border-border-strong' }
    },
    {
      variant: 'default',
      checked: true,
      withBorder: true,
      class: { track: 'ring-1 ring-inset ring-surface-base/40' }
    },

    // ── Checked track per intent (Switch-Pill only) ──
    // Hover/active darken through the intent interaction-layer tokens — the
    // same `bg-<intent>-hover` / `bg-<intent>-active` ladder Button and
    // Checkbox use — via `group-*` so hovering/pressing the label counts too.
    // No border here: the track's base already carries `border
    // border-transparent`, and a `border-<intent>` on top would be a second
    // copy of the fill that the ladder above leaves behind — a rim in the
    // resting tone around a darkened track. It used to be justified as making
    // the fill step legible; measured, it did the opposite, holding the old
    // colour while the fill moved. The full argument is at `variant.filled`
    // in button.variants.ts.
    {
      variant: 'default',
      checked: true,
      intent: 'primary',
      class: {
        track: 'bg-primary group-hover:bg-primary-hover group-active:bg-primary-active'
      }
    },
    {
      variant: 'default',
      checked: true,
      intent: 'secondary',
      class: {
        track: 'bg-secondary group-hover:bg-secondary-hover group-active:bg-secondary-active'
      }
    },
    {
      variant: 'default',
      checked: true,
      intent: 'success',
      class: {
        track: 'bg-success group-hover:bg-success-hover group-active:bg-success-active'
      }
    },
    {
      variant: 'default',
      checked: true,
      intent: 'warning',
      class: {
        track: 'bg-warning group-hover:bg-warning-hover group-active:bg-warning-active'
      }
    },
    {
      variant: 'default',
      checked: true,
      intent: 'danger',
      class: {
        track: 'bg-danger group-hover:bg-danger-hover group-active:bg-danger-active'
      }
    },
    {
      variant: 'default',
      checked: true,
      intent: 'neutral',
      class: {
        track: 'bg-neutral group-hover:bg-neutral-hover group-active:bg-neutral-active'
      }
    },

    // ── Error state: danger boundary on the unchecked track (Switch-Pill) ──
    // Mirrors Checkbox ("error overrides unchecked border"): the off state
    // carries the danger mark, the on state keeps its intent colour — an
    // error on a boolean control usually means "must be switched on".
    // The dot-variant twin lives at the END of the compound list so it
    // folds over the dot-unchecked `border-border-default` (order is
    // semantic — later compounds win conflicting buckets).
    // `group-hover:border-danger` pins the hover bucket as well — without it
    // the off-state hover step above would repaint the error boundary neutral
    // the moment the pointer arrives, which is exactly when the mark matters.
    {
      variant: 'default',
      error: true,
      checked: false,
      class: {
        track: 'border-danger group-hover:border-danger peer-focus-visible:ring-danger/40'
      }
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
      // Off-state hover: `border-default` → `border-emphasis`, the exact
      // ladder Checkbox's unchecked `outlined` box walks (the dot is
      // outline-only, so its boundary is the whole control).
      class: { track: 'border-border-default group-hover:border-border-emphasis' }
    },
    // Same intent interaction layer as the Switch-Pill above — the dot is a
    // filled intent surface too, just a 14px one. Which is also why its border
    // had to go the same way: on a 14px circle the whole outline is curve, so
    // a rim left on the resting stop was the most visible instance of the bug
    // in the library — 32% of the dot's pixels moved between the two states
    // while its edge did not. Off-state keeps its boundary above; only the
    // checked (filled) stops drop it.
    {
      variant: 'dot',
      checked: true,
      intent: 'primary',
      class: {
        track: 'bg-primary group-hover:bg-primary-hover group-active:bg-primary-active'
      }
    },
    {
      variant: 'dot',
      checked: true,
      intent: 'secondary',
      class: {
        track: 'bg-secondary group-hover:bg-secondary-hover group-active:bg-secondary-active'
      }
    },
    {
      variant: 'dot',
      checked: true,
      intent: 'success',
      class: {
        track: 'bg-success group-hover:bg-success-hover group-active:bg-success-active'
      }
    },
    {
      variant: 'dot',
      checked: true,
      intent: 'warning',
      class: {
        track: 'bg-warning group-hover:bg-warning-hover group-active:bg-warning-active'
      }
    },
    {
      variant: 'dot',
      checked: true,
      intent: 'danger',
      class: {
        track: 'bg-danger group-hover:bg-danger-hover group-active:bg-danger-active'
      }
    },
    {
      variant: 'dot',
      checked: true,
      intent: 'neutral',
      class: {
        track: 'bg-neutral group-hover:bg-neutral-hover group-active:bg-neutral-active'
      }
    },

    // ── Error state, dot variant (must fold over dot-unchecked border) ──
    // Pins the hover bucket too, for the same reason as the Switch-Pill twin.
    {
      variant: 'dot',
      error: true,
      checked: false,
      class: { track: 'border-danger group-hover:border-danger' }
    },

    // ── Error on a SWITCHED-ON control: a ring, not a fill ──
    // Completes the boolean rule rather than replacing it (full rationale in
    // checkbox.variants.ts): "must be switched on" stays the common reading, so
    // the off state keeps its danger boundary — but an error on an already-on
    // switch ("this integration was revoked") had no visual at all. The track
    // keeps its intent fill, the ring carries the fault. Last in the list so it
    // folds over the checked-intent steps above.
    {
      error: true,
      checked: true,
      class: {
        track:
          'ring-2 ring-danger/60 ring-offset-1 ring-offset-surface-base peer-focus-visible:ring-danger/60'
      }
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
