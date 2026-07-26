/**
 * TABLE CELL VARIANTS
 * Specialized cell variants for different data types.
 */

import { tv, type VariantProps } from '@urbicon-ui/blocks';
import { TABLE_DIMENSIONS, TABLE_INDICATORS } from './table.system';

const CELL_BASE = [
  'h-full w-full flex items-center',
  'transition-colors duration-[var(--blocks-duration-fast)]',
  'text-text-primary'
];

/**
 * TEXT CELL VARIANTS
 */
export const textCellVariants = tv({
  slots: {
    container: CELL_BASE,
    text: ['block overflow-hidden']
  },

  variants: {
    size: {
      sm: {
        container: [TABLE_DIMENSIONS.padding.cell.sm, 'text-xs'],
        text: 'text-xs'
      },
      md: {
        container: [TABLE_DIMENSIONS.padding.cell.md, 'text-sm'],
        text: 'text-sm'
      },
      lg: {
        container: [TABLE_DIMENSIONS.padding.cell.lg, 'text-base'],
        text: 'text-base'
      }
    },

    align: {
      left: {
        container: 'justify-start text-left'
      },
      center: {
        container: 'justify-center text-center'
      },
      right: {
        container: 'justify-end text-right'
      }
    },

    weight: {
      normal: {
        text: 'font-normal'
      },
      medium: {
        text: 'font-medium'
      },
      semibold: {
        text: 'font-semibold'
      },
      bold: {
        text: 'font-bold'
      }
    },

    truncate: {
      true: {
        text: 'truncate'
      },
      false: {
        text: 'whitespace-normal break-words'
      }
    },

    highlight: {
      true: {
        text: 'bg-warning-subtle px-1 rounded-modify'
      },
      false: {}
    }
  },

  defaultVariants: {
    size: 'md',
    align: 'left',
    weight: 'normal',
    truncate: true,
    highlight: false
  }
});

/**
 * NUMBER CELL VARIANTS
 * Numeric cells with formatting.
 */
export const numberCellVariants = tv({
  slots: {
    container: [...CELL_BASE, 'font-mono tabular-nums'],
    number: ['whitespace-nowrap'],
    prefix: ['text-text-secondary mr-1'],
    suffix: ['text-text-secondary ml-1'],
    trend: ['ml-2 flex items-center']
  },

  variants: {
    size: {
      sm: {
        container: [TABLE_DIMENSIONS.padding.cell.sm, 'text-xs'],
        number: 'text-xs'
      },
      md: {
        container: [TABLE_DIMENSIONS.padding.cell.md, 'text-sm'],
        number: 'text-sm'
      },
      lg: {
        container: [TABLE_DIMENSIONS.padding.cell.lg, 'text-base'],
        number: 'text-base'
      }
    },

    align: {
      left: {
        container: 'justify-start'
      },
      center: {
        container: 'justify-center'
      },
      right: {
        container: 'justify-end'
      }
    },

    variant: {
      default: {
        number: 'text-text-primary'
      },
      positive: {
        number: 'text-success'
      },
      negative: {
        number: 'text-danger'
      },
      neutral: {
        number: 'text-text-secondary'
      },
      currency: {
        number: 'font-semibold'
      }
    }
  },

  defaultVariants: {
    size: 'md',
    align: 'right',
    variant: 'default'
  }
});

/**
 * DATE CELL VARIANTS
 */
export const dateCellVariants = tv({
  slots: {
    container: [...CELL_BASE, 'gap-2'],
    date: ['whitespace-nowrap'],
    time: ['text-text-secondary text-xs'],
    relative: ['text-text-tertiary italic']
  },

  variants: {
    size: {
      sm: {
        container: TABLE_DIMENSIONS.padding.cell.sm,
        date: 'text-xs'
      },
      md: {
        container: TABLE_DIMENSIONS.padding.cell.md,
        date: 'text-sm'
      },
      lg: {
        container: TABLE_DIMENSIONS.padding.cell.lg,
        date: 'text-base'
      }
    },

    format: {
      short: {},
      medium: {},
      long: {},
      relative: {},
      datetime: {}
    },

    interactive: {
      true: {
        container: 'cursor-pointer hover:text-primary',
        date: 'underline decoration-dotted decoration-1 underline-offset-2'
      },
      false: {}
    }
  },

  defaultVariants: {
    size: 'md',
    format: 'medium',
    interactive: false
  }
});

