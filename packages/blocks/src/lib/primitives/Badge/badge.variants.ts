import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const PLACEMENT_VALUES = [
  'top',
  'top-start',
  'top-end',
  'bottom',
  'bottom-start',
  'bottom-end',
  'left',
  'right'
] as const;

const PLACEMENT_ARRAY = [...PLACEMENT_VALUES];

export const badgeVariants = tv({
  slots: {
    base: [
      'relative inline-flex items-center justify-center',
      'font-medium text-center whitespace-nowrap border select-none',
      // `scale` is listed because the `interactive` axis adds
      // `hover:scale-105 active:scale-95` — Tailwind 4 emits those as the
      // discrete `scale:` property, which nothing else in this list covers.
      // `translate` is deliberately NOT listed: the `placement` axis uses
      // translate as layout, not motion (see the exemption in
      // scripts/variants-lint.ts).
      'transition-[color,background-color,border-color,box-shadow,opacity,scale] duration-[var(--blocks-duration-fast)] ease-out'
      // Radius driven by `tier` axis below.
    ],
    // `[gap:inherit]` (arbitrary property), NOT `gap-inherit` — Tailwind v4 emits
    // no `gap-inherit` rule, so the icon↔label gap would collapse to 0. The
    // arbitrary property inherits `base`'s per-size gap. (Codeberg #21)
    content: ['flex items-center [gap:inherit]'],
    // tier: modify — small remove-control on a commit-tier badge.
    //
    // Rendered on the internal CoreIconButton (behaviour-only base: inline-flex
    // centring, cursor/select, focus-visible reset, disabled inertness), so this
    // slot carries the FULL visual identity. The class set below is the exact
    // fold of the `<Button variant="ghost" size="xs">` (intent neutral, tier
    // commit) this control used to be — the ghost/xs Button base plus the
    // remove-control overrides — MINUS the classes CoreIconButton already
    // supplies. Effective render is byte-identical to the pre-extraction Badge,
    // so the removable VR baseline stays green (see internal/core/).
    removeButton: [
      // ghost/xs neutral Button base (the part CoreIconButton does not supply)
      'relative font-medium text-center whitespace-nowrap border overflow-hidden',
      'duration-[var(--blocks-duration-fast)] ease-out',
      'bg-transparent border-transparent shadow-none',
      'hover:shadow-[var(--blocks-shadow-md)] active:scale-[var(--blocks-press-scale)] active:shadow-[var(--blocks-shadow-sm)]',
      'h-6 px-2 text-xs gap-1 focus-visible:ring-offset-2',
      // remove-control overrides (won the fold over the ghost base)
      // `scale` is named because of this slot's OWN `active:scale-*` two lines
      // up: Tailwind emits that as the discrete `scale` property, which
      // `transition-colors` does not cover — the press cue would snap. (Not
      // because of the `interactive` axis, which only ever writes into `base`.)
      // Same fold as Dialog/Drawer's closeButton.
      'ml-1 shrink-0 rounded-modify transition-[color,background-color,scale] text-current',
      'hover:bg-neutral-950/10 focus-visible:ring-1 focus-visible:ring-current'
    ],
    removeIcon: ['w-3 h-3']
  },
  variants: {
    // 3-tier semantic radius. Default `commit` (pill) — badges declare
    // identity / status. Opt-in `modify` (soft) is rare but useful when a
    // badge sits inside a modify-tier context (compact toolbar, inline tag
    // strip) and a pill would feel oversized. Usually inherited from a
    // wrapping <Toolbar tier="modify"> via TierContext.
    tier: {
      commit: { base: 'rounded-commit' },
      modify: { base: 'rounded-modify' }
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
      // Transparent, not the intent stop — the same rule Button states at
      // length: a filled surface carries its state in the fill, and a border
      // repeating that fill only falls behind when the `interactive`
      // compounds below walk `hover:bg-*-hover` / `active:bg-*-active`.
      // `border` stays in the base slot for geometry parity with `outlined`,
      // and the background paints under it.
      filled: { base: 'border-transparent' },
      outlined: {
        base: 'bg-transparent border-2'
      },
      soft: {
        // No bg here: every intent×soft compound supplies its bg-*-subtle,
        // so an axis-level bg-transparent could never win the fold.
        base: 'border-transparent'
      },
      dot: {
        base: '!p-0 rounded-commit border-none'
      }
    },
    size: {
      xs: {
        base: 'h-4 px-1.5 text-xs gap-1'
      },
      sm: {
        base: 'h-5 px-2 text-xs gap-1'
      },
      md: {
        base: 'h-6 px-2.5 text-sm gap-1.5'
      },
      lg: {
        base: 'h-7 px-3 text-sm gap-2'
      }
    },
    placement: {
      top: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
      'top-start': 'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
      'top-end': 'top-0 right-0 translate-x-1/2 -translate-y-1/2',
      bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
      'bottom-start': 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
      'bottom-end': 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
      left: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
      right: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2'
    },
    counter: {
      true: {
        base: 'justify-center tabular-nums'
      }
    },
    pulse: {
      true: {
        // Custom ring-pulse animation that doesn't drop opacity like
        // Tailwind's default `animate-pulse`. An opacity-based pulse drops
        // the text/bg contrast below WCAG AA at mid-animation; the ring
        // alternative keeps the solid fill static so the label stays
        // readable.
        base: 'animate-[badge-pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]'
      }
    },
    // The removable right-padding lives in compoundVariants (after the
    // counter px-* compounds) — a later px-* shorthand would dominate an
    // axis-level pr-2, and the ✕ button needs its room in counter badges.
    removable: {
      true: {}
    },
    interactive: {
      true: {
        base: 'cursor-pointer hover:scale-105 active:scale-95'
      }
    },
    disabled: {
      true: {
        base: 'opacity-50 cursor-not-allowed pointer-events-none'
      }
    },
    border: {
      true: {
        base: 'ring-2 ring-surface-base'
      }
    }
  },
  compoundVariants: [
    {
      placement: PLACEMENT_ARRAY,
      class: {
        base: 'absolute z-10'
      }
    },

    // Counter: min-width matches height per size for circular single-digit look
    { counter: true, size: 'xs', class: { base: 'min-w-4 px-1' } },
    { counter: true, size: 'sm', class: { base: 'min-w-5 px-1.5' } },
    { counter: true, size: 'md', class: { base: 'min-w-6 px-1.5' } },
    { counter: true, size: 'lg', class: { base: 'min-w-7 px-2' } },

    // Removable ✕ needs right-hand room. Placed after the counter compounds
    // so the pr-2 longhand refines their px-* (longhands never get
    // dominance-stripped by an EARLIER shorthand — later sources win).
    { removable: true, class: { base: 'pr-2' } },

    // The ✕ is sized against its badge. The `removeButton` slot carries the
    // frozen fold of a `<Button size="xs">` (see the slot comment), and that
    // fold's `h-6` hangs on no size axis — so an `xs` badge (h-4 = 16px) shipped
    // a 24px control, 8px taller than the element containing it. Only the two
    // sizes where the button actually overflows are corrected: `md` (h-6 in
    // h-6) and `lg` (h-6 in h-7) fit, and re-scaling them would move pixels in
    // the removable VR baseline for no defect.
    {
      removable: true,
      size: 'xs',
      // 12px control, 10px glyph — the icon would otherwise fill the button edge to edge.
      class: { removeButton: 'h-3 px-0.5', removeIcon: 'w-2.5 h-2.5' }
    },
    { removable: true, size: 'sm', class: { removeButton: 'h-4 px-1' } },

    // Dot size overrides
    {
      variant: 'dot',
      size: 'xs',
      class: { base: '!w-1.5 !h-1.5' }
    },
    {
      variant: 'dot',
      size: 'sm',
      class: { base: '!w-2 !h-2' }
    },
    {
      variant: 'dot',
      size: 'md',
      class: { base: '!w-2.5 !h-2.5' }
    },
    {
      variant: 'dot',
      size: 'lg',
      class: { base: '!w-3 !h-3' }
    },

    {
      intent: 'primary',
      variant: 'outlined',
      class: {
        base: 'text-primary-text border-primary'
      }
    },
    {
      intent: 'secondary',
      variant: 'outlined',
      class: {
        base: 'text-secondary-text border-secondary'
      }
    },
    {
      intent: 'success',
      variant: 'outlined',
      class: {
        base: 'text-success-text border-success'
      }
    },
    {
      intent: 'warning',
      variant: 'outlined',
      class: {
        base: 'text-warning-emphasis border-warning'
      }
    },
    {
      intent: 'danger',
      variant: 'outlined',
      class: {
        base: 'text-danger-text border-danger'
      }
    },
    {
      intent: 'neutral',
      variant: 'outlined',
      class: {
        base: 'text-neutral border-neutral'
      }
    },
    // Interactions for outlined variant (only when interactive)
    {
      interactive: true,
      variant: 'outlined',
      intent: 'primary',
      class: { base: 'hover:bg-primary-subtle' }
    },
    {
      interactive: true,
      variant: 'outlined',
      intent: 'secondary',
      class: { base: 'hover:bg-secondary-subtle' }
    },
    {
      interactive: true,
      variant: 'outlined',
      intent: 'success',
      class: { base: 'hover:bg-success-subtle' }
    },
    {
      interactive: true,
      variant: 'outlined',
      intent: 'warning',
      class: { base: 'hover:bg-warning-subtle' }
    },
    {
      interactive: true,
      variant: 'outlined',
      intent: 'danger',
      class: { base: 'hover:bg-danger-subtle' }
    },
    {
      interactive: true,
      variant: 'outlined',
      intent: 'neutral',
      class: { base: 'hover:bg-neutral-subtle' }
    },
    // Soft variants for each intent
    {
      intent: 'primary',
      variant: 'soft',
      class: {
        base: 'text-primary-emphasis bg-primary-subtle'
      }
    },
    {
      intent: 'secondary',
      variant: 'soft',
      class: {
        base: 'text-secondary-emphasis bg-secondary-subtle'
      }
    },
    {
      intent: 'success',
      variant: 'soft',
      class: {
        base: 'text-success-emphasis bg-success-subtle'
      }
    },
    {
      intent: 'warning',
      variant: 'soft',
      class: {
        base: 'text-warning-emphasis bg-warning-subtle'
      }
    },
    {
      intent: 'danger',
      variant: 'soft',
      class: {
        base: 'text-danger-emphasis bg-danger-subtle'
      }
    },
    {
      intent: 'neutral',
      variant: 'soft',
      class: {
        base: 'text-neutral-emphasis bg-neutral-subtle'
      }
    },
    // Filled variants per intent
    {
      intent: 'primary',
      variant: 'filled',
      class: {
        base: 'bg-primary text-text-on-primary'
      }
    },
    {
      intent: 'secondary',
      variant: 'filled',
      class: {
        base: 'bg-secondary text-text-on-fill'
      }
    },
    {
      intent: 'success',
      variant: 'filled',
      class: {
        base: 'bg-success text-text-on-fill'
      }
    },
    {
      intent: 'warning',
      variant: 'filled',
      class: {
        base: 'bg-warning text-text-on-warning'
      }
    },
    {
      intent: 'danger',
      variant: 'filled',
      class: {
        base: 'bg-danger text-text-on-fill'
      }
    },
    {
      intent: 'neutral',
      variant: 'filled',
      class: {
        base: 'bg-neutral text-text-on-fill'
      }
    },
    // Dot color per intent
    {
      intent: 'primary',
      variant: 'dot',
      class: {
        base: 'bg-primary'
      }
    },
    {
      intent: 'secondary',
      variant: 'dot',
      class: {
        base: 'bg-secondary'
      }
    },
    {
      intent: 'success',
      variant: 'dot',
      class: {
        base: 'bg-success'
      }
    },
    {
      intent: 'warning',
      variant: 'dot',
      class: {
        base: 'bg-warning'
      }
    },
    {
      intent: 'danger',
      variant: 'dot',
      class: {
        base: 'bg-danger'
      }
    },
    {
      intent: 'neutral',
      variant: 'dot',
      class: {
        base: 'bg-neutral'
      }
    },
    // Interactive hover effects for the filled variant
    {
      interactive: true,
      variant: 'filled',
      intent: 'primary',
      class: {
        base: 'hover:bg-primary-hover active:bg-primary-active'
      }
    },
    {
      interactive: true,
      variant: 'filled',
      intent: 'secondary',
      class: {
        base: 'hover:bg-secondary-hover active:bg-secondary-active'
      }
    },
    {
      interactive: true,
      variant: 'filled',
      intent: 'success',
      class: {
        base: 'hover:bg-success-hover active:bg-success-active'
      }
    },
    {
      interactive: true,
      variant: 'filled',
      intent: 'warning',
      class: {
        base: 'hover:bg-warning-hover active:bg-warning-active'
      }
    },
    {
      interactive: true,
      variant: 'filled',
      intent: 'danger',
      class: {
        base: 'hover:bg-danger-hover active:bg-danger-active'
      }
    },
    {
      interactive: true,
      variant: 'filled',
      intent: 'neutral',
      class: {
        base: 'hover:bg-neutral-hover active:bg-neutral-active'
      }
    }
  ],
  defaultVariants: {
    tier: 'commit',
    intent: 'primary',
    variant: 'filled',
    size: 'md',
    counter: false,
    pulse: false,
    removable: false,
    interactive: false,
    disabled: false,
    border: false
  }
});

export type BadgeVariants = VariantProps<typeof badgeVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type BadgeSlots = SlotNames<typeof badgeVariants>;
export type BadgePlacement = (typeof PLACEMENT_VALUES)[number];
