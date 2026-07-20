/**
 * ⚡ TABLE PRIMITIVES
 * Basic table-specific patterns and tokens.
 * Extends blocks/primitives with table-specific functionality.
 */

/**
 * TABLE-SPECIFIC INTENTS
 * Extended semantic colors for table features.
 */
export const TABLE_INTENTS = {
  // Core intents (inherited from blocks)
  primary: 'primary',
  neutral: 'neutral',
  success: 'success',
  danger: 'danger',
  warning: 'warning',

  // Table-specific intents
  filter: 'filter', // Cyan-based for filter UI
  group: 'group', // Teal-based for grouping
  summary: 'summary' // Emerald-based for summaries
} as const;

/**
 * TABLE DIMENSIONS
 */
export const TABLE_DIMENSIONS = {
  // Header & Row Heights
  height: {
    header: {
      sm: 'h-8',
      md: 'h-10',
      lg: 'h-12'
    },
    row: {
      sm: 'h-8',
      md: 'h-10',
      lg: 'h-12'
    },
    mobileCard: {
      sm: 'min-h-16',
      md: 'min-h-24',
      lg: 'min-h-32'
    }
  },

  // Cell Padding
  padding: {
    cell: {
      sm: 'px-0.5 py-0.5',
      md: 'px-1 py-1',
      lg: 'px-2 py-1.5'
    },
    headerCell: {
      sm: 'px-0.5 py-0.5',
      md: 'px-1 py-1',
      lg: 'px-2 py-2'
    },
    mobileCard: {
      sm: 'p-2',
      md: 'p-3',
      lg: 'p-4'
    }
  },

  // Table-specific widths
  width: {
    minTable: 'min-w-[600px]',
    maxTable: 'max-w-full',
    columnMin: 'min-w-[100px]',
    columnMax: 'max-w-[500px]'
  }
} as const;

/**
 * TABLE SURFACES
 * Table-specific surface definitions.
 */
export const TABLE_SURFACES = {
  // Base surfaces
  base: {
    header: 'bg-surface-elevated',
    row: 'bg-surface-base',
    rowHover: 'hover:bg-surface-hover',
    rowSelected: 'bg-surface-selected',
    rowGrouped: 'bg-surface-elevated'
  },

  // Intent-based surfaces
  intent: {
    filter: {
      subtle: 'bg-filter-subtle',
      emphasis: 'bg-filter-emphasis',
      hover: 'hover:bg-filter-hover'
    },
    group: {
      subtle: 'bg-group-subtle',
      emphasis: 'bg-group-emphasis',
      hover: 'hover:bg-group-hover'
    },
    summary: {
      subtle: 'bg-summary-subtle',
      emphasis: 'bg-summary-emphasis',
      hover: 'hover:bg-summary-hover'
    }
  }
} as const;

/**
 * TABLE BORDERS
 */
export const TABLE_BORDERS = {
  // Border widths
  width: {
    none: 'border-0',
    thin: 'border',
    thick: 'border-2'
  },

  // Border positions
  position: {
    all: 'border',
    top: 'border-t',
    right: 'border-r',
    bottom: 'border-b',
    left: 'border-l',
    horizontal: 'border-t border-b',
    vertical: 'border-l border-r'
  },

  // Border colors
  color: {
    hairline: 'border-border-hairline',
    subtle: 'border-border-subtle',
    default: 'border-border-default',
    emphasis: 'border-border-emphasis',
    filter: 'border-filter',
    group: 'border-group',
    summary: 'border-summary'
  }
} as const;

/**
 * TABLE INDICATORS
 * Visual indicators for table features.
 */
export const TABLE_INDICATORS = {
  // Dot indicators
  dot: {
    base: 'rounded-full',
    size: {
      xs: 'w-1 h-1',
      sm: 'w-1.5 h-1.5',
      md: 'w-2 h-2',
      lg: 'w-2.5 h-2.5'
    },
    intent: {
      filter: 'bg-filter',
      group: 'bg-group',
      summary: 'bg-summary',
      primary: 'bg-primary',
      success: 'bg-success',
      warning: 'bg-warning',
      danger: 'bg-danger'
    }
  },

  // Bar indicators
  bar: {
    base: 'transition-[background-color,width] duration-[var(--blocks-duration-normal)]',
    size: {
      xs: 'h-0.5',
      sm: 'h-1',
      md: 'h-1.5',
      lg: 'h-2'
    },
    position: {
      bottom: 'absolute bottom-0 left-0 right-0',
      top: 'absolute top-0 left-0 right-0',
      left: 'absolute top-0 left-0 bottom-0 w-1',
      right: 'absolute top-0 right-0 bottom-0 w-1'
    }
  },

  // Badge indicators
  badge: {
    base: 'inline-flex items-center justify-center font-semibold rounded-full',
    size: {
      xs: 'min-w-4 h-4 px-1 text-3xs',
      sm: 'min-w-5 h-5 px-1.5 text-xs',
      md: 'min-w-6 h-6 px-2 text-sm',
      lg: 'min-w-7 h-7 px-2.5 text-base'
    }
  }
} as const;

