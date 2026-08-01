/**
 * TABLE FEATURE VARIANTS
 * Variants for filter, grouping, and summary features.
 */

import { tv, type VariantProps } from '@urbicon-ui/blocks';
import { TABLE_ANIMATIONS, TABLE_BORDERS, TABLE_DIMENSIONS } from './table.system';

/**
 * SMART FILTER BAR VARIANTS
 */
export const smartFilterBarVariants = tv({
  slots: {
    container: [
      'w-full flex flex-col gap-2 p-3',
      'bg-surface-base',
      TABLE_BORDERS.width.thin,
      TABLE_BORDERS.color.default,
      'rounded-contain',
      'shadow-[var(--blocks-shadow-sm)]',
      'transition-shadow duration-[var(--blocks-duration-fast)]',
      '@container'
    ],
    // [search | actions] row. Direction is driven by `layout` — `responsive`
    // stacks the search above the actions until the *bar itself* (not the
    // viewport) is wide enough, so the search input is never crushed to ~0 by
    // the shrink-0 action buttons on a narrow screen (Codeberg #28).
    controls: ['flex gap-2'],
    searchSection: ['w-full min-w-0'],
    // Touch targets: enlarge only the menu *trigger* buttons to ≥44px while the
    // bar is stacked (the mobile case). Triggers carry `aria-haspopup`; the
    // `:not([popover] *)` guard excludes the panels they open — those are DOM
    // descendants of this toolbar (native top-layer popover, not portalled) and
    // carry their own haspopup controls (e.g. the filter operator selects), so a
    // blanket rule would wrongly size them too. Revert to compact at ≥ @md.
    actionsSection: [
      'flex items-center',
      '[&_button[aria-haspopup]:not(:where([popover]_*))]:min-h-11',
      '[&_button[aria-haspopup]:not(:where([popover]_*))]:min-w-11',
      '@md:[&_button[aria-haspopup]:not(:where([popover]_*))]:min-h-0',
      '@md:[&_button[aria-haspopup]:not(:where([popover]_*))]:min-w-0'
    ],
    chipsSection: ['w-full'],
    // The rule between "changes which rows/values" and "changes what is on
    // screen". It turns with the tools — see the `compact` axis below.
    rule: [],
    // The narrow bar's single tool button — see the switch in SmartFilterBar.
    toolsTrigger: ['min-h-11 min-w-11 shrink-0 gap-1.5'],
    // The five triggers, stacked. The touch height is set HERE and not inherited
    // from `actionsSection`: that slot is the capsule branch, which the compact
    // mode does not render at all, and its selector excludes `[popover]`
    // descendants anyway — which is precisely what these rows are.
    toolsPanel: [
      'flex min-w-44 flex-col items-stretch gap-1 p-1',
      '[&>*]:min-h-11',
      '[&_button]:min-h-11 [&_button]:justify-start'
    ]
  },

  variants: {
    size: {
      sm: {
        container: 'gap-2 p-2',
        searchSection: '@md:max-w-2xs'
      },
      md: {
        container: 'gap-3 p-3',
        searchSection: '@md:max-w-xs'
      },
      lg: {
        container: 'gap-4 p-4',
        searchSection: '@md:max-w-sm'
      }
    },

    layout: {
      horizontal: {
        controls: 'flex-row items-center',
        actionsSection: 'ml-auto shrink-0'
      },
      vertical: {
        controls: 'flex-col',
        // Stacked layout → search spans the full width; cancel the size cap
        // (`@md:max-w-*`) which would otherwise leave dead space beside it.
        searchSection: '@md:max-w-full',
        actionsSection: 'w-full justify-between'
      },
      // Stack while the bar is narrow; switch to a row at ~28rem container width.
      responsive: {
        controls: 'flex-col @md:flex-row @md:items-center',
        // `w-fit` while stacked: the toolbar carries a ground of its own now, and
        // a stretched flex item would draw that ground across the full bar with
        // the triggers huddled at its left edge. Shrink-wrapping keeps it a
        // capsule in both layouts.
        actionsSection: 'w-fit @md:ml-auto @md:shrink-0'
      }
    },

    elevated: {
      true: {
        container: ['bg-surface-elevated', 'shadow-[var(--blocks-shadow-md)]']
      },
      false: {}
    },

    /**
     * The bar ran out of room and moved its five triggers into a popover on one
     * button (SmartFilterBar measures this; it is not a consumer prop). Only the
     * pieces whose geometry turns with them live here.
     */
    compact: {
      true: {
        // Stacked panel → the rule lies across it.
        rule: 'my-1',
        // The button sits beside the search field, so the row must not stack.
        controls: 'flex-row items-center',
        searchSection: 'flex-1'
      },
      false: {
        // Upright in the capsule. Explicit height because Separator's own
        // `h-full` resolves against an auto-height flex row — i.e. to nothing.
        rule: 'mx-0.5 !h-5'
      }
    },

    variant: {
      flush: {
        container: ['border-transparent bg-transparent shadow-none']
      },
      surface: {
        container: ['border-transparent bg-surface-quiet shadow-none']
      },
      framed: {}
    }
  },

  defaultVariants: {
    size: 'md',
    layout: 'responsive',
    elevated: false,
    variant: 'framed',
    compact: false
  }
});

