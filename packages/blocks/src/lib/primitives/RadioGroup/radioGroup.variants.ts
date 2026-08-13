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
        label: "after:content-['*'] after:ml-1 after:text-danger-text"
      }
    },
    error: {
      true: {
        message: 'text-danger-text'
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
      'transition-[color,background-color,border-color,box-shadow,scale] duration-[var(--blocks-duration-fast)] ease-out',
      // Press feedback on the control surface — the same small-element press
      // cue Checkbox took from Badge/Avatar (`scale-95`); `group-active` so
      // pressing the label squeezes the indicator too. It sits on the
      // indicator rather than the dot: the dot already owns the `scale`
      // bucket for its own check-in animation (`scale-0` → `scale-100`), and
      // scaling the parent carries the dot along multiplicatively instead of
      // fighting that bucket — the whole control squeezes as one, exactly as
      // Checkbox's box does with its check glyph. `scale` is in the
      // transition list above, and reduced motion collapses
      // `--blocks-duration-fast` to 1ms.
      'group-active:scale-95',
      'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50',
      'peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-base'
    ],
    dot: [
      'opacity-0 scale-0',
      // `scale`, not `transform`: Tailwind 4 compiles `scale-*` to the
      // discrete `scale` property (`scale: var(--tw-scale-x) …`), which a
      // `transition-property: transform` does NOT cover — so the check-in
      // used to pop to full size instantly while only the opacity faded.
      // (The shorthand `transition-transform` would work, since v4 expands it
      // to `transform, translate, scale, rotate`; the explicit list has to
      // name the property it actually animates.) Both durations are tokens,
      // so reduced motion collapses the whole check-in to 1ms.
      'transition-[opacity,scale] duration-[var(--blocks-duration-fast)] ease-out'
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
      // `rounded-control`, not `rounded-commit`: a squared radio is a checkbox
      // to the eye, and shape is the only thing carrying "pick exactly one".
      // See the --radius-control note in foundation.css.
      commit: { indicator: 'rounded-control', dot: 'rounded-control' },
      modify: { indicator: 'rounded-modify', dot: 'rounded-modify' }
    },
    size: {
      xs: {
        item: 'gap-1.5',
        indicator: 'w-3.5 h-3.5 mt-px',
        dot: 'w-1.5 h-1.5',
        label: 'text-xs',
        // `description` carries full sentences, so it stops at the body-copy
        // floor (`text-xs`) instead of continuing the ladder down to `text-3xs`
        // (10px) — 2xs/3xs are for marks, hints and dense grids, never for prose
        // (see the tokens page). At this size the label/description hierarchy is
        // carried by colour (the ink ramp: text-text-primary vs
        // text-text-tertiary) rather than size.
        description: 'text-xs'
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
      class: { indicator: 'bg-transparent border-transparent group-hover:bg-surface-hover' }
    },

    // Checked intent colors
    // Hover/active darken through the intent interaction-layer tokens — the
    // same `bg-<intent>-hover` / `bg-<intent>-active` ladder Button and
    // Checkbox use — via `group-*` so hovering/pressing the label counts too.
    // The border goes transparent (as in Checkbox, and for the reason written
    // out at `variant.filled` in button.variants.ts): it would otherwise be a
    // second copy of the fill colour that the ladder above leaves behind.
    //
    // The Button comment's consolation — that the redrawn edge is confined to
    // the rounded ends — does NOT transfer here, and the difference is worth
    // knowing before someone reuses that sentence again: the indicator is a
    // full circle (`--radius-control: 9999px`), so its entire outline is
    // curve. 134 of 1600 px move at 2× DPR, ≈ the circumference. It is the
    // same antialiasing seam, just everywhere at once — the fill and the dot
    // are untouched, which is what carries the state.
    //
    // The dot keeps ONE colour across all three stops: it is the intent's
    // paired on-colour, and `style/contrast.test.ts` measures exactly that
    // pairing (`--color-<intent>` / `-hover` / `-active` against
    // `--color-text-on-fill` / `-on-warning`) across every theme × mode ×
    // state — 126 combinations, all ≥ AA 4.5:1, and all ≥ the 3:1
    // UI-component floor that actually binds a non-text mark. That includes
    // the one adverse direction, `warning/light/active`, where the fill
    // darkens *toward* the dark `text-on-warning`; warning-700 is pinned as
    // the lowest press stop that still clears AA. So a state-dependent dot
    // colour would buy nothing the token graph does not already guarantee.
    {
      checked: true,
      intent: 'primary',
      class: {
        indicator:
          'bg-primary border-transparent group-hover:bg-primary-hover group-active:bg-primary-active',
        dot: 'bg-text-on-primary'
      }
    },
    {
      checked: true,
      intent: 'secondary',
      class: {
        indicator:
          'bg-secondary border-transparent group-hover:bg-secondary-hover group-active:bg-secondary-active',
        dot: 'bg-text-on-fill'
      }
    },
    {
      checked: true,
      intent: 'success',
      class: {
        indicator:
          'bg-success border-transparent group-hover:bg-success-hover group-active:bg-success-active',
        dot: 'bg-text-on-fill'
      }
    },
    {
      checked: true,
      intent: 'warning',
      class: {
        indicator:
          'bg-warning border-transparent group-hover:bg-warning-hover group-active:bg-warning-active',
        dot: 'bg-text-on-warning'
      }
    },
    {
      checked: true,
      intent: 'danger',
      class: {
        indicator:
          'bg-danger border-transparent group-hover:bg-danger-hover group-active:bg-danger-active',
        dot: 'bg-text-on-fill'
      }
    },
    {
      checked: true,
      intent: 'neutral',
      class: {
        indicator:
          'bg-neutral border-transparent group-hover:bg-neutral-hover group-active:bg-neutral-active',
        dot: 'bg-text-on-fill'
      }
    },

    // Error overrides unchecked border
    // `group-hover:border-danger` pins the hover bucket too: the unchecked
    // compounds above carry a `group-hover:border-*` step, and a plain
    // `border-danger` does not fold it (modifier prefixes are part of the
    // conflict bucket), so without this the error boundary went neutral the
    // moment the pointer arrived — exactly when the mark matters.
    {
      error: true,
      checked: false,
      class: {
        indicator: 'border-danger group-hover:border-danger peer-focus-visible:ring-danger/40'
      }
    },

    // Error on the SELECTED radio: a ring, not a fill — see the long rationale
    // in checkbox.variants.ts. The dot keeps its intent colour (it says *what*
    // is chosen), the ring says *this choice is the problem*.
    {
      error: true,
      checked: true,
      class: {
        indicator:
          'ring-2 ring-danger/60 ring-offset-1 ring-offset-surface-base peer-focus-visible:ring-danger/60'
      }
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
