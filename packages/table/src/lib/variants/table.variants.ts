/**
 * TABLE VARIANTS
 * Variant definitions for the table component (see the shipped variant contract,
 * packages/blocks/docs/VARIANT-CONTRACT.md § Table chrome, for what each value means).
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
    // No justify-between: the align axis (default left) always supplies
    // the justify-* for this slot.
    content: ['flex items-center gap-2'],
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

    sorted: {
      none: {
        sortIcon: 'opacity-0'
      },
      asc: {
        cell: TABLE_STATES.cell.sorted,
        sortIcon: 'text-primary-text'
      },
      desc: {
        cell: TABLE_STATES.cell.sorted,
        sortIcon: 'text-primary-text'
      }
    },

    // Declared AFTER `sorted`: the sortable affordance (60% icon) wins the
    // opacity bucket over sorted-none's opacity-0 — sortable columns keep
    // their always-visible sort hint.
    sortable: {
      true: {
        cell: 'cursor-pointer hover:bg-surface-hover',
        sortIcon: 'opacity-60'
      },
      false: {
        sortIcon: 'hidden'
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
    // scrollArea, depending on the variant (see below).
    row: [
      'border-b border-border-hairline',
      'last:border-b-0',
      // `scale`: the interactive row adds `active:scale-[0.995]`, a discrete
      // property `transition-colors` cannot animate.
      'transition-[color,background-color,border-color,scale] duration-[var(--blocks-duration-fast)]'
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

    striped: {
      // The striped alternating color is `surface-quiet` (the quietest
      // in-page tint), not `surface-subtle` (raised). Declared BEFORE
      // `state`: selection/expansion tints must win the bg bucket over the
      // zebra tint — an even selected row reads as selected, not striped.
      even: {
        row: 'bg-surface-quiet'
      },
      odd: {}
    },

    state: {
      default: {
        row: TABLE_STATES.row.hover
      },
      selected: {
        row: TABLE_STATES.row.selected
      },
      active: {
        row: TABLE_STATES.row.active
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
    // `@container` is what makes the desktop-table/mobile-record switch measure
    // the box the table actually got instead of the browser window. The two are
    // not the same question and used to be answered by `md:hidden` /
    // `max-md:hidden`, i.e. the viewport: a table in any column narrower than
    // 768px inside a wide window rendered its desktop layout and scrolled
    // sideways in place. The docs' own reading column (736px) hit exactly that.
    // A component that decides its layout from the viewport while living in a
    // capped container can always disagree with its box; reading the box is the
    // only version of this that cannot.
    //
    // Everything the table switches on now reads a box rather than the window —
    // the layout below, and the filter bar's stacked/row and capsule/sheet steps
    // (`@md` on the bar's own container). The ONE deliberate exception is
    // `contained` further down; its comment says why.
    //
    // The container belonged here all along: `style/index.css` declared
    // `container-type: inline-size` on a `.table-container` class that no
    // element ever carried, so the `@container` helper rules beside it queried
    // nothing. That dead block is gone with this.
    container: ['@container flex flex-col gap-2 w-full'],

    // ── The layout switch, both halves in one place ──────────────────────────
    //
    // `@3xl` is 48rem on the container declared above. The two lines are one
    // decision and have to stay each other's exact complement, so they are
    // written down together instead of being hand-typed into `TableDesktop` and
    // `TableMobile` — the failure mode of two copies is that BOTH layouts render
    // or NEITHER does, and nothing about either file would look wrong.
    // `table.variants.test.ts` pins that they name the same step with opposite
    // polarity.
    //
    // The classes must stay literal here: Tailwind finds class names by scanning
    // source text, so a `@${STEP}:hidden` built from a constant would compile to
    // no CSS at all — a "single source of truth" that silently renders both
    // layouts at once. One place, two literals, one test is the honest shape.
    //
    // The two roots also carry `data-table-layout="desktop" | "mobile"` — that
    // is the hook to query them by. It used to be a `desktop-only` /
    // `mobile-only` CLASS, which named no CSS anywhere in the repo; moving these
    // strings into a tv() config is what surfaced that, because `variants:lint`
    // compiles what a config declares and reports whatever emits no rule. A
    // marker is an attribute, not a class that pretends to style something.
    desktopOnly: ['@max-3xl:hidden'],
    mobileOnly: ['@3xl:hidden'],

    // The toolbar inherits the scrollArea bg instead of setting its own
    // surface-elevated — otherwise a flush table would show a visibly
    // separated toolbar strip.
    toolbar: ['transition-shadow duration-[var(--blocks-duration-fast)]'],
    scrollArea: [],
    table: ['w-full border-collapse'],
    body: []
  },
  // Variant contract (see packages/blocks/docs/VARIANT-CONTRACT.md § Table chrome):
  //   flush   → no frame, sits inline in the reading flow (Docs, Inline)
  //   surface → bg-surface-quiet, gentle in-page tinted zone
  //   framed  → border + rounded-contain + shadow, standalone block
  variants: {
    variant: {
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
    // scroll.
    //
    // ── The one switch here that is deliberately NOT container-keyed ─────────
    //
    // `md:` is the VIEWPORT, and on purpose: everything else the table switches
    // on asks "how much room did this box get", but this asks "would a nested
    // scroll box be the wrong thing here" — and on a phone it is, whatever the
    // box measures, because the reader would be dragging one scroller inside
    // another. A wide-window sidebar 400px across is a perfectly good scroll
    // box; a 400px phone is not, and only the viewport can tell those apart.
    //
    // Also note the cap has to live on the container slot, which IS the
    // `@container` — a container query cannot style its own container, so this
    // could not be `@3xl:` even if the question were the right one.
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
    variant: 'flush',
    size: 'md',
    responsive: true,
    stickyToolbar: false,
    contained: false
  }
});

export type TableContainerVariantProps = VariantProps<typeof tableContainerVariants>;