/**
 * SMART FILTER BAR TRIGGER VARIANTS
 *
 * The lit state of the five toolbar triggers, layered ON TOP of Button's own
 * `active` compound. That compound paints a neutral ground plus an inset ring —
 * the ring exists because a `-subtle` tone alone is too close to `surface-base`,
 * but these triggers sit on the toolbar's `surface-quiet` capsule and carry a
 * hue, so the ring is redundant chrome. The engine's fold strips the earlier
 * source per conflict bucket, hence one token per bucket the compound owns
 * (`bg-`, `text-`, `hover:bg-`, ring width).
 *
 * The hue names the artefact the control produces, so a lit trigger and what it
 * did to the grid read as one thing: filter/group/summary wear their feature
 * ramps — the same swatch as their chips below the bar and their group/summary
 * rows — and sort wears `primary`, which is what a sorted column header already
 * shows (table.system.ts → column.sorted). Same pairing as the header menu's
 * active entries (headerMenuItemVariants below).
 */
export const smartFilterBarTriggerVariants = tv({
  // `ring-0` wins the ring-width bucket; the colour token left behind paints
  // nothing at zero width.
  base: ['ring-0'],
  variants: {
    intent: {
      filter: 'bg-filter-subtle text-filter-emphasis hover:bg-filter-subtle',
      group: 'bg-group-subtle text-group-emphasis hover:bg-group-subtle',
      summary: 'bg-summary-subtle text-summary-emphasis hover:bg-summary-subtle',
      // Sort and column visibility have no feature ramp of their own.
      primary: 'bg-primary-subtle text-primary-emphasis hover:bg-primary-subtle'
    }
  },
  defaultVariants: { intent: 'primary' }
});

/**
 * FILTER CHIP VARIANTS
 */
