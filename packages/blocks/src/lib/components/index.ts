export type {
  CartesianDatum,
  ChartMargin,
  ChartPlot,
  ChartSeries,
  ChartSlotClasses
} from '$lib/internal/charts/types';
// Shared chart utilities + types (the per-chart Props come via `export *` above).
export {
  arcPath,
  areaPath,
  type BandScale,
  bandScale,
  type ChartPoint,
  chartPalette,
  extent,
  linearScale,
  linePath,
  niceScale,
  numberFormatter,
  seriesColor
} from '$lib/internal/charts/utils';
export {
  type ChartSlot,
  type ChartVariants,
  chartSlotResolver,
  chartVariants
} from '$lib/internal/charts/variants';
// `DateCategory` and `DateRange` — the date surfaces' shared vocabulary
// (internal/date-grid/date-grid.types.ts) — are deliberately NOT listed here.
// All three surfaces re-export them and the `export *` lines below carry them:
// today each of those aliases the same declaration, so there is no ambiguity.
// Re-pointing one surface at a different declaration would make the name
// ambiguous and TS would say so (TS2308); an explicit line here would silently
// pick a winner instead (#191).
export * from './AreaChart';
export type { AvatarGroupProps } from './AvatarGroup';
export * from './AvatarGroup';
export * from './BarChart';
export type {
  CalendarContext,
  CalendarEvent,
  CalendarHeaderProps,
  CalendarProps,
  CalendarSelection,
  CalendarSlotName,
  CalendarViewMode,
  DayCellContext,
  EventItemContext,
  HeaderContext
} from './Calendar';
export * from './Calendar';
export * from './ChartFrame';
export * from './Chat';
export * from './CommandPalette';
export type { CompositionBarIntent, CompositionBarProps, CompositionItem } from './CompositionBar';
export * from './CompositionBar';
export type { CopyButtonProps } from './CopyButton';
export * from './CopyButton';
export * from './CurrencyInput';
export * from './DatePicker';
export * from './DonutChart';
export * from './EmptyState';
export * from './FileUpload';
export * from './Guide';
export * from './LineChart';
export type { LocaleSwitcherProps } from './LocaleSwitcher';
export * from './LocaleSwitcher';
export type { NumberInputProps } from './NumberInput';
export * from './NumberInput';
export type { PinInputProps } from './PinInput';
export * from './PinInput';
export type {
  PlannerCellContext,
  PlannerDayContext,
  PlannerHeaderContext,
  PlannerProps,
  PlannerSlotName,
  PlannerView
} from './Planner';
export * from './Planner';
export type { QRCodeProps } from './QRCode';
export * from './QRCode';
export type {
  ResourceTimelineContext,
  ResourceTimelineProps,
  ResourceTimelineSlotName,
  ResourceTimelineView,
  TimelineCellContext,
  TimelineDayContext,
  TimelineGroup,
  TimelineGroupContext,
  TimelineHeaderContext,
  TimelineLaneContext,
  TimelineLegendContext,
  TimelineRange,
  TimelineResource,
  TimelineResourceContext,
  TimelineSpanContext
} from './ResourceTimeline';
export * from './ResourceTimeline';
export type {
  SankeyIntent,
  SankeyLaidOutLinkWithMeta,
  SankeyLaidOutNodeWithMeta,
  SankeyLink,
  SankeyNode,
  SankeyProps
} from './Sankey';
export * from './Sankey';
export * from './SidebarLayout';
export * from './Sparkline';
export * from './ThemeSwitcher';
export type { TimeInputProps } from './TimeInput';
export * from './TimeInput';
