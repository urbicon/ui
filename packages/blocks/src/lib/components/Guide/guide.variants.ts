import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

/**
 * Styling for the non-modal `GuidePanel` (D1). Mirrors the `Drawer` look
 * (surface-overlay, hairline border, lg shadow) but sits at `--z-sidebar`
 * (1350) and slides in without a backdrop, so the app stays interactive
 * behind it — required for the Mention→UI link (Direction B).
 */
export const guidePanelVariants = tv({
  slots: {
    panel: [
      'fixed top-0 bottom-0 z-[var(--z-sidebar)] flex max-w-[100dvw] flex-col',
      'bg-surface-overlay border-border-hairline shadow-[var(--blocks-shadow-lg)]',
      'overflow-hidden'
    ],
    header: ['flex items-center gap-2 px-5 py-4', 'border-b border-border-hairline flex-shrink-0'],
    backButton: [
      'inline-flex items-center gap-1 -ml-1 rounded-md px-1.5 py-1',
      'text-sm text-text-secondary hover:text-text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/50'
    ],
    // `tabindex="-1"` + programmatic focus target on article switch (a11y) — suppress the
    // ring for the keyboard-navigation case; it is never a Tab stop.
    title: [
      'flex-1 text-base font-semibold text-text-primary truncate',
      'focus-visible:outline-none'
    ],
    closeButton: [
      'inline-flex items-center justify-center rounded-md p-1',
      'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/50'
    ],
    body: ['flex-1 overflow-y-auto overscroll-contain px-5 py-4'],
    // Filter input above the index (opt-in via GuidePanel `searchable`).
    searchInput: [
      'mb-3 w-full rounded-lg border border-border-hairline bg-surface-base px-3 py-2 text-sm',
      'text-text-primary placeholder:text-text-tertiary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary/50'
    ],
    // Empty-state shown when a search filters every article out.
    noResults: ['px-3 py-6 text-center text-sm text-text-tertiary'],
    // Section label above a group of articles in the index (opt-in via GuideArticle `group`).
    groupHeader: [
      'px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-text-tertiary',
      'first:pt-1'
    ],
    list: ['flex flex-col gap-1'],
    listItem: [
      'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
      'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/50'
    ],
    footer: [
      'flex items-center justify-end gap-3 px-5 py-3',
      'border-t border-border-hairline flex-shrink-0'
    ]
  },
  variants: {
    placement: {
      left: { panel: 'left-0 border-r rounded-r-xl' },
      right: { panel: 'right-0 border-l rounded-l-xl' }
    },
    size: {
      sm: { panel: 'w-72' },
      md: { panel: 'w-96' },
      lg: { panel: 'w-[32rem]' }
    }
  },
  defaultVariants: {
    placement: 'right',
    size: 'md'
  }
});

/**
 * Styling for a `GuideArticle` body. Light prose defaults; consumers style
 * their own content via the article snippet and `slotClasses`.
 */
export const guideArticleVariants = tv({
  slots: {
    article: [
      'text-sm leading-relaxed text-text-secondary',
      '[&_:where(p)]:my-2 [&_:where(p)]:first:mt-0'
    ]
  }
});

/**
 * Styling for `GuideMarker` (Direction A, UI → Guide). A discreet, round "ⓘ"
 * icon button — intentionally low-key (tertiary text, primary on
 * hover/focus) so it reads as an affordance, not a status `Badge`.
 */
