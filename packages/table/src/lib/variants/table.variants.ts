/**
 * TABLE VARIANTS
 * Variant definitions for the table component (see the shipped variant contract,
 * packages/blocks/docs/VARIANT-CONTRACT.md § Table chrome, for what each value means).
 */

import { tv, type VariantProps } from '@urbicon-ui/blocks';
import { TABLE_DIMENSIONS, TABLE_INDICATORS, TABLE_STATES } from './table.system';

/**
 * TABLE HEADER VARIANTS
 *
 * **No `align` axis, on purpose.** A header does not follow its column's
 * alignment: a right-aligned number column carries a left-aligned title.
 *
 * Whether it *should* is an open design question, not a settled one — a steady
 * left-aligned header row reads more calmly, while typographic practice for
 * numeric columns is the opposite, and the field is split (MUI exposes a
 * separate `headerAlign`; AG Grid leaves the header alone; Ant Design couples
 * them). If it is ever wanted here, an opt-in `headerAlign` on the column is
 * the shape to reach for, not a silent coupling to `align`.
 *
 * There was an axis, and it never moved a pixel — it wrote `justify-*` onto the
 * box holding the title text, which is exactly as wide as that text. Four
 * attempts at repairing it (2026-08-14) each uncovered another layer, because
 * the header and the body cell are two separately grown chains:
 *
 *   - the cell puts its content in a container with its own horizontal padding;
 *     the header has no counterpart, so titles sit 8px (at `md`) inside their
 *     own column's text at every alignment;
 *   - the header carries chrome the cell does not — a menu button that held
 *     40px of every cell in the flow and painted over the title out of it, a
 *     sort chevron, indicator dots — and each of them shifts the title;
 *   - the two padding scales live in different files as independent literals,
 *     so any fix that matches them by hand is a second copy that can drift
 *     (and did, immediately, for snippet cells and at `size="lg"`).
 *
 * The first of those is worth separating out: it is not about alignment at all.
 * A left-aligned header title already starts 8px inside its own column's text,
 * in every table, because only the cell has that inner step. That one is a
 * plain defect whoever decides the alignment question.
 *
 * Making alignment work would mean deriving one inner measure for both chains
 * and giving the header chrome a place that does not move the text. That is a
 * layout change with its own wave, not a variant value — so the axis is gone
 * rather than sitting here looking available.
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
    // compatibility: old code used `titleContainer` and `titleContent`
    // Focusable when the column sorts or reorders (TableHead sets tabindex),
    // and until 2026-08-14 the only focus mark was the UA outline — which
    // Safari draws torn on these flex boxes. Same ring the mobile card's
    // headline button carries.
    titleContainer: [
      'flex items-center flex-1',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 rounded-modify'
    ],
    titleContent: ['flex items-center space-x-2'],
    // No `flex-1` here: `titleContent` around it is content-width, so there is
    // never a spare pixel for this box to grow into. It was the reason the
    // align axis looked plausible while doing nothing.
    title: ['flex items-center gap-2'],
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
      'transition-[color,background-color,border-color,scale] duration-[var(--blocks-duration-fast)]',
      // Rows carry roving tabindex when interactive, and the UA outline was the
      // only focus mark — on a `<tr>` under border-collapse Safari renders it
      // as two detached blue strokes. An INSET ring, because a `<tr>` clips
      // nothing outside its box; box-shadow layers, so the active row's rail
      // (also an inset shadow) and this ring coexist.
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50'
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

/**
 * ── Where the table stops being a grid and becomes a list of records ─────────
 *
 * The widths the switch offers.
 *
 * The step is a property of the COLUMNS, not of the component: a four-column
 * index fits in 29rem, a twelve-column report does not fit in 60. One constant
 * cannot serve both, and until this axis existed there was only one — 48rem,
 * carried over unchanged from the viewport era (`md:hidden`), where it meant
 * "is this a phone". Read against a box it means something else entirely, and
 * the landing page's own 32rem inventory column was rendering cards while its
 * four columns had room to spare.
 *
 * Spelled out rather than derived from the map (`keyof typeof …`), because this
 * name is what a reader meets: it is the type of `TableProps.cardsBelow`, so
 * docs-gen prints it on the component page, in `llms-full.txt` and in the MCP
 * catalog. Derived, all three showed `keyof typeof CARDS_BELOW_STEPS` pointing
 * at a module-private const — a type resolving to nothing anyone can read, and
 * no way left to discover the seven values.
 */
export type CardsBelowStep = '24rem' | '28rem' | '32rem' | '36rem' | '42rem' | '48rem' | '56rem';

