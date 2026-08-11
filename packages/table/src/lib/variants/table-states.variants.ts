/**
 * TABLE STATE VARIANTS
 * Variants for different table states.
 */

import { tv, type VariantProps } from '@urbicon-ui/blocks';
import { TABLE_ANIMATIONS, TABLE_BORDERS, TABLE_DIMENSIONS } from './table.system';

/**
 * EMPTY STATE VARIANTS
 */
export const emptyStateVariants = tv({
  slots: {
    container: ['flex flex-col items-center justify-center', 'text-center'],
    icon: [
      'text-text-tertiary opacity-50',
      'transition-opacity duration-[var(--blocks-duration-fast)]'
    ],
    iconSvg: ['stroke-[1.5]'],
    content: ['flex flex-col items-center gap-3'],
    title: ['font-semibold text-text-primary', 'leading-tight'],
    description: ['text-text-secondary', 'leading-relaxed max-w-md'],
    action: [
      'inline-flex items-center gap-2',
      'px-4 py-2.5',
      'bg-primary text-white',
      'rounded-commit font-medium',
      // `translate`, NOT `transform`: Tailwind 4 emits `-translate-y-*` as the
      // discrete CSS `translate:` property, so the hover lift below only
      // animates if the list names `translate`.
      'transition-[color,background-color,border-color,box-shadow,opacity,translate] duration-[var(--blocks-duration-fast)]',
      'hover:bg-primary-hover hover:-translate-y-0.5',
      'active:translate-y-0',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
    ]
  },

  variants: {
    size: {
      sm: {
        container: 'py-8 gap-4',
        iconSvg: 'w-10 h-10',
        title: 'text-base',
        description: 'text-xs'
      },
      md: {
        container: 'py-12 gap-6',
        iconSvg: 'w-12 h-12',
        title: 'text-lg',
        description: 'text-sm'
      },
      lg: {
        container: 'py-16 gap-8',
        iconSvg: 'w-16 h-16',
        title: 'text-xl',
        description: 'text-base'
      }
    },

    variant: {
      default: {
        icon: 'text-text-tertiary'
      },
      search: {
        icon: 'text-primary-text'
      },
      filter: {
        icon: 'text-filter'
      },
      error: {
        icon: 'text-danger-text'
      }
    },

    bordered: {
      true: {
        container: ['border-2 border-dashed border-border-subtle', 'rounded-contain']
      },
      false: {}
    }
  },

  defaultVariants: {
    size: 'md',
    variant: 'default',
    bordered: false
  }
});

/**
 * LOADING STATE VARIANTS
 */
export const loadingStateVariants = tv({
  slots: {
    container: ['flex flex-col items-center justify-center', 'text-center'],
    spinner: ['text-primary'],
    spinnerSvg: [TABLE_ANIMATIONS.loading.spin],
    content: ['flex flex-col items-center gap-2'],
    text: ['font-medium text-text-primary', 'leading-tight'],
    description: ['text-text-secondary', 'leading-relaxed'],
    skeleton: [TABLE_ANIMATIONS.loading.skeleton, 'rounded-modify']
  },

  variants: {
    size: {
      sm: {
        container: 'py-8 gap-3',
        spinnerSvg: 'w-8 h-8',
        text: 'text-sm',
        description: 'text-xs'
      },
      md: {
        container: 'py-12 gap-4',
        spinnerSvg: 'w-10 h-10',
        text: 'text-base',
        description: 'text-sm'
      },
      lg: {
        container: 'py-16 gap-6',
        spinnerSvg: 'w-12 h-12',
        text: 'text-lg',
        description: 'text-base'
      }
    },

    variant: {
      spinner: {},
      skeleton: {},
      dots: {},
      progress: {}
    }
  },

  defaultVariants: {
    size: 'md',
    variant: 'spinner'
  }
});

/**
 * ERROR STATE VARIANTS
 * Error states during data loading.
 */
