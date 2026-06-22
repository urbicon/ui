import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const segmentGroupVariants = tv({
  slots: {
    // Geometry tier moves to the `tier` variant below. The SegmentGroup is
    // the canonical "pill-track" pattern in the 3-tier system; default
    // `commit` mirrors that. `modify` softens the track + indicator into a
    // compact rectangle for inline-toolbar contexts.
    base: [
      'relative inline-flex items-center',
      'bg-surface-interactive p-1',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    indicator: [
      'absolute z-0',
      'bg-surface-base shadow-[var(--blocks-shadow-sm)]',
      'transition-all duration-[var(--blocks-duration-normal)] ease-out'
    ],
    item: [
      'relative z-10 flex items-center justify-center',
      'font-medium whitespace-nowrap cursor-pointer select-none',
      // `border-0` (not `border-none`) — keeps `border-style: solid` so the
      // text-appearance can add `border-b-[1.5px]` without a style conflict.
      'border-0 bg-transparent',
      // Note: weight is intentionally not transitioned and not bumped on
      // active. Changing font weight on selection caused horizontal
      // reflow of sibling items (knob-strips wrapping mid-row). The
      // indicator (default appearance) / underline (text appearance)
      // already signal active state — the colour shift below adds the
      // semantic emphasis without altering layout.
      'transition-colors duration-[var(--blocks-duration-fast)] ease-out',
      'text-text-tertiary',
      'hover:text-text-secondary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
      'data-[state=active]:text-text-primary'
    ]
  },
  // Appearance contract (see docs/ARCHITECTURE.md §Component Styling
  // for the surface-token hierarchy and docs/COMPONENT-FAMILIES.md §Navigation):
  //   default → classic pill-track look with an animated indicator
  //   text    → no box frame; items are bare buttons, the active one
  //             shows only `border-b-[1.5px]` in the accent color. The
  //             indicator slot is hidden in this variant. Ideal for
  //             inline-toolbar switches, knob-strips, dense filter bars.
  variants: {
    // 3-tier semantic radius. Default `commit` — SegmentGroup is the
    // canonical pill-track surface in the 3-tier vocabulary. `modify`
    // produces a soft-rectangle track + indicator + item for compact
    // inline-toolbar contexts (usually inherited from a wrapping
    // `<Toolbar tier="modify">` via TierContext). When `appearance="text"`
    // the tier is moot — the appearance override flattens the track to
    // `rounded-none` and the items wear their underline instead.
    tier: {
      commit: {
        base: 'rounded-commit',
        indicator: 'rounded-commit',
        item: 'rounded-commit'
      },
      modify: {
        base: 'rounded-modify',
        indicator: 'rounded-modify',
        item: 'rounded-modify'
      }
    },
    appearance: {
      default: {},
      text: {
        // Radius flattening (`rounded-none`) lives in compoundVariants
        // below so it strips the tier-stage `rounded-{commit|modify}`
        // cleanly — tv() only strips across stages, not within them.
        base: 'bg-transparent p-0 gap-1',
        indicator: 'hidden',
        item: [
          'border-b-[1.5px] border-b-transparent',
          'data-[state=active]:border-b-primary',
          'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
          // text-appearance overrides the base `font-medium` so SegmentGroup
          // text sits at the same weight as adjacent Select/Input values in
          // editorial knob-strip contexts. Active state remains distinct via
          // border-b-primary + text-text-primary — no need for weight to
          // carry the signal.
          'font-normal'
        ]
      }
    },
    size: {
      sm: {
        base: 'p-0.5',
        item: 'px-3 py-1 text-sm gap-1.5'
      },
      md: {
        base: 'p-1',
        item: 'px-4 py-1.5 text-base gap-2'
      },
      lg: {
        base: 'p-1.5',
        item: 'px-5 py-2 text-lg gap-2.5'
      }
    },
    fullWidth: {
      true: {
        base: 'w-full',
        item: 'flex-1'
      }
    },
    disabled: {
      true: {
        base: 'opacity-50 pointer-events-none'
      }
    }
  },
  compoundVariants: [
    // Text-appearance flattens the corner radius regardless of tier. This
    // sits in compoundVariants so it strips the `rounded-{commit|modify}`
    // emitted by the tier variant — tv() does not dedupe within a single
    // variant stage, only across stages, so the override has to live one
    // stage later.
    { appearance: 'text', class: { base: 'rounded-none', item: 'rounded-none' } },

    // Text-appearance sizing: padding/sizing more compact than the pill-track,
    // but still WCAG 2.5.5 AA (≥ 24px tap height). For touch-first contexts
    // the `default` appearance should be used — text is primarily intended
    // for cursor-driven toolbar/knob-strip contexts.
    { appearance: 'text', size: 'sm', class: { item: 'px-2 py-1.5 text-xs' } },
    { appearance: 'text', size: 'md', class: { item: 'px-2.5 py-2 text-sm' } },
    { appearance: 'text', size: 'lg', class: { item: 'px-3 py-2.5 text-base' } }
  ],
  defaultVariants: {
    tier: 'commit',
    appearance: 'default',
    size: 'md',
    fullWidth: false,
    disabled: false
  }
});

export type SegmentGroupVariants = VariantProps<typeof segmentGroupVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type SegmentGroupSlots = SlotNames<typeof segmentGroupVariants>;
