/**
 * TABLE VARIANTS
 * Variant definitions for the table component (see docs/MIGRATION-v5.md §3
 * for the v4 → v5 appearance API).
 */

import { tv, type VariantProps } from '@urbicon-ui/blocks';
import { TABLE_DIMENSIONS, TABLE_INDICATORS, TABLE_STATES } from './table.system';

/**
 * TABLE HEADER VARIANTS
 */
export const tableHeaderVariants = tv({
  slots: {
    // No bg in base — the header reads via font-weight
    // + bottom-hairline on the parent table; sticky mode below adds a bg
    // so the header opaquely overlays scrolling rows.
    // compatibility: old code used `header` instead of `row`
    header: ['border-b border-border-hairline'],
    row: [],
    cell: [
      'font-semibold text-text-secondary uppercase ',
      'relative group',
      'transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--blocks-duration-fast)]'
    ],
    // compatibility: old code used `cellContent`
    cellContent: ['flex items-center justify-between gap-2'],
    content: ['flex items-center justify-between gap-2'],
    // compatibility: old code used `titleContainer` and `titleContent`
    titleContainer: ['flex items-center flex-1'],
    titleContent: ['flex items-center space-x-2'],
    title: ['flex items-center gap-2 flex-1'],
    sortIcon: ['text-text-tertiary', 'transition-transform duration-[var(--blocks-duration-fast)]'],
    indicators: ['flex items-center gap-1'],
    // compatibility: additional action indicators under header
    actionIndicators: [
      'absolute bottom-0 left-0 right-0 h-0.5 flex',
      'opacity-80 transition-opacity duration-[var(--blocks-duration-normal)] group-hover:opacity-100'
    ],
    actionIndicatorBar: [
      'flex-1 transition-[background-color,opacity] duration-[var(--blocks-duration-normal)]'
    ],
    menu: [
      'opacity-0 group-hover:opacity-100',
      'transition-opacity duration-[var(--blocks-duration-fast)]'
    ]
  },

  variants: {
    size: {
      sm: {
        cell: [TABLE_DIMENSIONS.padding.headerCell.sm, TABLE_DIMENSIONS.height.header.sm],
        title: 'text-xs'
      },
      md: {
        cell: [TABLE_DIMENSIONS.padding.headerCell.md, TABLE_DIMENSIONS.height.header.md],
        title: 'text-sm'
      },
      lg: {
        cell: [TABLE_DIMENSIONS.padding.headerCell.lg, TABLE_DIMENSIONS.height.header.lg],
        title: 'text-base'
      }
    },

    align: {
      left: {
        content: 'justify-start',
        title: 'justify-start'
      },
      center: {
        content: 'justify-center',
        title: 'justify-center'
      },
      right: {
        content: 'justify-end',
        title: 'justify-end flex-row-reverse'
      }
    },

    sortable: {
      true: {
        cell: 'cursor-pointer hover:bg-surface-hover',
        sortIcon: 'opacity-60'
      },
      false: {
        sortIcon: 'hidden'
      }
    },

    sorted: {
      none: {
        sortIcon: 'opacity-0'
      },
      asc: {
        cell: TABLE_STATES.cell.sorted,
        sortIcon: 'text-primary'
      },
      desc: {
        cell: TABLE_STATES.cell.sorted,
        sortIcon: 'text-primary'
      }
    },

    // Sticky thead — pins the entire `<thead>` against the page scroll
    // ancestor, offset by the toolbar height (if present).
    sticky: {
      true: {
        header: [
          'sticky z-20 bg-surface-elevated',
          'top-[calc(var(--blocks-table-sticky-top,0px)+var(--blocks-table-toolbar-h,0px))]',
          'data-[stuck=true]:shadow-[var(--blocks-shadow-md)]',
          'transition-shadow duration-[var(--blocks-duration-fast)]'
        ],
        row: 'bg-surface-elevated'
      },
      false: {}
    }
  },

  defaultVariants: {
    size: 'md',
    align: 'left',
    sortable: false,
    sorted: 'none',
    sticky: false
  }
});