export const errorStateVariants = tv({
  slots: {
    container: ['flex flex-col items-center justify-center', 'text-center'],
    icon: ['text-danger-text'],
    iconSvg: ['stroke-[1.5]'],
    content: ['flex flex-col items-center gap-4 w-full'],
    title: ['font-semibold text-text-primary', 'leading-tight'],
    message: ['text-text-secondary', 'leading-relaxed max-w-md'],
    details: ['w-full max-w-md'],
    detailsToggle: [
      'inline-flex items-center gap-1',
      'px-2 py-1',
      'text-xs font-medium text-text-secondary',
      'rounded-modify border border-border-subtle',
      'cursor-pointer transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--blocks-duration-fast)]',
      'hover:bg-surface-hover hover:text-text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
    ],
    detailsIcon: ['transition-transform duration-[var(--blocks-duration-fast)]'],
    detailsContent: [
      'mt-3 p-3',
      'bg-surface-subtle',
      'border border-border-subtle',
      'rounded-contain text-left'
    ],
    detailsText: ['text-xs text-text-secondary font-mono', 'whitespace-pre-wrap break-words'],
    retryButton: [
      'inline-flex items-center gap-2',
      'px-4 py-2.5',
      'bg-primary text-white',
      'rounded-commit font-medium',
      // `translate`, NOT `transform` — same discrete-property rule as the empty
      // state's action button above; a `transform` entry never animated the lift.
      'transition-[color,background-color,border-color,box-shadow,opacity,translate] duration-[var(--blocks-duration-fast)]',
      'hover:bg-primary-hover hover:-translate-y-0.5',
      'active:translate-y-0',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
    ],
    retryIcon: ['w-4 h-4', 'stroke-current']
  },

  variants: {
    size: {
      sm: {
        container: 'py-8 gap-4',
        iconSvg: 'w-10 h-10',
        title: 'text-base',
        message: 'text-xs'
      },
      md: {
        container: 'py-12 gap-6',
        iconSvg: 'w-12 h-12',
        title: 'text-lg',
        message: 'text-sm'
      },
      lg: {
        container: 'py-16 gap-8',
        iconSvg: 'w-16 h-16',
        title: 'text-xl',
        message: 'text-base'
      }
    },

    severity: {
      error: {
        icon: 'text-danger-text',
        retryButton: 'bg-danger hover:bg-danger-hover'
      },
      warning: {
        icon: 'text-warning-emphasis',
        retryButton: 'bg-warning text-text-on-warning hover:bg-warning-hover'
      },
      info: {
        icon: 'text-primary-text',
        retryButton: 'bg-primary hover:bg-primary-hover'
      }
    },

    detailsExpanded: {
      true: {
        detailsIcon: 'rotate-180'
      },
      false: {}
    }
  },

  defaultVariants: {
    size: 'md',
    severity: 'error',
    detailsExpanded: false
  }
});

/**
 * SKELETON LOADER VARIANTS
 * Skeleton loading for table rows.
 */
export const skeletonRowVariants = tv({
  slots: {
    row: ['animate-pulse'],
    cell: [],
    skeleton: ['h-4 bg-surface-subtle rounded-modify', TABLE_ANIMATIONS.loading.skeleton]
  },

  variants: {
    size: {
      sm: {
        cell: TABLE_DIMENSIONS.padding.cell.sm,
        skeleton: 'h-3'
      },
      md: {
        cell: TABLE_DIMENSIONS.padding.cell.md,
        skeleton: 'h-4'
      },
      lg: {
        cell: TABLE_DIMENSIONS.padding.cell.lg,
        skeleton: 'h-5'
      }
    },

    width: {
      full: {
        skeleton: 'w-full'
      },
      '3/4': {
        skeleton: 'w-3/4'
      },
      '1/2': {
        skeleton: 'w-1/2'
      },
      '1/3': {
        skeleton: 'w-1/3'
      },
      '1/4': {
        skeleton: 'w-1/4'
      }
    }
  },

  defaultVariants: {
    size: 'md',
    width: '3/4'
  }
});

/**
 * MOBILE CARD VARIANTS
 * One record of the mobile list — the stacked form of a table row.
 *
 * A record, not a box. Until 2026-08-07 each one carried its own frame
 * (`border-border-subtle` + `rounded-contain` + `mb-3` + a hover shadow), so a
 * phone showed a stack of outlined panels inside whatever surface the table
 * already had — and it drew that outline from the FORM family, which the
 * variant contract (§7) reserves for input affordances; container surfaces take
 * `border-hairline`.
 *
 * The frame and the surface now belong to the list instead: `TableMobile`
 * applies the table's own `scrollArea` slot, so `variant` (flush / surface /
 * framed) finally reaches mobile — it used to be desktop-only, i.e. a documented
 * prop with no mobile effect at all. What is left per record is a hairline to
 * the next one, drawn exactly the way `tableRowVariants` draws it between two
 * desktop rows.
 *
 * Consequently no state may reach for a border colour or a shadow to mark
 * itself: `selected` and `active` tint the ground and add the same 2px inset
 * rail the desktop row uses (see TABLE_STATES.row.active).
 */