export const filterChipVariants = tv({
  slots: {
    chip: [
      'inline-flex items-center gap-1.5',
      'rounded-commit font-medium',
      'border transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--blocks-duration-fast)]'
    ],
    icon: ['flex-shrink-0'],
    label: ['truncate max-w-[200px]'],
    value: ['font-semibold'],
    removeButton: [
      'ml-1 rounded-modify',
      'hover:bg-surface-hover',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    removeIcon: ['w-3 h-3']
  },

  variants: {
    intent: {
      filter: {
        chip: 'bg-filter-subtle text-filter border-filter'
      },
      group: {
        chip: 'bg-group-subtle text-group border-group'
      },
      summary: {
        chip: 'bg-summary-subtle text-summary border-summary'
      }
    },

    size: {
      sm: {
        chip: 'h-6 px-2 text-xs gap-1',
        icon: 'w-3 h-3'
      },
      md: {
        chip: 'h-7 px-2.5 text-sm gap-1.5',
        icon: 'w-3.5 h-3.5'
      },
      lg: {
        chip: 'h-8 px-3 text-base gap-2',
        icon: 'w-4 h-4'
      }
    },

    removable: {
      true: {},
      false: {
        removeButton: 'hidden'
      }
    }
  },

  defaultVariants: {
    intent: 'filter',
    size: 'md',
    removable: true
  }
});

/**
 * GROUP HEADER VARIANTS
 */
export const groupHeaderVariants = tv({
  slots: {
    row: [TABLE_BORDERS.position.bottom, 'border-border-hairline'],
    cell: [
      'cursor-pointer',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'hover:bg-surface-hover'
    ],
    content: ['flex items-center gap-3 w-full'],
    chevron: [
      'flex-shrink-0 text-text-tertiary',
      'transition-transform duration-[var(--blocks-duration-fast)]'
    ],
    icon: ['flex-shrink-0'],
    title: ['font-medium text-text-primary'],
    count: ['text-text-tertiary text-sm font-normal'],
    actions: ['ml-auto flex items-center gap-2']
  },

  variants: {
    size: {
      sm: {
        cell: TABLE_DIMENSIONS.padding.cell.sm,
        content: 'gap-2',
        title: 'text-sm'
      },
      md: {
        cell: TABLE_DIMENSIONS.padding.cell.md,
        content: 'gap-3',
        title: 'text-base'
      },
      lg: {
        cell: TABLE_DIMENSIONS.padding.cell.lg,
        content: 'gap-4',
        title: 'text-lg'
      }
    },

    expanded: {
      true: {
        chevron: TABLE_ANIMATIONS.expand.expanded
      },
      false: {
        chevron: TABLE_ANIMATIONS.expand.collapsed
      }
    },

    // Sticky group header — third layer below toolbar + thead.
    // The DOM order ensures the next group header pushes the previous one
    // out automatically (iOS UITableView pattern).
    sticky: {
      true: {
        row: [
          'sticky z-10 bg-surface-base',
          'top-[calc(var(--blocks-table-sticky-top,0px)+var(--blocks-table-toolbar-h,0px)+var(--blocks-table-thead-h,0px))]'
        ]
      },
      false: {}
    }
  },

  defaultVariants: {
    size: 'md',
    expanded: false,
    sticky: false
  }
});

/**
 * SUMMARY ROW VARIANTS
 */
export const summaryRowVariants = tv({
  slots: {
    // No frame: a single 2px rule on the group-separating side (see `position`),
    // colored per `variant` — mirrors the header's accent underline instead of
    // boxing the row. tr borders render because the table is border-collapse.
    row: ['font-semibold'],
    cell: ['text-text-primary'],
    // Horizontal padding matches customCellVariants' container so summary
    // values sit flush with the column's cell content.
    content: ['flex items-center justify-end gap-2'],
    label: ['text-text-secondary text-xs uppercase tracking-wide'],
    value: ['font-mono tabular-nums']
  },

  variants: {
    size: {
      sm: {
        cell: TABLE_DIMENSIONS.padding.cell.sm,
        content: 'px-1',
        value: 'text-sm'
      },
      md: {
        cell: TABLE_DIMENSIONS.padding.cell.md,
        content: 'px-2',
        value: 'text-base'
      },
      lg: {
        cell: TABLE_DIMENSIONS.padding.cell.lg,
        content: 'px-3',
        value: 'text-lg'
      }
    },

    variant: {
      default: {
        row: ['bg-surface-elevated', TABLE_BORDERS.color.default]
      },
      highlighted: {
        row: ['bg-summary-subtle', TABLE_BORDERS.color.summary],
        cell: 'text-summary'
      },
      group: {
        row: ['bg-group-subtle', TABLE_BORDERS.color.group],
        cell: 'text-group'
      }
    },

    position: {
      top: {
        row: 'border-b-2'
      },
      bottom: {
        row: 'border-t-2'
      }
    }
  },

  defaultVariants: {
    size: 'md',
    variant: 'highlighted',
    position: 'bottom'
  }
});

/**
 * COLUMN MENU VARIANTS
 */
export const columnMenuVariants = tv({
  slots: {
    trigger: [
      'opacity-0 group-hover:opacity-100',
      'ml-auto p-1 rounded-modify',
      'hover:bg-surface-hover',
      'transition-opacity duration-[var(--blocks-duration-fast)]'
    ],
    menu: [
      'absolute z-[var(--z-dropdown)] mt-1',
      'bg-surface-elevated',
      'border border-border-default',
      'rounded-contain shadow-[var(--blocks-shadow-lg)]',
      'min-w-[200px]',
      'py-1'
    ],
    item: [
      'flex items-center gap-2',
      'px-3 py-2',
      'text-sm text-text-primary',
      'hover:bg-surface-hover',
      'cursor-pointer',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    icon: ['w-4 h-4 flex-shrink-0'],
    separator: ['my-1 border-t border-border-subtle']
  },

  variants: {
    position: {
      left: {
        menu: 'left-0'
      },
      right: {
        menu: 'right-0'
      }
    },

    destructive: {
      true: {
        item: 'text-danger hover:bg-danger-subtle'
      },
      false: {}
    }
  },

  defaultVariants: {
    position: 'left',
    destructive: false
  }
});

/**
 * FILTER MENU VARIANTS (compat)
 * Menu/popover for complex filter input.
 */
export const filterMenuVariants = tv({
  slots: {
    base: [
      'absolute z-[var(--z-dropdown)] w-96 max-w-[90vw]',
      'bg-surface-elevated border border-border-default',
      'rounded-contain shadow-[var(--blocks-shadow-lg)]',
      'p-4 space-y-4'
    ],
    header: ['flex items-center justify-between pb-3', 'border-b border-border-subtle'],
    title: ['text-base font-semibold text-text-primary'],
    section: ['space-y-3'],
    sectionTitle: ['text-sm font-medium text-text-primary'],
    filterRow: ['flex gap-2 items-start'],
    operatorSelect: ['w-32 flex-shrink-0'],
    valueInput: ['flex-1'],
    quickValues: [
      'grid grid-cols-2 gap-1 p-2 max-h-32 overflow-y-auto',
      'border border-border-subtle rounded-modify'
    ],
    activeFilter: [
      'flex items-center justify-between p-2',
      'bg-surface-subtle border border-border-subtle rounded-modify'
    ],
    footer: ['flex items-center justify-end gap-2 pt-3', 'border-t border-border-subtle']
  },
  variants: {
    size: {
      sm: {
        base: 'w-80 p-3 space-y-3'
      },
      md: {
        base: 'w-96 p-4 space-y-4'
      },
      lg: {
        base: 'w-112 p-5 space-y-5'
      }
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

/**
 * HEADER MENU VARIANTS
 * Structure for the column header context menu.
 */
export const headerMenuVariants = tv({
  slots: {
    container: ['flex items-center justify-center flex-shrink-0'],
    trigger: ['h-8 w-8 min-w-8', 'opacity-0 transition-opacity group-hover:opacity-100'],
    menu: ['p-1 min-w-[200px]'],
    separator: ['h-px bg-border-subtle my-1']
  },
  variants: {
    active: {
      true: { trigger: 'opacity-100' },
      false: {}
    }
  },
  defaultVariants: { active: false }
});

/**
 * HEADER MENU ITEM VARIANTS
 * Per-item intent and active state for header menu entries.
 */
export const headerMenuItemVariants = tv({
  base: [
    'w-full flex items-center justify-start gap-2',
    'p-2 rounded-modify text-sm text-left',
    'transition-colors duration-[var(--blocks-duration-fast)]'
  ],
  variants: {
    intent: {
      default: 'text-text-primary hover:bg-surface-hover',
      filter: 'text-filter hover:bg-filter-subtle hover:text-filter-hover',
      group: 'text-group hover:bg-group-subtle hover:text-group-hover',
      summary: 'text-summary hover:bg-summary-subtle hover:text-summary-hover',
      danger: 'text-danger-emphasis hover:bg-danger-subtle hover:text-danger-emphasis'
    },
    // Marker axis, consumed by the compounds below — no classes of its own.
    // In no-slot mode the empty value is '' (an object would be a slot map).
    active: {
      true: '',
      false: ''
    }
  },
  // All three active states carry the same weight — subtle ground, emphasis
  // text. `group` and `summary` used to go solid, which made two menu entries
  // shout over every other one, and put `text-on-primary` on a solid feature
  // colour: 3.7:1 in the default theme, and near-black-on-dark wherever a room
  // scope rehangs that token (docs/technical-debt.md → "on-primary as the
  // universal on-colour").
  compoundVariants: [
    { intent: 'default', active: true, class: 'bg-primary-subtle text-primary-emphasis' },
    {
      intent: 'group',
      active: true,
      class: 'bg-group-subtle text-group-emphasis hover:bg-group-subtle hover:text-group-emphasis'
    },
    {
      intent: 'summary',
      active: true,
      class:
        'bg-summary-subtle text-summary-emphasis hover:bg-summary-subtle hover:text-summary-emphasis'
    }
  ],
  defaultVariants: { intent: 'default', active: false }
});

export type FilterMenuVariantProps = VariantProps<typeof filterMenuVariants>;
export type HeaderMenuVariantProps = VariantProps<typeof headerMenuVariants>;
export type HeaderMenuItemVariantProps = VariantProps<typeof headerMenuItemVariants>;
export type SmartFilterBarVariantProps = VariantProps<typeof smartFilterBarVariants>;
export type SmartFilterBarTriggerVariantProps = VariantProps<typeof smartFilterBarTriggerVariants>;
export type FilterChipVariantProps = VariantProps<typeof filterChipVariants>;
export type GroupHeaderVariantProps = VariantProps<typeof groupHeaderVariants>;
export type SummaryRowVariantProps = VariantProps<typeof summaryRowVariants>;
export type ColumnMenuVariantProps = VariantProps<typeof columnMenuVariants>;