/**
 * HEADER INDICATOR VARIANTS
 * Small dot indicators for filter/group/summary in header.
 */
export const headerIndicatorVariants = tv({
  base: [
    TABLE_INDICATORS.dot.base,
    'transition-transform duration-[var(--blocks-duration-fast)] ease-out'
  ],
  variants: {
    type: {
      filter: TABLE_INDICATORS.dot.intent.filter,
      group: TABLE_INDICATORS.dot.intent.group,
      summary: TABLE_INDICATORS.dot.intent.summary,
      primary: TABLE_INDICATORS.dot.intent.primary,
      success: TABLE_INDICATORS.dot.intent.success,
      warning: TABLE_INDICATORS.dot.intent.warning,
      danger: TABLE_INDICATORS.dot.intent.danger
    },
    size: {
      xs: TABLE_INDICATORS.dot.size.xs,
      sm: TABLE_INDICATORS.dot.size.sm,
      md: TABLE_INDICATORS.dot.size.md,
      lg: TABLE_INDICATORS.dot.size.lg
    },
    state: {
      default: 'opacity-80',
      hover: 'opacity-100 scale-110',
      active: 'opacity-100 scale-125'
    }
  },
  defaultVariants: {
    type: 'filter',
    size: 'sm',
    state: 'default'
  }
});

/**
 * TABLE ROW VARIANTS
 */
export const tableRowVariants = tv({
  slots: {
    // Row dividers use a hairline (~8% alpha) instead of border-subtle.
    // No explicit row bg — the surface tint is inherited from the
    // scrollArea, depending on the appearance (see below).
    row: [
      'border-b border-border-hairline',
      'last:border-b-0',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    cell: ['text-text-primary', 'transition-colors duration-[var(--blocks-duration-fast)]']
  },

  variants: {
    size: {
      sm: {
        row: TABLE_DIMENSIONS.height.row.sm,
        cell: TABLE_DIMENSIONS.padding.cell.sm
      },
      md: {
        row: TABLE_DIMENSIONS.height.row.md,
        cell: TABLE_DIMENSIONS.padding.cell.md
      },
      lg: {
        row: TABLE_DIMENSIONS.height.row.lg,
        cell: TABLE_DIMENSIONS.padding.cell.lg
      }
    },

    state: {
      default: {
        row: TABLE_STATES.row.hover
      },
      selected: {
        row: TABLE_STATES.row.selected
      },
      expanded: {
        row: TABLE_STATES.row.expanded
      },
      disabled: {
        row: TABLE_STATES.row.disabled
      }
    },

    interactive: {
      true: {
        row: 'cursor-pointer'
      },
      false: {}
    },

    striped: {
      // The striped alternating color is `surface-quiet` (the quietest
      // in-page tint), not `surface-subtle` (raised).
      even: {
        row: 'bg-surface-quiet'
      },
      odd: {}
    }
  },

  compoundVariants: [
    // Interactive + State combinations
    {
      interactive: true,
      state: 'default',
      class: {
        row: 'hover:shadow-[var(--blocks-shadow-sm)] active:scale-[0.995]'
      }
    }
  ],

  defaultVariants: {
    size: 'md',
    state: 'default',
    interactive: false
  }
});

/**
 * TABLE CELL VARIANTS
 */
export const tableCellVariants = tv({
  base: ['transition-colors duration-[var(--blocks-duration-fast)]'],

  variants: {
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right'
    },

    truncate: {
      true: 'truncate max-w-xs',
      false: ''
    },

    nowrap: {
      true: 'whitespace-nowrap',
      false: ''
    }
  },

  defaultVariants: {
    align: 'left',
    truncate: false,
    nowrap: false
  }
});

