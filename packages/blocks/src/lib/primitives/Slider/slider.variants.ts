import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const sliderVariants = tv({
  slots: {
    wrapper: ['flex flex-col gap-1.5 w-full'],
    header: ['flex items-center justify-between'],
    label: ['text-sm font-medium text-text-secondary'],
    valueText: ['text-sm tabular-nums text-text-tertiary'],
    base: ['relative flex items-center w-full touch-none select-none cursor-pointer'],
    // tier: commit — slider is a continuous-value pill (track + range + thumb).
    // Track fill is `surface-interactive`, matching Toggle's unchecked track:
    // `surface-subtle` resolves to the SAME neutral step as `surface-elevated`
    // in both modes, so the groove vanished on any elevated card/popover.
    track: [
      'relative w-full overflow-hidden rounded-commit bg-surface-interactive',
      'transition-[background-color] duration-[var(--blocks-duration-fast)]'
    ],
    range: [
      // Height comes from the size axis (track and range share it).
      'absolute rounded-commit',
      'transition-[background-color] duration-[var(--blocks-duration-fast)]'
    ],
    thumb: [
      'absolute rounded-commit bg-surface-base border-2',
      'shadow-[var(--blocks-shadow-sm)]',
      '-translate-x-1/2 -translate-y-1/2 top-1/2',
      // `scale`, NOT `transform`: Tailwind 4 emits `scale-*` as the discrete
      // `scale:` property — `hover:scale-110` is the only animated transform
      // here, so it is the only one listed. The centring `-translate-*` above
      // is static (the thumb travels via `left`), so `translate` stays out.
      'transition-[box-shadow,scale] duration-[var(--blocks-duration-fast)]',
      'hover:scale-110 hover:shadow-[var(--blocks-shadow-md)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base'
    ],
    mark: ['absolute top-full mt-2 -translate-x-1/2 text-xs text-text-tertiary'],
    boundaryTick: [
      'absolute top-0 bottom-0 w-px bg-border-default pointer-events-none',
      'opacity-60'
    ],
    rangeStatus: [
      'flex items-center gap-1.5 text-xs',
      'transition-[color] duration-[var(--blocks-duration-fast)]'
    ],
    rangeStatusIcon: ['inline-flex shrink-0'],
    message: ['text-xs']
  },
  variants: {
    intent: {
      primary: {
        range: 'bg-primary',
        thumb: 'border-primary focus-visible:ring-primary/50'
      },
      secondary: {
        range: 'bg-secondary',
        thumb: 'border-secondary focus-visible:ring-secondary/50'
      },
      success: {
        range: 'bg-success',
        thumb: 'border-success focus-visible:ring-success/50'
      },
      warning: {
        range: 'bg-warning',
        thumb: 'border-warning focus-visible:ring-warning/50'
      },
      danger: {
        range: 'bg-danger',
        thumb: 'border-danger focus-visible:ring-danger/50'
      },
      neutral: {
        range: 'bg-neutral',
        thumb: 'border-neutral focus-visible:ring-neutral/50'
      }
    },
    size: {
      sm: {
        track: 'h-1',
        range: 'h-1',
        thumb: 'w-3.5 h-3.5'
      },
      md: {
        track: 'h-2',
        range: 'h-2',
        thumb: 'w-5 h-5'
      },
      lg: {
        track: 'h-3',
        range: 'h-3',
        thumb: 'w-7 h-7'
      }
    },
    // Variant contract (mirrors Toggle's `dot` and SegmentGroup's `text`).
    //   default → classic pill slider: filled range + 20px thumb with a
    //             white center, border in the intent color, shadow + scale on
    //             hover. Ideal for mobile and content-light contexts where the
    //             slider is the primary voice in the layout.
    //   rail    → 1px hairline track + 1px range + 8px filled intent dot,
    //             without border/shadow/hover-scale. Visually at the same
    //             volume as Toggle `dot` and SegmentGroup `text` — for
    //             knob-strips, dense forms, editorial stages. The hit-target
    //             is expanded to 24×24 via ::before (WCAG 2.5.5 AA).
    //
    // The concrete classes for `rail` live in compoundVariants further below,
    // so the tv() pipeline override can cleanly strip the size stage
    // (h-1/2/3, w-3.5 …) — variants and compounds sit in different stages,
    // and only compounds reliably win against variants.
    variant: {
      default: {},
      rail: {}
    },
    disabled: {
      true: {
        base: 'opacity-50 cursor-not-allowed pointer-events-none',
        thumb: 'hover:scale-100 hover:shadow-[var(--blocks-shadow-sm)]'
      }
    },
    // Declared BEFORE `error` so the error tone wins the message-color
    // bucket in every call shape — `{ error: true }` alone must read red.
    messageType: {
      error: { message: 'text-danger' },
      helper: { message: 'text-text-tertiary' }
    },
    error: {
      true: {
        message: 'text-danger',
        // The control itself carries the fault, not just the sentence under it.
        // A slider has no unselected state to paint danger — it always holds a
        // value — so the ring rule for selected boolean controls
        // (checkbox.variants.ts) applies here unconditionally. It rides `ring`,
        // a different layer than the thumb's `border-{intent}`, so the intent
        // keeps saying *where the value sits* while the ring says *this value
        // is the problem*.
        thumb:
          'ring-2 ring-danger/60 ring-offset-1 ring-offset-surface-base focus-visible:ring-danger/60'
      }
    },
    /**
     * Status of the current slider position relative to validRange/recommendedRange.
     * `none` means no range constraints are configured — the default behavior,
     * where `intent` applies as usual. For any other value, `rangeStatus`
     * overrides `intent` for `range` and `thumb`.
     */
    rangeStatus: {
      none: {},
      insideRecommended: {
        range: 'bg-success',
        thumb: 'border-success focus-visible:ring-success/50',
        rangeStatus: 'text-success'
      },
      insideValidOnly: {
        range: 'bg-warning',
        thumb: 'border-warning focus-visible:ring-warning/50',
        rangeStatus: 'text-warning'
      },
      outsideValidDanger: {
        range: 'bg-danger',
        thumb: 'border-danger focus-visible:ring-danger/50',
        rangeStatus: 'text-danger'
      },
      outsideValidWarning: {
        range: 'bg-warning',
        thumb: 'border-warning focus-visible:ring-warning/50',
        rangeStatus: 'text-warning'
      }
    }
  },
  compoundVariants: [
    // ─── rail variant: structural overrides ──────────────────────────
    // Strips the default-variant pill chrome from track, range and
    // thumb. tv() applies compoundVariants after base variants, so the
    // h-px / rounded-none / border-0 overrides win against the size and
    // intent stages without us having to repeat them per-size.
    {
      variant: 'rail',
      class: {
        track: 'h-px rounded-none bg-border-default',
        range: 'h-px rounded-none',
        thumb: [
          // Reset default-variant chrome
          'rounded-full border-0 bg-current shadow-none',
          // Fixed 8×8 visual — rail is size-invariant by design (analogue
          // to Toggle dot, which keeps the same dot size across sm/md/lg).
          'w-2 h-2',
          // Disable hover-scale and shadow lift; no affordance shift on
          // hover — the dot is the affordance, not a lifted disc.
          'hover:scale-100 hover:shadow-none',
          // Expanded hit-area (24×24, WCAG 2.5.5 AA). The pseudo-element
          // is transparent and sits behind the visible dot, so the dot
          // stays sharp while the hit-target swells out 8px on each side.
          'before:content-[""] before:absolute before:-inset-2 before:rounded-full'
        ]
      }
    },
    // ─── rail × intent: dot fill via text-color + bg-current ────────────
    // bg-current picks up the text-color set here, so we map intent →
    // text-color once instead of overriding bg-primary/secondary/…
    // for every intent.
    { variant: 'rail', intent: 'primary', class: { thumb: 'text-primary' } },
    { variant: 'rail', intent: 'secondary', class: { thumb: 'text-secondary' } },
    { variant: 'rail', intent: 'success', class: { thumb: 'text-success' } },
    { variant: 'rail', intent: 'warning', class: { thumb: 'text-warning' } },
    { variant: 'rail', intent: 'danger', class: { thumb: 'text-danger' } },
    { variant: 'rail', intent: 'neutral', class: { thumb: 'text-neutral' } }
  ],
  defaultVariants: {
    intent: 'primary',
    size: 'md',
    variant: 'default',
    disabled: false,
    error: false,
    messageType: 'helper',
    rangeStatus: 'none'
  }
});

export type SliderVariants = VariantProps<typeof sliderVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type SliderSlots = SlotNames<typeof sliderVariants>;
