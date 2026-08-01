/**
 * TABLE STATE VARIANTS
 * Variants for different table states.
 */

import { tv, type VariantProps } from '@urbicon-ui/blocks';
import { TABLE_ANIMATIONS, TABLE_DIMENSIONS } from './table.system';

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
        icon: 'text-primary'
      },
      filter: {
        icon: 'text-filter'
      },
      error: {
        icon: 'text-danger'
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
    icon: ['text-danger'],
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
        icon: 'text-danger',
        retryButton: 'bg-danger hover:bg-danger-hover'
      },
      warning: {
        icon: 'text-warning-emphasis',
        retryButton: 'bg-warning text-text-on-warning hover:bg-warning-hover'
      },
      info: {
        icon: 'text-primary',
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
 * Mobile-optimized card display.
 */
export const mobileCardVariants = tv({
  slots: {
    card: [
      'bg-surface-base',
      'border border-border-subtle',
      'rounded-contain overflow-hidden',
      'mb-3',
      // `scale` is listed because the `interactive` axis adds `active:scale-[0.995]`
      // — Tailwind 4 emits that as the discrete `scale:` property, which no other
      // entry in this list covers.
      'transition-[color,background-color,border-color,box-shadow,opacity,scale] duration-[var(--blocks-duration-fast)]',
      'hover:border-border-default hover:shadow-[var(--blocks-shadow-sm)]'
    ],
    // Title region — the primary identifier, emphasized and label-less. Lays out
    // the optional selection checkbox and the detail toggle next to the title.
    header: ['flex items-center gap-3', 'px-4 pt-4 pb-1'],
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
    content: ['px-4 pb-4 pt-2'],
    // Detail fields in a compact 2-column grid (was a tall single-column stack,
    // which made a 4-field card ~266px tall — only ~2 fit per phone screen).
    grid: ['grid grid-cols-2 gap-x-4 gap-y-3'],
    field: ['flex flex-col gap-0.5 min-w-0'],
    label: ['text-xs font-medium text-text-tertiary', 'uppercase tracking-wide'],
    // Wrap instead of truncate — a full-width card has room, and truncation
    // hides data with no tooltip on touch.
    value: ['text-sm text-text-primary break-words'],
    expandIcon: ['transition-transform duration-[var(--blocks-duration-fast)]'],
    expandedContent: ['px-4 pb-4', 'border-t border-border-subtle pt-4']
  },

  variants: {
    size: {
      sm: {
        header: 'px-3 pt-3 pb-1',
        content: 'px-3 pb-3 pt-1.5',
        grid: 'gap-x-3 gap-y-2',
        title: 'text-sm',
        subtitle: 'text-xs'
      },
      md: {
        header: 'px-4 pt-4 pb-1',
        content: 'px-4 pb-4 pt-2',
        grid: 'gap-x-4 gap-y-3'
      },
      lg: {
        header: 'px-5 pt-5 pb-1.5',
        content: 'px-5 pb-5 pt-2.5',
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

    selected: {
      true: {
        card: 'border-primary bg-primary-subtle'
      },
      false: {}
    },

    /**
     * The card whose record is being shown elsewhere (master/detail). A step
     * below `selected`, which keeps the accent because it carries consequences;
     * a compound below drops this whenever both are set.
     *
     * A card carries its own border, so the border colour is the distinction
     * here — the rows' inset rail exists because a `<tr>` has no border to
     * darken without `border-collapse` eating it.
     */
    active: {
      true: {
        card: 'border-border-strong bg-surface-hover'
      },
      false: {}
    },

    // The press cue rides the headline button, not the card: the card stopped
    // being a control (see mobile-card-shape.ts), and a card-wide
    // `cursor-pointer` on a surface where only the headline responds promises a
    // click the detail grid never delivers.
    interactive: {
      true: {
        headlineButton: 'cursor-pointer active:scale-[0.995]'
      },
      false: {}
    },

    expanded: {
      true: {
        expandIcon: 'rotate-180',
        card: 'shadow-[var(--blocks-shadow-md)]'
      },
      false: {}
    }
  },

  compoundVariants: [
    // Both at once: selection owns the look, so the active ground does not
    // fight the accent. Two backgrounds on one card would resolve by order,
    // not by meaning.
    {
      selected: true,
      active: true,
      class: { card: 'border-primary bg-primary-subtle' }
    },

    // ── Closed card: symmetric header padding per size ──
    { collapsed: true, size: 'sm', class: { header: 'pb-3' } },
    { collapsed: true, size: 'md', class: { header: 'pb-4' } },
    { collapsed: true, size: 'lg', class: { header: 'pb-5' } }
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
export type InlineEditVariantProps = VariantProps<typeof inlineEditVariants>;
