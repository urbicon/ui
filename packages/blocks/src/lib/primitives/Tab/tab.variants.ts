import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

// Tab represents navigation between panels (switch, don't commit). The
// default tier is `modify` — soft-rounded rectangles read as tap surfaces.
// `commit` is available for status-oriented tab strips that want the full
// pill shape; SegmentGroup remains the canonical commit-tier control for
// state declarations (see comment in segmentgroup.variants.ts).
export const tabVariants = tv({
  slots: {
    base: ['relative w-full'],
    // `relative` is the positioning context for three things: the `line`
    // indicator, and — on the horizontal compounds below — the strip underline,
    // drawn as a `before:` pseudo rather than as this element's `border-b`.
    //
    // Why a pseudo: the horizontal orientation makes this element a scroll
    // container (`overflow-x-auto`), and a scroll container clips its content at
    // the PADDING box. The trigger's focus ring reaches 4px past its border box
    // (`ring-2` + `ring-offset-2`), so it survives only if the trigger is inset
    // 4px from that padding box — which puts anything painted at the BORDER box
    // edge, i.e. a `border-b`, at least 4px below the tabs. `pills` and `solid`
    // already pay that 4px as `p-1` and have no underline to misplace; `line`
    // and `enclosed` do, so they buy the same room and re-draw the line where
    // the border used to sit.
    //
    // Measured, because the plausible cheaper fixes are not fixes: `overflow-y`
    // cannot stay `visible` next to a scrolling `overflow-x` (CSS computes it to
    // `auto`), and Chromium clips an `outline` exactly like a `box-shadow`, so
    // swapping the ring's property changes nothing.
    //
    // `py-1` is the house idiom for this, not a local invention — Scroller's
    // viewport carries the same 4px for the same reason (see
    // scroller.variants.ts). Tab is the scroll container that never got it.
    //
    // `focus-visible:outline-none` without a replacement ring, unlike `trigger`
    // and `panel` which set both: this element carries `tabindex="-1"` so the
    // scroll container stays out of the tab order, and nothing in Tab.svelte
    // ever focuses it — `tabListElement` is read for the indicator geometry,
    // and keyboard navigation moves focus to a tab BUTTON. So there is no state
    // to design, only Chromium's own `outline: auto` to suppress if focus ever
    // arrives by script. It was the last thing in these fixtures still drawing
    // a UA ring, and a platform-dependent one: black on linux, blue on darwin,
    // which put a difference into the pixel baselines that guards nothing.
    list: ['relative flex gap-1', 'focus-visible:outline-none'],
    trigger: [
      'relative z-10 flex items-center justify-center gap-2',
      'font-medium whitespace-nowrap cursor-pointer select-none',
      'transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--blocks-duration-fast)] ease-out',
      // Focus-ring geometry is bound to tier below so a commit-tier (pill)
      // trigger does not flip to a soft-rectangle outline on focus.
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/50',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'
    ],
    icon: ['inline-flex items-center justify-center shrink-0'],
    label: ['inline-flex items-center'],
    badge: ['inline-flex items-center ml-auto'],
    panel: [
      'w-full',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/20'
    ],
    indicator: [
      'absolute z-0 transition-all duration-[var(--blocks-duration-normal)] ease-out',
      'bg-primary'
    ]
  },
  variants: {
    variant: {
      line: {
        // Colour only — WHERE the rule is drawn is orientation-specific:
        // `border-l` when vertical, the `before:` underline when horizontal.
        list: 'border-border-subtle',
        trigger: [
          'px-4 py-2 text-text-tertiary',
          'hover:text-text-primary',
          'data-[state=active]:text-primary'
        ],
        indicator: 'h-0.5'
      },
      pills: {
        list: 'p-1 bg-surface-interactive',
        trigger: [
          'px-4 py-2 text-text-tertiary',
          // The trigger sits ON the list's `surface-interactive` fill, so its
          // hover is the fill's own step — `surface-hover` resolves to the same
          // value as the fill in light mode and was a no-op there.
          'hover:text-text-primary hover:bg-surface-interactive-hover',
          'data-[state=active]:bg-surface-base data-[state=active]:text-primary',
          'data-[state=active]:shadow-[var(--blocks-shadow-sm)]'
        ]
      },
      enclosed: {
        list: 'border-border-subtle',
        trigger: [
          'px-4 py-2 border border-b-0 -mb-px',
          'text-text-tertiary border-transparent',
          'hover:text-text-primary hover:bg-surface-hover',
          'data-[state=active]:bg-surface-base data-[state=active]:text-primary',
          'data-[state=active]:border-border-subtle data-[state=active]:border-b-surface-base'
        ]
      },
      solid: {
        list: 'p-1 bg-surface-interactive',
        trigger: [
          'px-4 py-2 text-text-tertiary',
          'hover:text-text-primary',
          'data-[state=active]:bg-primary data-[state=active]:text-text-on-primary',
          'data-[state=active]:shadow-[var(--blocks-shadow-sm)]'
        ]
      }
    },
    orientation: {
      horizontal: {
        list: 'flex-row overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        panel: 'mt-4'
      },
      vertical: {
        base: 'flex gap-4',
        list: 'flex-col',
        panel: 'flex-1'
      }
    },
    size: {
      sm: {
        trigger: 'text-sm',
        icon: 'size-4',
        panel: 'text-sm'
      },
      md: {
        trigger: 'text-base',
        icon: 'size-5',
        panel: 'text-base'
      },
      lg: {
        trigger: 'text-lg',
        icon: 'size-6',
        panel: 'text-lg'
      }
    },
    fullWidth: {
      true: {
        trigger: 'flex-1'
      }
    },
    // 3-tier semantic radius. Default `modify` — Tab is navigation, the
    // trigger reads as a soft-rounded tap surface. `commit` switches to
    // full pills (uncommon, but available for product-marketing tab
    // strips). The body radius lives in compoundVariants — only `pills`,
    // `enclosed`, and `solid` carry a visible corner; `line` is borderless
    // and the body radius has no effect there. The focus-ring radius is
    // bound here so it follows the trigger geometry across all variants.
    tier: {
      commit: { trigger: 'focus-visible:rounded-commit' },
      modify: { trigger: 'focus-visible:rounded-modify' }
    }
  },
  compoundVariants: [
    // ── Tier × variant radius matrix ──
    {
      tier: 'modify',
      variant: 'pills',
      class: { list: 'rounded-modify', trigger: 'rounded-modify' }
    },
    {
      tier: 'commit',
      variant: 'pills',
      class: { list: 'rounded-commit', trigger: 'rounded-commit' }
    },
    {
      tier: 'modify',
      variant: 'solid',
      class: { list: 'rounded-modify', trigger: 'rounded-modify' }
    },
    {
      tier: 'commit',
      variant: 'solid',
      class: { list: 'rounded-commit', trigger: 'rounded-commit' }
    },
    {
      // Horizontal enclosed: top corners follow the tier. Vertical enclosed
      // gets its own `rounded-l-{tier}` pair below — the horizontal compound
      // is gated on orientation to avoid emitting `rounded-t-{tier}` next
      // to the vertical-specific `rounded-t-none`, which would leave two
      // `rounded-t-*` classes in the output and rely on CSS source order.
      tier: 'modify',
      variant: 'enclosed',
      orientation: 'horizontal',
      class: { trigger: 'rounded-t-modify' }
    },
    {
      tier: 'commit',
      variant: 'enclosed',
      orientation: 'horizontal',
      class: { trigger: 'rounded-t-commit' }
    },
    // ── Horizontal underline + focus-ring room (see the `list` slot) ──
    //
    // `py-1` is the ring's 4px, and `before:bottom-1` puts the rule back exactly
    // where the old `border-b` sat: flush with the triggers' bottom edge. The
    // indicator moves with it, so the active underline and the rule stay one
    // line rather than two.
    {
      variant: 'line',
      orientation: 'horizontal',
      class: {
        list: [
          'py-1',
          "before:content-[''] before:absolute before:z-0 before:inset-x-0",
          'before:bottom-1 before:h-px before:bg-border-subtle'
        ],
        indicator: 'bottom-1 left-0 w-full'
      }
    },
    {
      // Enclosed pays 1px more at the bottom than `line` does: its trigger
      // carries `-mb-px` to tuck under the rule (that overlap is what makes the
      // active tab read as merging into the panel), which eats 1px of the room
      // the ring needs. `pb-1.5` restores it — 5px of clip room below, 4px
      // above, and the rule follows at `before:bottom-1.5`.
      variant: 'enclosed',
      orientation: 'horizontal',
      class: {
        list: [
          'pt-1 pb-1.5',
          "before:content-[''] before:absolute before:z-0 before:inset-x-0",
          'before:bottom-1.5 before:h-px before:bg-border-subtle'
        ]
      }
    },
    {
      variant: 'line',
      orientation: 'vertical',
      class: {
        // No scroll container on this axis, so the rule can stay a real border.
        list: 'border-l',
        indicator: 'w-0.5 h-full top-0 left-0'
      }
    },
    {
      variant: 'enclosed',
      orientation: 'vertical',
      class: {
        list: 'border-r',
        trigger: [
          'border-b border-r-0 rounded-t-none -mb-0 -mr-px',
          'data-[state=active]:border-r-surface-base data-[state=active]:border-b-border-subtle'
        ]
      }
    },
    {
      tier: 'modify',
      variant: 'enclosed',
      orientation: 'vertical',
      class: { trigger: 'rounded-l-modify' }
    },
    {
      tier: 'commit',
      variant: 'enclosed',
      orientation: 'vertical',
      class: { trigger: 'rounded-l-commit' }
    },
    {
      variant: 'pills',
      orientation: 'vertical',
      class: {
        trigger: 'w-full justify-start'
      }
    },
    {
      variant: 'solid',
      orientation: 'vertical',
      class: {
        trigger: 'w-full justify-start'
      }
    },
    {
      variant: 'line',
      size: 'sm',
      class: {
        trigger: 'py-1.5'
      }
    },
    {
      variant: 'line',
      size: 'lg',
      class: {
        trigger: 'py-3'
      }
    }
  ],
  defaultVariants: {
    variant: 'line',
    orientation: 'horizontal',
    size: 'md',
    fullWidth: false,
    tier: 'modify'
  }
});

export type TabVariants = VariantProps<typeof tabVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type TabSlots = SlotNames<typeof tabVariants>;
