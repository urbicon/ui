import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const journeyTimelineVariants = tv({
  slots: {
    // Root wrapper. Hosts the rail and — in panel mode — the shared readout.
    base: 'w-full',
    // The ordered list of nodes. `flex-col` vertical, `flex-row` horizontal.
    rail: 'flex list-none m-0 p-0',
    // A single node <li>. Vertical: grid of [meta?] [marker column] [content];
    // horizontal: flex row of trigger + connector group.
    node: 'group/node',
    // Chronicle-axis column (vertical): right-aligned, tabular — times, dates,
    // versions. Rendered only when any node provides `meta` (or a meta snippet).
    metaColumn: 'shrink-0 text-right',
    meta: [
      'font-mono tabular-nums leading-tight text-text-tertiary',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    // The spine: marker + connector line. Vertical: a narrow column the line
    // grows down inside; horizontal: a full-width row the line grows right in.
    markerColumn: 'flex items-center',
    // The status dot. Deliberately small — the line is the protagonist, the
    // dots are punctuation (contrast: Stepper's large glyph discs). The grid
    // centring only matters when a `marker` snippet puts a glyph inside.
    marker: [
      'box-border grid shrink-0 place-items-center rounded-commit border-2',
      'transition-[background-color,border-color,box-shadow] duration-[var(--blocks-duration-fast)]'
    ],
    // The connecting line. Drawn with borders so `connectorStyle` can switch
    // solid/dashed/dotted — the connector carries meaning, not just geometry.
    connector: [
      'border-border-default',
      'transition-[border-color] duration-[var(--blocks-duration-normal)]'
    ],
    // Content cell (vertical): card + segment label.
    content: 'min-w-0',
    // The focus surface around header + inline detail. Transparent at rest,
    // elevated card when focused inline, selected tint when focused in panel
    // mode — never a bare full-width grey block.
    card: [
      'rounded-contain border border-transparent',
      'transition-[background-color,border-color,box-shadow] duration-[var(--blocks-duration-normal)] ease-[var(--blocks-ease-gentle)]'
    ],
    // Header row: the trigger plus the optional trailing area. Keeping
    // `trailing` a *sibling* of the button (never a child) keeps interactive
    // trailing content valid HTML and off the activation target.
    header: 'flex',
    // The interactive header — title + subtitle. A <button> for focusable
    // nodes, a plain <div> for pure waypoints (focusable === false).
    trigger: [
      'flex appearance-none flex-col items-start gap-0.5 border-0 bg-transparent p-0 text-left',
      'rounded-contain',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base'
    ],
    // End-of-row content (badges, help, quick actions) beside the trigger.
    trailing: 'flex shrink-0 items-center gap-1',
    labelGroup: 'flex min-w-0 flex-col',
    title: [
      'font-medium leading-tight',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    subtitle: 'text-text-tertiary leading-tight mt-0.5',
    // Label for the stretch between two nodes (duration, transport, gap…).
    segment: 'text-text-quaternary leading-tight',
    // Grid-rows collapse wrapper (0fr → 1fr). Reduced-motion safe: the duration
    // token collapses to 1ms under prefers-reduced-motion (interaction.css).
    detail: [
      'grid',
      'transition-[grid-template-rows] duration-[var(--blocks-duration-normal)] ease-[var(--blocks-ease-smooth)]'
    ],
    detailInner: 'min-h-0 overflow-hidden',
    detailContent: 'text-text-secondary',
    // The stable readout (detail="panel" and every horizontal timeline).
    panel: [
      'text-text-secondary border border-border-default bg-surface-elevated rounded-contain',
      'shadow-[var(--blocks-shadow-md)]'
    ]
  },
  variants: {
    orientation: {
      vertical: {
        rail: 'flex-col',
        node: 'grid',
        markerColumn: 'flex-col',
        connector: 'my-1 w-0 min-h-3 flex-1 border-l-2',
        header: 'items-start gap-x-3',
        trigger: 'min-w-0 flex-1',
        trailing: 'ml-auto',
        segment: 'flex items-center'
      },
      horizontal: {
        // Column layout so the shared panel sits below the rail.
        base: 'flex flex-col',
        rail: 'flex-row items-start',
        // Stacked station: meta row above the spine, label pill below. Every
        // node but the last stretches so the spine distributes the stations.
        node: 'flex flex-col [&:not(:last-child)]:flex-1',
        // Visual order is meta → spine → header, but the DOM keeps the header
        // before the spine so a segment label is read *after* its node.
        metaColumn: 'order-1 text-left',
        markerColumn: 'order-2 w-full flex-row',
        header: 'order-3 items-center gap-x-1.5 self-start',
        // Shrink-to-fit pill around the labels only — the marker sits on the
        // spine above, so the whole rail reads as stations on one line.
        trigger: 'w-auto',
        connector: 'h-0 min-w-3 flex-1 border-t-2',
        // Segment labels sit *in* the line (line — label — line); they widen
        // the gap instead of overlapping the next station's marker.
        segment: 'shrink-0 whitespace-nowrap',
        panel: 'mt-4 w-full'
      }
    },
    size: {
      sm: {
        meta: 'text-[11px]',
        marker: 'size-2.5',
        node: 'gap-x-2.5',
        card: '-mx-1.5 px-1.5 py-1.5',
        title: 'text-xs',
        subtitle: 'text-[11px]',
        segment: 'text-[11px]',
        content: 'pb-4',
        detailContent: 'text-xs pt-2',
        panel: 'p-3 text-xs'
      },
      md: {
        meta: 'text-xs',
        marker: 'size-3',
        node: 'gap-x-3',
        card: '-mx-2 px-2 py-2',
        title: 'text-sm',
        subtitle: 'text-xs',
        segment: 'text-xs',
        content: 'pb-5',
        detailContent: 'text-sm pt-2.5',
        panel: 'p-4 text-sm'
      },
      lg: {
        meta: 'text-sm',
        marker: 'size-3.5',
        node: 'gap-x-3.5',
        card: '-mx-2.5 px-2.5 py-2.5',
        title: 'text-base',
        subtitle: 'text-sm',
        segment: 'text-sm',
        content: 'pb-6',
        detailContent: 'text-base pt-3',
        panel: 'p-5 text-base'
      }
    },
    // Marker colour + title tone per journey status. Mirrors the semantic intent
    // palette (success / primary / danger / neutral) used across Badge, Alert,
    // Progress and Stepper.
    status: {
      complete: {
        marker: 'bg-success border-success',
        title: 'text-text-primary'
      },
      active: {
        marker: 'bg-primary border-primary ring-4 ring-primary/15',
        title: 'text-text-primary'
      },
      pending: {
        marker: 'bg-surface-base border-border-strong',
        title: 'text-text-secondary'
      },
      // Worth a look, does not block — hollow like pending but on the warning
      // token, mirroring Stepper's per-step warning state.
      attention: {
        marker: 'bg-surface-base border-warning',
        title: 'text-warning-emphasis'
      },
      blocked: {
        marker: 'bg-danger border-danger',
        title: 'text-danger'
      },
      skipped: {
        marker: 'bg-surface-subtle border-border-subtle opacity-80',
        title: 'text-text-tertiary'
      }
    },
    // The currently focused node. Distinct from DOM focus (focus-visible ring).
    focused: {
      true: {
        meta: 'text-text-primary',
        title: 'font-semibold text-text-primary'
      },
      false: {}
    },
    // Focusable nodes react to hover + show a pointer; pure waypoints do not.
    interactive: {
      true: {
        trigger: 'cursor-pointer'
      },
      false: {
        trigger: 'cursor-default'
      }
    },
    // The connector leaving a completed node reads as "travelled".
    travelled: {
      true: {
        connector: 'border-success'
      },
      false: {}
    },
    // Per-node line style — solid ride, dashed/dotted transfer or gap.
    connectorStyle: {
      solid: { connector: 'border-solid' },
      dashed: { connector: 'border-dashed' },
      dotted: { connector: 'border-dotted' }
    },
    // Where the focused detail lives (vertical only; horizontal is always panel).
    detail: {
      inline: {},
      panel: {}
    },
    // Whether the chronicle axis (meta rail) is rendered — adds the grid column.
    withMeta: {
      true: { node: 'grid-cols-[auto_auto_minmax(0,1fr)]' },
      false: { node: 'grid-cols-[auto_minmax(0,1fr)]' }
    }
  },
  compoundVariants: [
    // Size geometry that only applies to one orientation. Vertical: fixed
    // meta/marker column widths + baseline offsets that align dot and title;
    // horizontal: spine gaps + the label pill's optical left edge (-mx
    // compensates px so title, marker and meta share one left line).
    {
      orientation: 'vertical',
      size: 'sm',
      class: {
        metaColumn: 'w-10 pt-1.5',
        markerColumn: 'w-3.5',
        marker: 'mt-2',
        segment: 'mt-1.5 gap-1'
      }
    },
    {
      orientation: 'vertical',
      size: 'md',
      class: {
        metaColumn: 'w-12 pt-2',
        markerColumn: 'w-4',
        marker: 'mt-2.5',
        segment: 'mt-2 gap-1.5'
      }
    },
    {
      orientation: 'vertical',
      size: 'lg',
      class: {
        metaColumn: 'w-14 pt-2.5',
        markerColumn: 'w-5',
        marker: 'mt-3',
        segment: 'mt-2.5 gap-2'
      }
    },
    // The fixed spine height keeps every marker on one line whether or not the
    // station's outgoing segment carries a (taller) text label. The metaColumn
    // min-height is the same guarantee for the chronicle row: it holds even
    // when a consumer `meta` snippet renders nothing for some stations.
    {
      orientation: 'horizontal',
      size: 'sm',
      class: {
        node: 'gap-y-0.5',
        metaColumn: 'min-h-3.5',
        markerColumn: 'h-4 gap-1 pr-1',
        trigger: '-ml-1.5 px-1.5 py-1'
      }
    },
    {
      orientation: 'horizontal',
      size: 'md',
      class: {
        node: 'gap-y-1',
        metaColumn: 'min-h-4',
        markerColumn: 'h-4 gap-1.5 pr-1.5',
        trigger: '-ml-2 px-2 py-1.5'
      }
    },
    {
      orientation: 'horizontal',
      size: 'lg',
      class: {
        node: 'gap-y-1',
        metaColumn: 'min-h-4.5',
        markerColumn: 'h-5 gap-2 pr-2',
        trigger: '-ml-2.5 px-2.5 py-2'
      }
    },
    // Vertical + panel: two-column layout on wide viewports; on narrow ones the
    // readout docks to the viewport bottom while the rail scrolls behind it.
    {
      orientation: 'vertical',
      detail: 'panel',
      class: {
        base: 'sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] sm:items-start sm:gap-x-6',
        panel:
          'max-sm:sticky max-sm:bottom-4 max-sm:z-[var(--z-docked)] max-sm:mt-4 sm:sticky sm:top-4'
      }
    },
    // Focused inline node: the elevated card — the focus IS a surface change,
    // not a grey backdrop.
    {
      detail: 'inline',
      focused: true,
      class: {
        card: 'border-border-default bg-surface-elevated shadow-[var(--blocks-shadow-md)]'
      }
    },
    // Focused row while the detail lives in the panel: quiet selected tint.
    {
      orientation: 'vertical',
      detail: 'panel',
      focused: true,
      class: {
        card: 'bg-surface-selected'
      }
    },
    { orientation: 'horizontal', focused: true, class: { trigger: 'bg-surface-selected' } },
    // Hover affordance only on non-focused interactive nodes (a focused inline
    // card must not flicker back to the hover tint).
    {
      orientation: 'vertical',
      interactive: true,
      focused: false,
      class: { card: 'hover:bg-surface-hover' }
    },
    {
      orientation: 'horizontal',
      interactive: true,
      focused: false,
      class: { trigger: 'hover:bg-surface-hover' }
    }
  ],
  defaultVariants: {
    orientation: 'vertical',
    size: 'md',
    status: 'pending',
    focused: false,
    interactive: true,
    travelled: false,
    connectorStyle: 'solid',
    detail: 'inline',
    withMeta: false
  }
});

export type JourneyTimelineVariants = VariantProps<typeof journeyTimelineVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type JourneyTimelineSlots = SlotNames<typeof journeyTimelineVariants>;
