import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const segmentGroupVariants = tv({
  slots: {
    // Geometry tier moves to the `tier` variant below. The SegmentGroup is
    // the canonical "pill-track" pattern in the 3-tier system; default
    // `commit` mirrors that. `modify` softens the track + indicator into a
    // compact rectangle for inline-toolbar contexts.
    base: [
      // `group` + `data-[collapsed]` drive the content-aware degradation below.
      // `min-w-0 max-w-full` let the track shrink inside a flex/narrow parent
      // instead of pushing the page wide; `overflow-x-clip` (with a clip-margin
      // so focus rings aren't cut) contains any horizontal overflow until the
      // ResizeObserver flips to the vertical stack.
      'group relative inline-flex items-center',
      'min-w-0 max-w-full overflow-x-clip [overflow-clip-margin:0.5rem]',
      // Collapsed = real horizontal overflow detected → vertical radio-style
      // stack (all options visible, large tap targets). SegmentGroup is already
      // role=radiogroup, so this is layout-only; the 2D indicator follows the
      // active row.
      'data-[collapsed]:flex-col data-[collapsed]:items-stretch data-[collapsed]:w-full data-[collapsed]:overflow-visible',
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
      // In the collapsed (vertical) layout each item becomes a full-width,
      // left-aligned row — see the `data-[collapsed]` block on `base`.
      'group-data-[collapsed]:w-full group-data-[collapsed]:justify-start',
      'font-medium whitespace-nowrap cursor-pointer select-none',
      // `border-0` (not `border-none`) — keeps `border-style: solid` so the
      // text-variant can add `border-b-[1.5px]` without a style conflict.
      'border-0 bg-transparent',
      // Note: weight is intentionally not transitioned and not bumped on
      // active. Changing font weight on selection caused horizontal
      // reflow of sibling items (knob-strips wrapping mid-row). The
      // indicator (default variant) / underline (text variant)
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
  // Variant contract (see docs/ARCHITECTURE.md §Component Styling
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
    // `<Toolbar tier="modify">` via TierContext). When `variant="text"`
    // the tier is moot — the variant override flattens the track to
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
    variant: {
      default: {},
      text: {
        // Radius flattening (`rounded-none`) and track-padding reset (`p-0`)
        // live in compoundVariants below so they strip the tier-stage
        // `rounded-{commit|modify}` and the size-stage `p-*` — those axes
        // are declared after this one and would win the fold otherwise.
        base: 'bg-transparent gap-1',
        indicator: 'hidden',
        item: [
          'border-b-[1.5px] border-b-transparent',
          'data-[state=active]:border-b-primary',
          'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
          // text-variant overrides the base `font-medium` so SegmentGroup
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
    // Text-variant flattens the corner radius (regardless of tier) and
    // zeroes the track padding (regardless of size). Compounds resolve after
    // every variant axis, so these deterministically replace the tier-stage
    // `rounded-{commit|modify}` and the size-stage `p-*`.
    { variant: 'text', class: { base: 'rounded-none p-0', item: 'rounded-none' } },

    // Text-variant sizing: padding/sizing more compact than the pill-track,
    // but still WCAG 2.5.5 AA (≥ 24px tap height). For touch-first contexts
    // the `default` variant should be used — text is primarily intended
    // for cursor-driven toolbar/knob-strip contexts.
    { variant: 'text', size: 'sm', class: { item: 'px-2 py-1.5 text-xs' } },
    { variant: 'text', size: 'md', class: { item: 'px-2.5 py-2 text-sm' } },
    { variant: 'text', size: 'lg', class: { item: 'px-3 py-2.5 text-base' } }
  ],
  defaultVariants: {
    tier: 'commit',
    variant: 'default',
    size: 'md',
    fullWidth: false,
    disabled: false
  }
});

export type SegmentGroupVariants = VariantProps<typeof segmentGroupVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type SegmentGroupSlots = SlotNames<typeof segmentGroupVariants>;