export const guideMarkerVariants = tv({
  slots: {
    marker: [
      'inline-flex shrink-0 items-center justify-center align-middle rounded-full',
      'text-text-tertiary transition-colors duration-[var(--blocks-duration-fast)]',
      'hover:text-primary-text focus-visible:text-primary-text',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/50',
      'cursor-help'
    ],
    icon: ['']
  },
  variants: {
    size: {
      sm: { icon: 'h-4 w-4' },
      md: { icon: 'h-[1.15em] max-h-5 min-h-4 w-[1.15em] max-w-5 min-w-4' }
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

/**
 * Styling for `GuideMention` (Direction B, Guide → UI). An inline, link-like
 * reference inside article prose: primary text with a dotted underline that
 * goes solid on hover/focus. Resets the native button box so it flows with the
 * surrounding text and wraps naturally.
 */
export const guideMentionVariants = tv({
  slots: {
    mention: [
      'm-0 inline cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-primary-text',
      'underline decoration-dotted decoration-1 underline-offset-2',
      'transition-[text-decoration-color] duration-[var(--blocks-duration-fast)]',
      'hover:decoration-solid focus-visible:decoration-solid',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary/50 focus-visible:rounded-[0.2em]'
    ]
  }
});

/**
 * Styling for `GuideRef` — an inline article→article link inside article prose.
 * Mirrors `GuideMention`'s link-like reset, but with a *solid* underline (vs the
 * Mention's dotted one) that thickens on hover/focus, so a panel-internal jump
 * reads distinctly from a Mention's UI highlight.
 */
export const guideRefVariants = tv({
  slots: {
    ref: [
      'm-0 inline cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-primary-text',
      'underline decoration-solid decoration-1 underline-offset-2',
      'transition-[text-decoration-thickness] duration-[var(--blocks-duration-fast)]',
      'hover:decoration-2 focus-visible:decoration-2',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary/50 focus-visible:rounded-[0.2em]'
    ]
  }
});

/**
 * Styling for `GuideHint` — a small, non-blocking bubble anchored to a
 * `data-guide` element via `floating.ts`, rendered in the native popover
 * top-layer. `overflow-visible` keeps the arrow (which sits half outside the
 * box) from being clipped by the UA `[popover]` default. Position + inset are
 * set inline in the component, as for `Tooltip`.
 */
export const guideHintVariants = tv({
  slots: {
    hint: [
      'z-[var(--z-popover)] m-0 max-w-xs overflow-visible',
      'rounded-xl border border-border-hairline bg-surface-overlay py-3 pl-4 pr-9',
      'text-sm text-text-secondary shadow-[var(--blocks-shadow-lg)]'
    ],
    title: ['mb-1 text-sm font-semibold text-text-primary'],
    body: ['leading-relaxed [&_:where(p)]:my-1 [&_:where(p)]:first:mt-0 [&_:where(p)]:last:mb-0'],
    dismiss: [
      'absolute right-2 top-2 inline-flex items-center justify-center rounded-md p-1',
      'text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/50'
    ],
    // Rotated square in the bubble colour, tucked half behind the bubble (the
    // component sets the static-side offset inline) for a seamless pointer.
    // Borderless like Tooltip's arrow — a bordered tip would leak its inner edges
    // over the bubble background and need per-placement border sides.
    arrow: ['absolute h-2.5 w-2.5 rotate-45 bg-surface-overlay']
  }
});

/**
 * Styling for the guided `Guide` tour (Phase 6) — the one *subtractive* Guide
 * surface (full-scrim spotlight, D5). The `scrim` SVG and `bubble` live inside a
 * single native-popover container (top-layer), so both clear every app stacking
 * context; the container's z is `--z-guide` (1550) as a non-top-layer fallback.
 * The `bubble` mirrors `GuideHint` (surface-overlay, hairline border, lg shadow)
 * but is a focusable `role="dialog"` with a step footer. Position + inset are set
 * inline in the component, as for `GuideHint`/`Tooltip`.
 */
export const guideTourVariants = tv({
  slots: {
    // Full-viewport popover wrapper; the component overrides the UA `[popover]`
    // box to inset:0 and sets `pointer-events:none` so only the painted scrim
    // surround + the bubble capture clicks (the cut-out hole stays click-through).
    container: ['z-[var(--z-guide)]'],
    // The SVG that paints the dim around the spotlight hole. `fill` is the
    // tunable `--blocks-guide-scrim` token; the hole is an even-odd cut-out.
    scrim: ['fixed inset-0 h-full w-full'],
    bubble: [
      'z-[var(--z-guide)] m-0 w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-visible',
      'rounded-xl border border-border-hairline bg-surface-overlay p-4',
      'text-sm text-text-secondary shadow-[var(--blocks-shadow-lg)]',
      'focus-visible:outline-none'
    ],
    // Rotated square in the bubble colour (borderless, like GuideHint/Tooltip).
    arrow: ['absolute h-2.5 w-2.5 rotate-45 bg-surface-overlay'],
    title: ['mb-1 text-sm font-semibold text-text-primary'],
    body: ['leading-relaxed [&_:where(p)]:my-1 [&_:where(p)]:first:mt-0 [&_:where(p)]:last:mb-0'],
    progress: ['mt-3 flex items-center gap-2'],
    dots: ['flex items-center gap-1.5'],
    dot: ['h-1.5 w-1.5 rounded-full bg-border-strong/50 transition-all'],
    // Layered additively on the active dot (the component toggles it per step).
    dotActive: ['w-4 bg-primary'],
    stepText: ['text-xs text-text-tertiary tabular-nums'],
    footer: ['mt-4 flex items-center gap-2'],
    // Pushes the prev/next pair to the trailing edge, skip to the leading edge.
    spacer: ['flex-1']
  }
});

/**
 * Styling for `GuideBeacon` (Phase 6.3) — a waiting, pulsing hotspot that opens
 * an opt-in tour. A real `<button>` wrapping an animated `ping` ring and a solid
 * `dot`; the consumer positions it (inline, or absolutely over a feature corner).
 * The pulse is pure CSS and halts under `prefers-reduced-motion` (static dot).
 */
export const guideBeaconVariants = tv({
  slots: {
    beacon: [
      'relative inline-flex items-center justify-center rounded-full align-middle',
      'cursor-pointer',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/50'
    ],
    // Expanding/fading ring behind the dot (animation lives in the component <style>).
    ping: ['absolute inline-flex h-full w-full rounded-full bg-primary/70'],
    // Solid center dot.
    dot: ['relative inline-flex rounded-full bg-primary']
  },
  variants: {
    size: {
      sm: { beacon: 'h-2.5 w-2.5', dot: 'h-2.5 w-2.5' },
      md: { beacon: 'h-3.5 w-3.5', dot: 'h-3.5 w-3.5' }
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

export type GuidePanelVariants = VariantProps<typeof guidePanelVariants>;
export type GuideTourVariants = VariantProps<typeof guideTourVariants>;
export type GuideBeaconVariants = VariantProps<typeof guideBeaconVariants>;
export type GuideArticleVariants = VariantProps<typeof guideArticleVariants>;
export type GuideMarkerVariants = VariantProps<typeof guideMarkerVariants>;
export type GuideMentionVariants = VariantProps<typeof guideMentionVariants>;
export type GuideRefVariants = VariantProps<typeof guideRefVariants>;
export type GuideHintVariants = VariantProps<typeof guideHintVariants>;

/** Slot names derived from each `tv()` config — single source of truth for `slotClasses`. */
export type GuidePanelSlots = SlotNames<typeof guidePanelVariants>;
export type GuideTourSlots = SlotNames<typeof guideTourVariants>;
export type GuideBeaconSlots = SlotNames<typeof guideBeaconVariants>;
export type GuideArticleSlots = SlotNames<typeof guideArticleVariants>;
export type GuideMarkerSlots = SlotNames<typeof guideMarkerVariants>;
export type GuideMentionSlots = SlotNames<typeof guideMentionVariants>;
export type GuideRefSlots = SlotNames<typeof guideRefVariants>;
export type GuideHintSlots = SlotNames<typeof guideHintVariants>;