/**
 * STATUS CELL VARIANTS
 */
export const statusCellVariants = tv({
  slots: {
    container: CELL_BASE,
    badge: [
      'inline-flex items-center gap-1.5',
      'font-medium rounded-commit',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    dot: TABLE_INDICATORS.dot.base,
    text: []
  },

  variants: {
    size: {
      sm: {
        container: TABLE_DIMENSIONS.padding.cell.sm,
        badge: 'px-2 py-0.5 text-xs',
        dot: TABLE_INDICATORS.dot.size.sm
      },
      md: {
        container: TABLE_DIMENSIONS.padding.cell.md,
        badge: 'px-2.5 py-1 text-sm',
        dot: TABLE_INDICATORS.dot.size.md
      },
      lg: {
        container: TABLE_DIMENSIONS.padding.cell.lg,
        badge: 'px-3 py-1.5 text-base',
        dot: TABLE_INDICATORS.dot.size.lg
      }
    },

    status: {
      active: {
        badge: 'bg-success-subtle text-success-emphasis',
        dot: 'bg-success'
      },
      inactive: {
        badge: 'bg-surface-subtle text-text-secondary',
        dot: 'bg-text-tertiary'
      },
      pending: {
        badge: 'bg-warning-subtle text-warning-emphasis',
        dot: 'bg-warning animate-pulse'
      },
      error: {
        badge: 'bg-danger-subtle text-danger-emphasis',
        dot: 'bg-danger'
      },
      custom: {}
    }
  },

  defaultVariants: {
    size: 'md',
    status: 'active'
  }
});

/**
 * USER CELL VARIANTS
 */
export const userCellVariants = tv({
  slots: {
    container: [...CELL_BASE, 'gap-3'],
    avatar: ['flex-shrink-0 rounded-full overflow-hidden'],
    content: ['min-w-0 flex-1 flex flex-col'],
    name: ['font-medium text-text-primary truncate'],
    email: ['text-text-secondary truncate'],
    badge: ['ml-2']
  },

  variants: {
    size: {
      sm: {
        container: TABLE_DIMENSIONS.padding.cell.sm,
        avatar: 'w-8 h-8',
        name: 'text-xs',
        email: 'text-xs'
      },
      md: {
        container: TABLE_DIMENSIONS.padding.cell.md,
        avatar: 'w-10 h-10',
        name: 'text-sm',
        email: 'text-xs'
      },
      lg: {
        container: TABLE_DIMENSIONS.padding.cell.lg,
        avatar: 'w-12 h-12',
        name: 'text-base',
        email: 'text-sm'
      }
    },

    layout: {
      horizontal: {
        container: 'flex-row'
      },
      vertical: {
        container: 'flex-col text-center',
        content: 'items-center'
      },
      compact: {
        container: 'flex-row gap-2',
        avatar: 'w-6 h-6'
      }
    },

    clickable: {
      true: {
        container: 'cursor-pointer hover:bg-surface-hover rounded-contain',
        name: 'hover:text-primary'
      },
      false: {}
    }
  },

  defaultVariants: {
    size: 'md',
    layout: 'horizontal',
    clickable: false
  }
});

// No legacy alias – use userCellVariants directly

/**
 * ACTION CELL VARIANTS
 */
export const actionCellVariants = tv({
  slots: {
    container: [...CELL_BASE, 'justify-end gap-1'],
    button: [
      'inline-flex items-center justify-center',
      'rounded-modify transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'
    ],
    icon: ['flex-shrink-0']
  },

  variants: {
    size: {
      sm: {
        container: TABLE_DIMENSIONS.padding.cell.sm,
        button: 'w-7 h-7',
        icon: 'w-3.5 h-3.5'
      },
      md: {
        container: TABLE_DIMENSIONS.padding.cell.md,
        button: 'w-8 h-8',
        icon: 'w-4 h-4'
      },
      lg: {
        container: TABLE_DIMENSIONS.padding.cell.lg,
        button: 'w-9 h-9',
        icon: 'w-5 h-5'
      }
    },

    variant: {
      ghost: {
        button: ['text-text-secondary', 'hover:bg-surface-hover hover:text-text-primary']
      },
      subtle: {
        button: ['bg-surface-subtle text-text-primary', 'hover:bg-surface-hover']
      },
      solid: {
        button: [
          'bg-surface-elevated text-text-primary',
          'border border-border-subtle',
          'hover:bg-surface-hover hover:border-border-default'
        ]
      }
    },

    destructive: {
      true: {
        button: 'hover:bg-danger-subtle hover:text-danger-emphasis'
      },
      false: {}
    }
  },

  defaultVariants: {
    size: 'md',
    variant: 'ghost',
    destructive: false
  }
});

// No legacy alias – use actionCellVariants directly

/**
 * LINK CELL VARIANTS
 */
export const linkCellVariants = tv({
  slots: {
    container: CELL_BASE,
    link: [
      'inline-flex items-center gap-1.5',
      'text-primary hover:text-primary-hover',
      'underline decoration-1 underline-offset-2',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
    ],
    icon: ['flex-shrink-0'],
    text: ['truncate']
  },

  variants: {
    size: {
      sm: {
        container: TABLE_DIMENSIONS.padding.cell.sm,
        link: 'text-xs gap-1',
        icon: 'w-3 h-3'
      },
      md: {
        container: TABLE_DIMENSIONS.padding.cell.md,
        link: 'text-sm gap-1.5',
        icon: 'w-4 h-4'
      },
      lg: {
        container: TABLE_DIMENSIONS.padding.cell.lg,
        link: 'text-base gap-2',
        icon: 'w-5 h-5'
      }
    },

    variant: {
      default: {},
      subtle: {
        link: 'text-text-primary hover:text-primary no-underline hover:underline'
      },
      external: {
        icon: 'opacity-60'
      }
    },

    disabled: {
      true: {
        link: 'text-text-disabled cursor-not-allowed no-underline pointer-events-none'
      },
      false: {}
    }
  },

  defaultVariants: {
    size: 'md',
    variant: 'default',
    disabled: false
  }
});

/**
 * PROGRESS CELL VARIANTS
 */
export const progressCellVariants = tv({
  slots: {
    container: [...CELL_BASE, 'flex-col gap-1'],
    label: ['flex justify-between w-full'],
    text: ['text-text-primary'],
    value: ['text-text-secondary text-xs'],
    // `surface-interactive`, matching Progress and Slider. `surface-subtle`
    // resolves to the same neutral step as `surface-elevated`, so the groove
    // vanished on any tinted row or elevated card — the last cell type still
    // carrying that bug after the primitives were fixed.
    track: ['w-full bg-surface-interactive rounded-commit overflow-hidden'],
    bar: [
      'h-full rounded-commit transition-[width,background-color] duration-[var(--blocks-duration-slow)]'
    ]
  },

  variants: {
    size: {
      sm: {
        container: TABLE_DIMENSIONS.padding.cell.sm,
        track: 'h-1.5',
        text: 'text-xs'
      },
      md: {
        container: TABLE_DIMENSIONS.padding.cell.md,
        track: 'h-2',
        text: 'text-sm'
      },
      lg: {
        container: TABLE_DIMENSIONS.padding.cell.lg,
        track: 'h-2.5',
        text: 'text-base'
      }
    },

    variant: {
      default: {
        bar: 'bg-primary'
      },
      success: {
        bar: 'bg-success'
      },
      warning: {
        bar: 'bg-warning'
      },
      danger: {
        bar: 'bg-danger'
      }
    },

    animated: {
      true: {
        bar: 'animate-pulse'
      },
      false: {}
    }
  },

  defaultVariants: {
    size: 'md',
    variant: 'default',
    animated: false
  }
});

/**
 * COPY BUTTON VARIANTS (compat)
 */
export const copyButtonVariants = tv({
  slots: {
    container: [...CELL_BASE],
    button: [],
    text: ['text-xs font-medium leading-none', 'hidden sm:inline'],
    textSuccess: ['text-xs font-medium leading-none text-success', 'hidden sm:inline'],
    icon: ['w-4 h-4 flex-shrink-0']
  },
  variants: {
    size: {
      xs: {
        container: TABLE_DIMENSIONS.padding.cell.sm,
        text: 'text-xs',
        textSuccess: 'text-xs',
        icon: 'w-3 h-3'
      },
      sm: {
        container: TABLE_DIMENSIONS.padding.cell.sm,
        text: 'text-sm',
        textSuccess: 'text-sm',
        icon: 'w-4 h-4'
      },
      md: {
        container: TABLE_DIMENSIONS.padding.cell.md,
        text: 'text-sm',
        textSuccess: 'text-sm',
        icon: 'w-5 h-5'
      }
    },
    align: {
      left: {
        container: 'justify-start text-left'
      },
      center: {
        container: 'justify-center text-center'
      },
      right: {
        container: 'justify-end text-right'
      }
    },
    responsive: {
      true: {
        text: 'hidden sm:inline',
        textSuccess: 'hidden sm:inline'
      },
      false: {
        text: 'inline',
        textSuccess: 'inline'
      }
    }
  },
  defaultVariants: {
    size: 'xs',
    align: 'left',
    responsive: true
  }
});

export type CopyButtonVariantProps = VariantProps<typeof copyButtonVariants>;

/**
 * CUSTOM CELL VARIANTS (compat)
 */
export const customCellVariants = tv({
  slots: {
    container: [
      // `translate`: the interactive container lifts on hover
      // (`hover:-translate-y-0.5`), a discrete property colours-only cannot animate.
      'h-full w-full flex items-center transition-[color,background-color,translate]',
      'px-3 py-2 text-sm leading-normal text-text-primary'
    ],
    content: ['flex items-center min-w-0 gap-2 h-full w-full'],
    text: ['block overflow-hidden text-ellipsis max-w-full line-clamp-1'],
    fallback: ['text-text-tertiary font-mono text-xs opacity-70']
  },
  variants: {
    align: {
      left: {
        container: 'justify-start text-left',
        content: 'justify-start'
      },
      center: {
        container: 'justify-center text-center',
        content: 'justify-center'
      },
      right: {
        container: 'justify-end text-right',
        content: 'justify-end'
      }
    },
    wrap: {
      true: {
        text: 'whitespace-normal break-words line-clamp-none'
      },
      false: {
        text: 'whitespace-nowrap overflow-hidden text-ellipsis'
      }
    },
    truncate: {
      true: {
        text: 'truncate max-w-full'
      },
      false: {
        text: 'break-words'
      }
    },
    interactive: {
      true: {
        container: [
          'cursor-pointer rounded-modify',
          // The transition list that covers this lift lives in the slot base
          // above (`transition-[color,background-color,translate]`) — this
          // compound does not need to restate it.
          'hover:bg-surface-hover hover:-translate-y-0.5',
          'active:translate-y-0 active:bg-surface-active',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary'
        ]
      },
      false: {
        container: 'cursor-default'
      }
    },
    size: {
      xs: {
        container: 'px-1 py-0.5 text-xs',
        text: 'text-xs'
      },
      sm: {
        container: 'px-1 py-1.5 text-xs',
        text: 'text-xs'
      },
      md: {
        container: 'px-2 py-1 text-sm',
        text: 'text-sm'
      },
      lg: {
        container: 'px-3 py-2 text-base',
        text: 'text-base'
      }
    }
  },
  defaultVariants: {
    align: 'left',
    wrap: false,
    truncate: true,
    interactive: false,
    size: 'md'
  }
});

export type CustomCellVariantProps = VariantProps<typeof customCellVariants>;
// Type exports
export type TextCellVariantProps = VariantProps<typeof textCellVariants>;
export type NumberCellVariantProps = VariantProps<typeof numberCellVariants>;
export type DateCellVariantProps = VariantProps<typeof dateCellVariants>;
export type StatusCellVariantProps = VariantProps<typeof statusCellVariants>;
export type UserCellVariantProps = VariantProps<typeof userCellVariants>;
export type ActionCellVariantProps = VariantProps<typeof actionCellVariants>;
export type LinkCellVariantProps = VariantProps<typeof linkCellVariants>;
export type ProgressCellVariantProps = VariantProps<typeof progressCellVariants>;