// Type exports
export type TableHeaderVariantProps = VariantProps<typeof tableHeaderVariants>;
export type TableRowVariantProps = VariantProps<typeof tableRowVariants>;
export type TableCellVariantProps = VariantProps<typeof tableCellVariants>;
export type HeaderIndicatorVariantProps = VariantProps<typeof headerIndicatorVariants>;

/**
 * TABLE CONTAINER VARIANTS
 *
 * Slot model (post-Sticky refactor):
 * - `container`: outer flex-column wrapper, holds toolbar + scrollArea
 * - `toolbar`: optional sticky toolbar layer (L1)
 * - `scrollArea`: visible frame (border, radius, shadow, bg). NEVER sets `overflow`,
 *   so `position: sticky` children pin against the page scroll ancestor instead
 *   of being trapped by an `overflow` clip
 * - `table`, `body`: rendered inside scrollArea
 *
 * Sticky-related properties consumed downstream:
 *   --blocks-table-sticky-top (consumer, default 0)
 *   --blocks-table-toolbar-h  (set internally via ResizeObserver)
 *   --blocks-table-thead-h    (set internally via ResizeObserver)
 *   --blocks-table-avail-top  (set internally; container's document-top offset,
 *                              consumed by the `contained` height cap)
 */
export const tableContainerVariants = tv({
  slots: {
    container: ['flex flex-col gap-2 w-full'],
    // The toolbar inherits the scrollArea bg instead of setting its own
    // surface-elevated — otherwise a flush table would show a visibly
    // separated toolbar strip.
    toolbar: ['transition-shadow duration-[var(--blocks-duration-fast)]'],
    scrollArea: [],
    table: ['w-full border-collapse'],
    body: []
  },
  // Variant contract (see docs/MIGRATION-v5.md §3):
  //   flush   → no frame, sits inline in the reading flow (Docs, Inline)
  //   surface → bg-surface-quiet, gentle in-page tinted zone
  //   framed  → border + rounded-contain + shadow, standalone block
  variants: {
    appearance: {
      flush: {
        scrollArea: []
      },
      surface: {
        scrollArea: ['bg-surface-quiet']
      },
      framed: {
        scrollArea: [
          'bg-surface-elevated border border-border-default',
          'rounded-contain shadow-[var(--blocks-shadow-sm)]'
        ]
      }
    },
    size: {
      sm: {
        container: 'gap-1',
        table: 'text-xs'
      },
      md: {
        container: 'gap-2',
        table: 'text-sm'
      },
      lg: {
        container: 'gap-3',
        table: 'text-base'
      }
    },
    responsive: {
      true: {
        table: 'min-w-[600px]'
      },
      false: {}
    },
    stickyToolbar: {
      true: {
        toolbar: [
          'sticky z-30 bg-surface-elevated',
          'top-[var(--blocks-table-sticky-top,0px)]',
          'data-[stuck=true]:shadow-[var(--blocks-shadow-md)]'
        ]
      },
      false: {}
    },
    // `fit="viewport"` — the table becomes its own scroll container so wide/long
    // lists scroll *within* the box (both axes) instead of pushing horizontal
    // overflow onto the page. The container is height-capped to the viewport
    // (minus its measured document-top offset in --blocks-table-avail-top), and
    // flexbox keeps the toolbar + pagination (shrink-0) outside the scrolling
    // `scrollArea`. The scrollArea is `flex-auto` (NOT `flex-1`/basis-0, which
    // would collapse the box for short tables) + `min-h-0` so only the rows
    // scroll. Desktop-only (md+); mobile keeps document-level scroll.
    contained: {
      true: {
        container: ['md:max-h-[calc(100dvh-var(--blocks-table-avail-top,0px))]'],
        scrollArea: ['md:min-h-0 md:flex-auto md:overflow-auto'],
        toolbar: ['md:shrink-0']
      },
      false: {}
    }
  },
  defaultVariants: {
    appearance: 'flush',
    size: 'md',
    responsive: true,
    stickyToolbar: false,
    contained: false
  }
});

export type TableContainerVariantProps = VariantProps<typeof tableContainerVariants>;