export const mobileCardVariants = tv({
  slots: {
    card: [
      // Same separator idiom as `tableRowVariants.row` — carried by the record
      // rather than by a `divide-y` on the list, because the last record is not
      // always the list's last child (a group summary can follow it) and only
      // the record itself knows it is the one closing the list.
      'border-b border-border-hairline last:border-b-0',
      'transition-[color,background-color,box-shadow] duration-[var(--blocks-duration-fast)]'
    ],
    // Title region — the primary identifier, emphasized and label-less. Lays out
    // the optional selection checkbox and the detail toggle next to the title,
    // and carries the record's hover ground (see the compound below).
    header: [
      'flex items-center gap-3',
      'px-4 pt-3 pb-1',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    // Title + subtitle share one shrinking column between checkbox and chevron.
    headline: ['min-w-0 flex-1 text-left'],
    // The headline as a control (row click, or opening the card's own details).
    // Touch-sized and full-width: on a phone this IS the card's tap area.
    headlineButton: [
      'flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left',
      'rounded-modify focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
    ],
    title: ['text-base font-semibold text-text-primary leading-snug break-words'],
    // The second card column, label-less, directly under the title: enough to
    // tell two records apart without opening either. Everything from the third
    // column on lives in the collapsed detail grid.
    subtitle: ['text-sm text-text-secondary leading-snug break-words'],
    // Own toggle button — used whenever the card itself already has a job
    // (selection checkbox or row click), so it cannot be one big button.
    toggle: [
      'flex h-11 w-11 shrink-0 items-center justify-center rounded-modify',
      'hover:bg-surface-hover transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    content: ['px-4 pb-3 pt-2'],
    // Detail fields in a compact 2-column grid (was a tall single-column stack,
    // which made a 4-field card ~266px tall — only ~2 fit per phone screen).
    grid: ['grid grid-cols-2 gap-x-4 gap-y-3'],
    field: ['flex flex-col gap-0.5 min-w-0'],
    label: ['text-xs font-medium text-text-tertiary', 'uppercase tracking-wide'],
    // Wrap instead of truncate — a full-width card has room, and truncation
    // hides data with no tooltip on touch.
    value: ['text-sm text-text-primary break-words'],
    // Tertiary, like the desktop group header's chevron: the affordance has to
    // be findable without competing with the record's own title.
    expandIcon: ['text-text-tertiary transition-transform duration-[var(--blocks-duration-fast)]'],
    // Hairline, not `border-subtle`: this rule sits INSIDE a record, so it must
    // read lighter than the hairline separating two records, never heavier.
    expandedContent: ['px-4 pb-3', 'border-t border-border-hairline pt-3']
  },

  variants: {
    size: {
      sm: {
        header: 'px-3 pt-2.5 pb-1',
        content: 'px-3 pb-2.5 pt-1.5',
        expandedContent: 'px-3 pb-2.5 pt-2.5',
        grid: 'gap-x-3 gap-y-2',
        title: 'text-sm',
        subtitle: 'text-xs'
      },
      md: {
        header: 'px-4 pt-3 pb-1',
        content: 'px-4 pb-3 pt-2',
        expandedContent: 'px-4 pb-3 pt-3',
        grid: 'gap-x-4 gap-y-3'
      },
      lg: {
        header: 'px-5 pt-4 pb-1.5',
        content: 'px-5 pb-4 pt-2.5',
        expandedContent: 'px-5 pb-4 pt-4',
        grid: 'gap-x-5 gap-y-4',
        title: 'text-lg',
        subtitle: 'text-base'
      }
    },

    /**
     * A collapsed card carries its whole story in the header, so the header's
     * bottom padding has to match its top one — the open card's tight `pb-1`
     * exists only to close the gap to the detail grid below it. The concrete
     * value is per size, so it lives in compoundVariants (same reason as the
     * Toggle's thumb travel: the size stage runs first and would otherwise win).
     */
    collapsed: {
      true: {},
      false: {}
    },

    /**
     * Ground plus a 2px inset rail — the same pair the desktop row uses, now for
     * the same reason on both sides: a record in a seamless list has no border
     * of its own to recolour, and a ground alone would be indistinguishable from
     * the hovered record right above it.
     */
    selected: {
      true: {
        card: 'bg-primary-subtle shadow-[inset_2px_0_0_0_var(--color-primary)]'
      },
      false: {}
    },

    /**
     * The record being shown elsewhere (master/detail). A step below `selected`,
     * which keeps the accent because it carries consequences; the compound below
     * drops this whenever both are set. Identical to TABLE_STATES.row.active —
     * the neutral rail says "this is the one you are reading", the accent rail
     * says "this one is picked".
     */
    active: {
      true: {
        card: 'bg-surface-hover shadow-[inset_2px_0_0_0_var(--color-border-strong)]'
      },
      false: {}
    },

    // `cursor-pointer` stays off the record: the record is not a control (see
    // mobile-card-shape.ts), and a record-wide pointer on a surface where only
    // the headline responds promises a click the detail grid never delivers.
    // The press ground rides the headline for a second reason — iOS Safari fires
    // `:active` on a real control, not on an arbitrary `<div>`.
    interactive: {
      true: {
        headlineButton: 'cursor-pointer active:bg-surface-active'
      },
      false: {}
    },

    // The rotated chevron and the revealed content are the whole signal. The
    // open record used to add `shadow-md`, which only ever read as "this box
    // floats higher" — there is no box left to float.
    expanded: {
      true: {
        expandIcon: 'rotate-180'
      },
      false: {}
    }
  },

  compoundVariants: [
    // Both at once: selection owns the look, so the active ground does not
    // fight the accent. Two backgrounds on one record would resolve by order,
    // not by meaning.
    {
      selected: true,
      active: true,
      class: { card: 'bg-primary-subtle shadow-[inset_2px_0_0_0_var(--color-primary)]' }
    },

    // Hover tints the header strip — the full width of it, checkbox and chevron
    // included, so it reads as "this record", not as a highlighted button. It
    // deliberately stops where the detail grid starts: on an open record the
    // whole card is several hundred pixels of consumer markup, and tinting all
    // of it both drowns the page and promises a click the grid never delivers.
    // Restricted to the plain record, like the desktop row's `state: 'default'`
    // — a hover tint over a selected record repaints the very ground that says
    // "selected".
    {
      interactive: true,
      selected: false,
      active: false,
      class: { header: 'hover:bg-surface-hover' }
    },

    // ── Closed record: symmetric header padding per size ──
    { collapsed: true, size: 'sm', class: { header: 'pb-2.5' } },
    { collapsed: true, size: 'md', class: { header: 'pb-3' } },
    { collapsed: true, size: 'lg', class: { header: 'pb-4' } }
  ],

  defaultVariants: {
    size: 'md',
    selected: false,
    active: false,
    interactive: false,
    expanded: false,
    collapsed: false
  }
});

/**
 * MOBILE LIST VARIANTS
 * The chrome AROUND the mobile records — group headers, the totals band and the
 * three data states.
 *
 * It exists because those three were hand-written Tailwind strings in
 * `TableMobile.svelte`, and two of them were the same bordered box the records
 * have now shed: `bg-surface-elevated border border-border-subtle
 * rounded-contain p-4`, floated on `mt-3`. Inside a seamless list a boxed total
 * is the one thing left that still reads as a panel.
 *
 * The totals band is the mobile phrasing of `summaryRowVariants` in its
 * `highlighted` default: a 2px summary rule on the side that separates it, an
 * uppercase label, a tabular value — same table, one vocabulary.
 *
 * The group header cannot be phrased that way. What tells the desktop group row
 * apart from a data row is its chevron and its indent, and the mobile list has
 * neither; a mobile header borrowing the desktop's `font-medium` title read as
 * one more record with a bold name and no subtitle. It takes the vocabulary of
 * the list it lives in instead — uppercase micro-type, the same register as the
 * detail grid's field labels — which is what separates chrome from content on
 * this side, in every `variant`, without a tint that only works over one ground.
 */
export const mobileListVariants = tv({
  slots: {
    // The rule between two groups rides the GROUP, not the record above it: a
    // record ends its group, so `last:border-b-0` has already dropped its own
    // separator by the time the next header follows.
    group: ['not-first:border-t not-first:border-border-hairline'],
    // No bottom rule — the header belongs to the records under it, and the
    // group's top rule is already the boundary between two sections.
    groupHeader: ['flex items-baseline gap-1.5 flex-wrap', 'px-4 pt-4 pb-1.5'],
    groupTitle: ['text-xs font-semibold uppercase tracking-wide text-text-secondary'],
    groupCount: ['text-text-tertiary text-xs font-normal'],
    // `border-t-2` in the summary accent, exactly like the desktop `<tfoot>`
    // row: the band is separated from the records by a rule, never framed.
    summary: ['px-4 py-3', 'bg-summary-subtle', 'border-t-2', TABLE_BORDERS.color.summary],
    summaryTitle: ['text-text-secondary text-xs uppercase tracking-wide', 'mb-2'],
    summaryRow: ['flex min-h-8 items-center justify-between gap-4'],
    summaryLabel: ['text-text-secondary min-w-0 text-sm'],
    summaryValue: ['text-summary font-mono font-semibold tabular-nums'],
    // Loading / error / empty. Mobile renders all three as plain text — the
    // three snippets are table-row markup and cannot land here (see TableMobile).
    state: ['px-4 py-8 text-center text-sm'],
    stateDetail: ['text-text-secondary mt-1 block']
  },

  variants: {
    size: {
      sm: {
        groupHeader: 'px-3 pt-3 pb-1',
        summary: 'px-3 py-2.5',
        summaryValue: 'text-sm'
      },
      md: {
        summaryValue: 'text-base'
      },
      lg: {
        groupHeader: 'px-5 pt-5 pb-2',
        // The header stays micro-type at every size — it is a label, not a
        // heading that grows with the table.
        groupTitle: 'text-sm',
        groupCount: 'text-sm',
        summary: 'px-5 py-4',
        summaryValue: 'text-lg'
      }
    },

    intent: {
      neutral: {
        state: 'text-text-secondary'
      },
      danger: {
        state: 'text-danger-text'
      }
    }
  },

  defaultVariants: {
    size: 'md',
    intent: 'neutral'
  }
});

/**
 * INLINE EDIT VARIANTS
 * Inline cell editing.
 */
export const inlineEditVariants = tv({
  slots: {
    container: ['relative w-full h-full'],
    display: [
      'flex items-center h-full',
      'cursor-text',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    input: [
      'absolute inset-0',
      'w-full h-full',
      'px-3 py-2',
      'bg-surface-base',
      'border-2 border-primary',
      'rounded-modify',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
    ],
    actions: [
      'absolute right-0 top-full mt-1',
      'flex items-center gap-1',
      'p-1',
      'bg-surface-elevated',
      'border border-border-default',
      'rounded-modify shadow-[var(--blocks-shadow-lg)]',
      'z-10'
    ],
    button: [
      'p-1 rounded-modify',
      'hover:bg-surface-hover',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ]
  },

  variants: {
    editing: {
      true: {
        display: 'opacity-0 pointer-events-none'
      },
      false: {
        input: 'hidden',
        actions: 'hidden'
      }
    },

    invalid: {
      true: {
        input: 'border-danger focus-visible:ring-danger'
      },
      false: {}
    }
  },

  defaultVariants: {
    editing: false,
    invalid: false
  }
});

// Type exports
export type EmptyStateVariantProps = VariantProps<typeof emptyStateVariants>;
export type LoadingStateVariantProps = VariantProps<typeof loadingStateVariants>;
export type ErrorStateVariantProps = VariantProps<typeof errorStateVariants>;
export type SkeletonRowVariantProps = VariantProps<typeof skeletonRowVariants>;
export type MobileCardVariantProps = VariantProps<typeof mobileCardVariants>;
export type MobileListVariantProps = VariantProps<typeof mobileListVariants>;
export type InlineEditVariantProps = VariantProps<typeof inlineEditVariants>;
