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
    controls: [
      'flex gap-2',
      // ── Where the capsule/sheet threshold is written down ──────────────────
      //
      // The bar has to KNOW which of the two it is showing (the sheet is a
      // different component tree, not a different style), and it used to know by
      // comparing its measured px width against `28 * 16` — a second copy of the
      // `@md` step above, in a second unit. The two agree only at a 16px root
      // font: raise the browser's text size and a band opened where the capsule
      // was back under the search field, which is the exact state compact mode
      // exists to remove (#133).
      //
      // So CSS decides and JS reads the decision off this element. One `@md`,
      // one container, one engine resolving one `rem` — the two cannot disagree,
      // because there is no longer a second thing to disagree with.
      '[--blocks-table-tools:sheet]',
      '@md:[--blocks-table-tools:capsule]'
    ],
    searchSection: ['w-full min-w-0'],
    // Touch targets: enlarge the menu *trigger* buttons to the 44px
    // docs/ResponsiveGuidelines.md asks for. Triggers carry `aria-haspopup`; the
    // `:not([popover] *)` guard excludes the panels they open — those are DOM
    // descendants of this toolbar (native top-layer popover, not portalled) and
    // carry their own haspopup controls (e.g. the filter operator selects), so a
    // blanket rule would wrongly size them too.
    //
    // `pointer-coarse:`, NOT the container width it used to be
    // (`min-h-11` … `@md:min-h-0`). Width is not the question a touch target
    // asks: a table in a 400px desktop pane got 44px buttons nobody was going to
    // tap, and a wide tablet got 32px ones somebody was — the rule fired on
    // exactly the wrong two cases. The pointer media query is what the guideline
    // is written against (`--blocks-touch-target-min` under
    // `@media (pointer: coarse)`), and it is the idiom Input already uses to
    // floor its font size on touch.
    //
    // Now reachable in every layout, including the compact one — the narrow bar
    // renders its single tool button inside this same capsule.
    actionsSection: [
      'flex items-center',
      'pointer-coarse:[&_button[aria-haspopup]:not(:where([popover]_*))]:min-h-11',
      'pointer-coarse:[&_button[aria-haspopup]:not(:where([popover]_*))]:min-w-11'
    ],
    chipsSection: ['w-full'],
    // The upright rule inside the capsule, between "changes which rows/values
    // the grid shows" and "changes only what is on screen". Wide bar only: the
    // compact capsule holds a single button, so there is nothing to divide.
    // Explicit height because Separator's own `h-full` resolves against an
    // auto-height flex row — i.e. to nothing.
    rule: ['mx-0.5 !h-5'],
    // The narrow bar's single tool button — see the switch in SmartFilterBar.
    //
    // Size and shape do not live here: it is the sixth instance of the
    // MenuTrigger shape, inside the same `actionsSection` toolbar, so the radius
    // (`tier="modify"` via TierContext) and the touch floor reach it the way
    // they reach the other five. It used to stand outside that toolbar with a
    // hard `min-h-11 min-w-11` and the Button default `tier="commit"` — a 44px
    // pill beside a 40px search field and its own 32px siblings.
    //
    // The GROUND is the one thing it carries itself rather than inheriting, and
    // `toolsActive` below says why.
    toolsTrigger: ['shrink-0']
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
     * The bar ran out of room and moved its five tools into a sheet reached from
     * one button (SmartFilterBar measures this; it is not a consumer prop). Only
     * the pieces whose geometry turns with them live here — the tools themselves
     * are no longer part of the bar in this mode, so nothing about them does.
     */
    compact: {
      true: {
        // The button sits beside the search field, so the row must not stack —
        // and the toolbar keeps its width while the field takes the rest.
        controls: 'flex-row items-center',
        searchSection: 'flex-1',
        actionsSection: 'shrink-0'
      },
      false: {}
    },

    /**
     * Whether the closed tool button has something to report — and, with it,
     * WHO paints the ground in the compact bar.
     *
     * Exactly one element may: the toolbar around five triggers is a grouping
     * surface, and grouping is what a toolbar holding ONE button has nothing
     * left to do. Its `surface-quiet` then stopped reading as the button's body
     * and started reading as a pale frame around it — invisible while the button
     * was transparent, a second rounded rect the moment the button lit up.
     *
     * So the compact toolbar is `variant="ghost"` (see SmartFilterBar: chrome
     * off, tier and touch floor still on) and the ground rides the button:
     * `surface-quiet` at rest — the same tone, one element in — and nothing here
     * when lit, because `smartFilterBarTriggerVariants` brings `primary-subtle`.
     * The two are arms of one axis on purpose: as two classes on one element
     * they would both be emitted and resolve by stylesheet order, which is not a
     * decision anybody made.
     */
    toolsActive: {
      true: {},
      false: {
        toolsTrigger: 'bg-surface-quiet'
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
    compact: false,
    toolsActive: false
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
        item: 'text-danger-text hover:bg-danger-subtle'
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
 * TOOLS SHEET VARIANTS
 * The narrow bar's tool surface — see ToolsSheet.
 *
 * Only the touch contract lives here, because it is the one thing the sheet has
 * to impose on panels that otherwise style themselves. Every row a thumb aims
 * at gets the 44px target docs/ResponsiveGuidelines.md asks for, and gets the
 * full row width to be aimed at — `RadioItem` renders an `inline-flex` label
 * with no minimum height, so its hit area is otherwise as tall as the text and
 * as wide as the column name. `Checkbox` already carries `min-h-11` on its own
 * control; stating it here too costs nothing and keeps the sections consistent
 * rather than 44px in one and 20px in the next.
 *
 * This replaces the guarantee the old `toolsPanel` slot made for the popover
 * stack (`[&>*]:min-h-11`, `[&_button]:min-h-11`) — the stack is gone, the
 * requirement is not.
 */
export const toolsSheetVariants = tv({
  slots: {
    section: ['[&_label]:min-h-11 [&_label]:w-full [&_label]:items-center'],
    // SegmentGroup renders buttons, not labels, so it needs saying separately.
    // Scoped to the segment track rather than `[&_button]`, which would also
    // inflate the filter form's quick-value grid and remove-filter icons.
    segments: ['[&_button]:min-h-11']
  }
});

/**
 * FILTER MENU VARIANTS
 * The popover SHELL around FilterPanel — position, width, ground, heading.
 *
 * The form itself lives in {@link filterPanelVariants}, because the same form is
 * also a section of the tools sheet, where none of this applies.
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
    title: ['text-base font-semibold text-text-primary']
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
 * FILTER PANEL VARIANTS
 * The filter FORM — one section per filterable column, plus its own actions.
 *
 * Sized by container query, not by a prop: the form renders at ~352px inside the
 * filter popover (`w-96` minus `p-4`) and at ~300px inside a tools sheet on a
 * phone, and the operator/value row has to stack in the second case and not in
 * the first. `@xs` (20rem) sits between the two, so the same component fits both
 * hulls without either one having to describe the other's geometry.
 */
export const filterPanelVariants = tv({
  slots: {
    root: ['@container space-y-4'],
    section: ['space-y-3'],
    sectionTitle: ['text-sm font-medium text-text-primary'],
    filterRow: ['flex flex-col gap-2', '@xs:flex-row @xs:items-start'],
    operatorSelect: ['w-full', '@xs:w-32 @xs:flex-shrink-0'],
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
  }
});

/**
 * HEADER MENU VARIANTS
 * Structure for the column header context menu.
 */
export const headerMenuVariants = tv({
  slots: {
    // In the flow, as a sibling of the header title.
    //
    // It was briefly absolute (2026-08-14), to free the 32px + gap it holds so
    // that a header title could reach its cell's edge. That trade turned out
    // worse than the problem it solved: out of the flow the button paints over
    // the title — permanently, not just on hover, for any sorted, grouped or
    // summarised column — an `opacity: 0` button still takes clicks, so a tap
    // on a right-aligned title opened the menu instead of sorting, and under
    // `unstyled` the `<th>` loses its `relative` and every menu escapes to the
    // table wrapper. See the `align` note on `tableHeaderVariants` for the wave
    // that has to settle header alignment properly.
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
