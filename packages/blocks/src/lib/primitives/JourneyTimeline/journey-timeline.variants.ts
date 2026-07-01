import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const journeyTimelineVariants = tv({
  slots: {
    // Root wrapper. Always a <div> so the same element hosts the marker rail
    // AND (horizontal only) the shared detail panel beneath it. The last node's
    // connector is hidden in both orientations — nothing to connect onward to.
    base: 'w-full [&_[data-journey-node]:last-child_[data-journey-connector]]:hidden',
    // The ordered list of nodes. `flex-col` vertical, `flex-row` horizontal.
    rail: 'flex list-none m-0 p-0',
    // A single node <li>.
    node: 'group/node',
    // The interactive header — marker + title/subtitle. A <button> for focusable
    // nodes, a plain <div> for pure waypoints (focusable === false).
    trigger: [
      'flex items-center text-left w-full bg-transparent border-0 appearance-none p-1 -m-1',
      'rounded-contain',
      'transition-[color,background-color] duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base'
    ],
    // The status-coloured circle.
    marker: [
      'flex items-center justify-center shrink-0 font-semibold rounded-commit border-2 box-border',
      'transition-[color,background-color,border-color,box-shadow] duration-[var(--blocks-duration-fast)]'
    ],
    // Column (marker width) that carries the vertical connector below a marker.
    // `flex-col` is essential: it makes the connector's `flex-1` grow *down* the
    // column (a thin vertical line) instead of *across* it (a fat block).
    connectorColumn: 'flex flex-col shrink-0 items-center',
    // The connecting line between markers.
    connector: [
      'bg-border-subtle',
      'transition-[background-color] duration-[var(--blocks-duration-normal)]'
    ],
    // Title + subtitle wrapper.
    labelGroup: 'flex flex-col min-w-0',
    title: [
      'font-medium leading-tight truncate',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    subtitle: 'text-text-tertiary leading-tight mt-0.5 truncate',
    // Lower row (vertical only): connector column + inline detail region.
    body: 'flex',
    // Grid-rows collapse wrapper (0fr → 1fr). Reduced-motion safe: the duration
    // token collapses to 1ms under prefers-reduced-motion (interaction.css).
    detail: [
      'grid',
      'transition-[grid-template-rows] duration-[var(--blocks-duration-normal)] ease-[var(--blocks-ease-smooth)]'
    ],
    detailInner: 'overflow-hidden min-h-0',
    detailContent: 'text-text-secondary',
    // Shared detail panel (horizontal only) rendered beneath the rail.
    panel: 'text-text-secondary border border-border-subtle rounded-contain bg-surface-quiet'
  },
  variants: {
    orientation: {
      vertical: {
        rail: 'flex-col'
      },
      horizontal: {
        // Column layout so the shared detail panel sits below the rail.
        base: 'flex flex-col',
        rail: 'flex-row items-start',
        // Each node grows to spread markers evenly; the last one hugs its content.
        node: 'flex items-center [&:not(:last-child)]:flex-1',
        // Compact header (marker + label side by side) so the connector can grow.
        trigger: 'w-auto shrink-0'
      }
    },
    size: {
      sm: {
        marker: 'size-7 text-xs',
        connectorColumn: 'w-7',
        trigger: 'gap-2',
        title: 'text-xs',
        subtitle: 'text-[11px]',
        detailContent: 'text-sm pl-2'
      },
      md: {
        marker: 'size-9 text-sm',
        connectorColumn: 'w-9',
        trigger: 'gap-2.5',
        title: 'text-sm',
        subtitle: 'text-xs',
        detailContent: 'text-sm pl-2.5'
      },
      lg: {
        marker: 'size-11 text-base',
        connectorColumn: 'w-11',
        trigger: 'gap-3',
        title: 'text-base',
        subtitle: 'text-sm',
        detailContent: 'text-base pl-3'
      }
    },
    // Marker colour + title tone per journey status. Mirrors the semantic intent
    // palette (success / primary / danger / neutral) used across Badge, Alert,
    // Progress and Stepper.
    status: {
      complete: {
        marker: 'border-success bg-success text-text-on-primary'
      },
      active: {
        marker: 'border-primary bg-primary text-text-on-primary shadow-[var(--blocks-shadow-sm)]',
        title: 'text-text-primary'
      },
      pending: {
        marker: 'border-border-default bg-surface-base text-text-tertiary'
      },
      blocked: {
        marker: 'border-danger bg-danger text-text-on-primary',
        title: 'text-danger'
      },
      skipped: {
        marker: 'border-border-subtle bg-surface-subtle text-text-tertiary opacity-70',
        title: 'text-text-tertiary'
      }
    },
    // The currently expanded node. Distinct from DOM focus (focus-visible ring).
    focused: {
      true: {
        trigger: 'bg-surface-subtle',
        title: 'text-text-primary font-semibold'
      },
      false: {}
    },
    // Focusable nodes react to hover + show a pointer; pure waypoints do not.
    interactive: {
      true: {
        trigger: 'cursor-pointer hover:bg-surface-hover'
      },
      false: {
        trigger: 'cursor-default'
      }
    },
    // The connector segment leading out of a completed node reads as "travelled".
    connectorComplete: {
      true: {
        connector: 'bg-success'
      },
      false: {}
    }
  },
  compoundVariants: [
    // Vertical connector geometry: a thin line that grows down the marker column.
    {
      orientation: 'vertical',
      class: {
        connector: 'w-0.5 flex-1 my-1 min-h-4 rounded-commit'
      }
    },
    // Horizontal connector geometry: a thin line filling the gap to the next marker.
    {
      orientation: 'horizontal',
      class: {
        connector: 'h-0.5 flex-1 mx-2 self-center rounded-commit'
      }
    },
    // A focused pure waypoint keeps a bold title but gains no hover surface.
    {
      interactive: false,
      focused: true,
      class: {
        trigger: 'bg-transparent'
      }
    }
  ],
  defaultVariants: {
    orientation: 'vertical',
    size: 'md',
    status: 'pending',
    focused: false,
    interactive: true,
    connectorComplete: false
  }
});

export type JourneyTimelineVariants = VariantProps<typeof journeyTimelineVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type JourneyTimelineSlots = SlotNames<typeof journeyTimelineVariants>;