/**
 * The classes each step compiles to.
 *
 * Typed as a `Record` of {@link CardsBelowStep}, so the union above is the
 * source and this map cannot drift from it: a width added to the type without
 * classes fails to compile, and classes without a width in the type are an
 * excess-property error. `Table.svelte` validates incoming values against
 * `CARDS_BELOW_VALUES`, read off this map — so the accepted values, the
 * compiled classes and the type are one decision in three places that the
 * compiler keeps agreeing.
 *
 * Each step carries the two complementary halves of one switch, and they have
 * to stay each other's exact complement — the failure mode of two copies is
 * that BOTH layouts render or NEITHER does, and nothing about either file would
 * look wrong. Measured (Tailwind 4.3.3): `@max-[28rem]` is `(width < 28rem)`
 * and `@min-[28rem]` is `(width >= 28rem)`, so the halves meet exactly, with no
 * width belonging to both or to neither.
 *
 * The classes must stay literal: Tailwind finds class names by scanning source
 * text, so `@max-[${step}]:hidden` built from a constant would compile to no
 * CSS at all — a "single source of truth" that silently renders both layouts at
 * once.
 *
 * There used to be a third literal per step — a `min-w` on the table, one step
 * lower, meant to stop the grid being squeezed to mush. It could never fire:
 * the grid only renders at or above its own step, so the container is already
 * wider than a floor set below it. Removed rather than kept as decoration.
 */
const CARDS_BELOW_STEPS: Record<CardsBelowStep, { desktopOnly: string; mobileOnly: string }> = {
  '24rem': { desktopOnly: '@max-[24rem]:hidden', mobileOnly: '@min-[24rem]:hidden' },
  '28rem': { desktopOnly: '@max-[28rem]:hidden', mobileOnly: '@min-[28rem]:hidden' },
  '32rem': { desktopOnly: '@max-[32rem]:hidden', mobileOnly: '@min-[32rem]:hidden' },
  '36rem': { desktopOnly: '@max-[36rem]:hidden', mobileOnly: '@min-[36rem]:hidden' },
  '42rem': { desktopOnly: '@max-[42rem]:hidden', mobileOnly: '@min-[42rem]:hidden' },
  '48rem': { desktopOnly: '@max-[48rem]:hidden', mobileOnly: '@min-[48rem]:hidden' },
  '56rem': { desktopOnly: '@max-[56rem]:hidden', mobileOnly: '@min-[56rem]:hidden' }
};

/**
 * The same widths at runtime. `Table.svelte` reads this to reject a step it has
 * no classes for: `tv()` skips a variant value it does not recognise, which
 * would leave both halves of the switch empty and render the grid and the card
 * list at the same time. TypeScript cannot catch a value arriving from plain
 * JavaScript, a config object or a CMS field.
 */
export const CARDS_BELOW_VALUES = Object.keys(CARDS_BELOW_STEPS) as CardsBelowStep[];

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

    // ── The layout switch ────────────────────────────────────────────────────
    //
    // Which step the switch happens at is the `cardsBelow` axis, whose steps
    // live in `CARDS_BELOW_STEPS` above — both halves of each side by side.
    // These two slots are empty here so that no step has a second home.
    //
    // Empty is also why the value is validated before it reaches `tv()`: an
    // unrecognised step leaves both of these at `[]`, and empty complements
    // hide nothing, so the grid and the card list render at once.
    // `table.variants.test.ts` pins the complement for every step.
    //
    // The two roots also carry `data-table-layout="desktop" | "mobile"` — that
    // is the hook to query them by. It used to be a `desktop-only` /
    // `mobile-only` CLASS, which named no CSS anywhere in the repo; moving these
    // strings into a tv() config is what surfaced that, because `variants:lint`
    // compiles what a config declares and reports whatever emits no rule. A
    // marker is an attribute, not a class that pretends to style something.
    desktopOnly: [],
    mobileOnly: [],

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
    // ── Where the table stops being a grid and becomes a list of records ─────
    //
    // The step is a property of the COLUMNS, not of the component: a four-column
    // index fits in 29rem, a twelve-column report does not fit in 60. One
    // constant cannot serve both, and until this axis existed there was only
    // one — 48rem, carried over unchanged from the viewport era (`md:hidden`),
    // where it meant "is this a phone". Read against a box it means something
    // else entirely, and the landing page's own 32rem inventory column was
    // rendering cards while its four columns had room to spare.
    //
    cardsBelow: CARDS_BELOW_STEPS,
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
    cardsBelow: '48rem',
    stickyToolbar: false,
    contained: false
  }
});

export type TableContainerVariantProps = VariantProps<typeof tableContainerVariants>;