/**
 * TABLE STATES
 * Table element states.
 */
export const TABLE_STATES = {
  // Row states
  row: {
    default: '',
    hover: 'hover:bg-surface-hover',
    selected: 'bg-primary-subtle border-primary',
    expanded: 'bg-surface-hover',
    grouped: 'bg-surface-elevated font-semibold',
    disabled: 'opacity-50 pointer-events-none'
  },

  // Cell states
  cell: {
    default: '',
    sortable: 'cursor-pointer hover:bg-surface-hover',
    sorted: 'bg-primary-subtle text-primary-emphasis font-semibold',
    editable: 'cursor-text hover:ring-2 hover:ring-primary',
    readonly: 'cursor-not-allowed opacity-75'
  },

  // Feature states
  feature: {
    active: 'ring-2 ring-primary',
    inactive: 'opacity-60',
    loading: 'animate-pulse',
    error: 'ring-2 ring-danger'
  }
} as const;

/**
 * TABLE ANIMATIONS
 * Animation patterns for table interactions.
 */
export const TABLE_ANIMATIONS = {
  // Expand/Collapse
  expand: {
    trigger: 'transition-transform duration-[var(--blocks-duration-normal)]',
    expanded: 'rotate-0',
    collapsed: '-rotate-90'
  },

  // Sort indicators
  sort: {
    base: 'transition-transform duration-[var(--blocks-duration-fast)]',
    asc: 'rotate-0',
    desc: 'rotate-180',
    none: 'opacity-0'
  },

  // Loading states
  loading: {
    pulse: 'animate-pulse',
    spin: 'animate-spin',
    skeleton: 'animate-pulse bg-gradient-to-r from-surface-2 via-surface-3 to-surface-2'
  },

  // Row animations
  row: {
    enter: 'animate-in fade-in duration-[var(--blocks-duration-normal)]',
    exit: 'animate-out fade-out duration-[var(--blocks-duration-fast)]',
    reorder: 'transition-[transform,opacity] duration-[var(--blocks-duration-slow)]'
  }
} as const;

/**
 * TABLE LAYOUTS
 */
export const TABLE_LAYOUTS = {
  // Table variants
  variant: {
    default: 'table-auto',
    fixed: 'table-fixed',
    compact: 'table-fixed text-sm',
    comfortable: 'table-auto text-base',
    data: 'table-fixed font-mono text-sm'
  },

  // Density presets
  density: {
    compact: {
      header: TABLE_DIMENSIONS.height.header.sm,
      row: TABLE_DIMENSIONS.height.row.sm,
      padding: TABLE_DIMENSIONS.padding.cell.sm
    },
    default: {
      header: TABLE_DIMENSIONS.height.header.md,
      row: TABLE_DIMENSIONS.height.row.md,
      padding: TABLE_DIMENSIONS.padding.cell.md
    },
    comfortable: {
      header: TABLE_DIMENSIONS.height.header.lg,
      row: TABLE_DIMENSIONS.height.row.lg,
      padding: TABLE_DIMENSIONS.padding.cell.lg
    }
  }
} as const;

// Type exports
export type TableIntent = keyof typeof TABLE_INTENTS;
export type TableSize = 'sm' | 'md' | 'lg';
export type TableDensity = keyof typeof TABLE_LAYOUTS.density;
export type TableRowState = keyof typeof TABLE_STATES.row;
export type TableCellState = keyof typeof TABLE_STATES.cell;

/**
 * UTILITY FUNCTIONS
 */
export const combineTableClasses = (tableClasses: string, blockPrimitives?: string): string => {
  return [blockPrimitives, tableClasses].filter(Boolean).join(' ');
};

export const getDensityClasses = (density: TableDensity) => {
  return TABLE_LAYOUTS.density[density];
};
