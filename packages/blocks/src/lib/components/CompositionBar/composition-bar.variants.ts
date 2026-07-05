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
      'opacity-0 transition-[opacity] duration-[var(--blocks-duration-fast)]',
      'group-hover:opacity-100 group-focus-visible:opacity-100'
    ],
    tooltipLabel: ['font-medium'],
    tooltipDetail: ['text-text-tertiary tabular-nums'],
    legend: ['flex flex-wrap min-w-0'],
    // tier: modify — legend rows are small focusable affordances.
    legendItem: [
      'group/item flex min-w-0 items-center gap-2 cursor-default',
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
        legend: 'flex-row gap-x-4 gap-y-2',
        legendItem: 'min-w-0 flex-shrink basis-auto'
      },
      vertical: {
        wrapper: 'flex-row items-stretch gap-4',
        bar: 'h-full min-h-[120px] w-12 flex-col-reverse',
        segment: 'w-full',
        legend: 'flex-col gap-1.5 flex-1 min-w-0'
      }
    },
    size: {
      sm: {
        bar: 'h-2',
        legendItem: 'text-xs',
        legendDot: 'h-2 w-2',
        tooltip: 'text-[11px]'
      },
      md: {
        bar: 'h-3',
        legendItem: 'text-sm',
        legendDot: 'h-2.5 w-2.5'
      },
      lg: {
        bar: 'h-5',
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
    isHovered: {
      true: {},
      false: {}
    }
  },
  compoundVariants: [
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
