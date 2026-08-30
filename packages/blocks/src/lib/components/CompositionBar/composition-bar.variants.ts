import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const compositionBarVariants = tv({
  slots: {
    wrapper: ['flex w-full text-text-primary'],
    barWrapper: ['flex w-full min-w-0 flex-col gap-2'],
    // tier: modify — the bar is an interactive/data surface.
    bar: [
      'relative flex w-full overflow-hidden rounded-modify',
      'border border-border-hairline bg-surface-subtle',
      'transition-[box-shadow] duration-[var(--blocks-duration-fast)]'
    ],
    segment: [
      'group relative flex items-center justify-center',
      'min-w-0 cursor-default outline-none',
      'transition-[opacity,filter] duration-[var(--blocks-duration-fast)]',
      'focus-visible:z-10 focus-visible:outline-none',
      'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base'
    ],
    segmentRest: [
      'flex flex-1 items-center justify-center',
      'bg-transparent text-text-tertiary text-xs',
      'border-l border-dashed border-border-hairline'
    ],
    // tier: contain — floating tooltip surface.
    tooltip: [
      'pointer-events-none absolute z-[var(--z-tooltip)]',
      'min-w-max rounded-contain px-2.5 py-1.5',
      'bg-surface-elevated text-text-primary text-xs',
      'shadow-[var(--blocks-shadow-md)] border border-border-hairline',
      // `translate` is in the list because `variants:lint` demands it once the
      // centring offset sits in the orientation axis below: `-translate-x-1/2`
      // writes the discrete `translate` property, and the lint reads only what
      // the config declares. Measured — without it: "incomplete transition
      // list 'transition-[opacity]' … the state change jumps instead of
      // animating".
      'opacity-0 transition-[opacity,translate] duration-[var(--blocks-duration-fast)]',
      'group-hover:opacity-100 group-focus-visible:opacity-100'
    ],
    tooltipLabel: ['font-medium'],
    tooltipDetail: ['block text-text-tertiary tabular-nums'],
    legend: ['flex flex-wrap min-w-0'],
    // tier: modify — legend rows are small focusable affordances.
    legendItem: [
      'group/item flex w-full min-w-0 items-center gap-2 cursor-default text-left',
      'rounded-modify px-1 py-0.5 outline-none',
      'transition-[opacity,background-color] duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none',
      'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base'
    ],
    // tier: commit — legend status dot is a circle.
    legendDot: ['inline-block h-2.5 w-2.5 rounded-commit shrink-0'],
    legendLabel: ['text-text-secondary truncate'],
    legendValue: ['text-text-tertiary tabular-nums shrink-0 ml-auto'],
    total: ['inline-flex items-baseline gap-1.5', 'text-text-primary font-semibold tabular-nums'],
    totalLabel: ['text-text-tertiary text-xs font-normal']
  },
  variants: {
    orientation: {
      horizontal: {
        wrapper: 'flex-col gap-3',
        bar: 'w-full flex-row',
        segment: 'h-full',
        tooltip: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
        legend: 'flex-row gap-x-4 gap-y-2',
        legendItem: 'min-w-0 flex-shrink basis-auto'
      },
      vertical: {
        wrapper: 'flex-row items-stretch gap-4',
        bar: 'h-full min-h-[120px] w-12 flex-col-reverse',
        segment: 'w-full',
        tooltip: 'top-1/2 right-full mr-2 -translate-y-1/2',
        legend: 'flex-col gap-1.5 flex-1 min-w-0'
      }
    },
    // Bar thickness is orientation-dependent (height when horizontal, width
    // when vertical), so it lives in the orientation×size compounds below —
    // an axis-level `bar: h-*` would strip vertical's `h-full` length.
    size: {
      sm: {
        legendItem: 'text-xs',
        legendDot: 'h-2 w-2',
        tooltip: 'text-2xs'
      },
      md: {
        legendItem: 'text-sm',
        legendDot: 'h-2.5 w-2.5'
      },
      lg: {
        legendItem: 'text-base',
        legendDot: 'h-3 w-3'
      }
    },
    // Where the legend sits relative to the bar. Whether it renders at all is a
    // separate axis — the `showLegend` prop, consistent with the other charts —
    // so there is deliberately no `none` here (it duplicated `showLegend={false}`).
    legendPlacement: {
      top: { wrapper: 'flex-col-reverse' },
      right: { wrapper: 'flex-row items-start gap-4' },
      bottom: { wrapper: 'flex-col' },
      left: { wrapper: 'flex-row-reverse items-start gap-4' }
    },
    /**
     * Colour of a segment's focus ring and of its legend row. Per item rather
     * than per component — an item's own `intent` wins over the component's —
     * so it is passed to the slot function, not to the top-level resolver.
     */
    intent: {
      primary: {
        segment: 'focus-visible:ring-primary/50',
        legendItem: 'focus-visible:ring-primary/50'
      },
      secondary: {
        segment: 'focus-visible:ring-secondary/50',
        legendItem: 'focus-visible:ring-secondary/50'
      },
      success: {
        segment: 'focus-visible:ring-success/50',
        legendItem: 'focus-visible:ring-success/50'
      },
      warning: {
        segment: 'focus-visible:ring-warning/50',
        legendItem: 'focus-visible:ring-warning/50'
      },
      danger: {
        segment: 'focus-visible:ring-danger/50',
        legendItem: 'focus-visible:ring-danger/50'
      },
      neutral: {
        segment: 'focus-visible:ring-neutral/50',
        legendItem: 'focus-visible:ring-neutral/50'
      }
    },
    /**
     * Segment and legend-swatch background. A separate axis from `intent`
     * because an item carrying an explicit `color` paints through an inline
     * style and takes no background class, while it keeps the intent ring.
     */
    fill: {
      primary: { segment: 'bg-primary', legendDot: 'bg-primary' },
      secondary: { segment: 'bg-secondary', legendDot: 'bg-secondary' },
      success: { segment: 'bg-success', legendDot: 'bg-success' },
      warning: { segment: 'bg-warning', legendDot: 'bg-warning' },
      danger: { segment: 'bg-danger', legendDot: 'bg-danger' },
      neutral: { segment: 'bg-neutral', legendDot: 'bg-neutral' }
    },
    /** Another item is hovered, so this one recedes. */
    dimmed: {
      true: { segment: 'opacity-50', legendItem: 'opacity-60' },
      false: {}
    },
    isHovered: {
      true: { legendItem: 'bg-surface-subtle' },
      false: {}
    }
  },
  compoundVariants: [
    // Horizontal bar thickness per size. Vertical keeps its fixed w-12 from
    // the orientation axis — its length is h-full/min-h, which a size-axis
    // `h-*` would otherwise strip.
    { orientation: 'horizontal', size: 'sm', class: { bar: 'h-2' } },
    { orientation: 'horizontal', size: 'md', class: { bar: 'h-3' } },
    { orientation: 'horizontal', size: 'lg', class: { bar: 'h-5' } },

    // In horizontal orientation, legendPlacement="right"/"left" overrides the
    // wrapper flex-direction (bar on the left/right, legend on the right/left).
    {
      orientation: 'horizontal',
      legendPlacement: 'top',
      class: { wrapper: 'flex-col-reverse' }
    },
    {
      orientation: 'horizontal',
      legendPlacement: 'bottom',
      class: { wrapper: 'flex-col' }
    },
    {
      orientation: 'horizontal',
      legendPlacement: 'right',
      class: { wrapper: 'flex-row items-center gap-4' }
    },
    {
      orientation: 'horizontal',
      legendPlacement: 'left',
      class: { wrapper: 'flex-row-reverse items-center gap-4' }
    },
    // Vertical: top/bottom map to row-reverse / row (legend below/above)
    {
      orientation: 'vertical',
      legendPlacement: 'top',
      class: { wrapper: 'flex-col-reverse items-stretch' }
    },
    {
      orientation: 'vertical',
      legendPlacement: 'bottom',
      class: { wrapper: 'flex-col items-stretch' }
    }
  ],
  defaultVariants: {
    orientation: 'horizontal',
    size: 'md',
    legendPlacement: 'bottom'
  }
});

export type CompositionBarVariants = VariantProps<typeof compositionBarVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type CompositionBarSlots = SlotNames<typeof compositionBarVariants>;
