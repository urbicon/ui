import { tv, type VariantProps } from '$lib/utils/variants';

// Tab represents navigation between panels (switch, don't commit). The
// default tier is `modify` — soft-rounded rectangles read as tap surfaces.
// `commit` is available for status-oriented tab strips that want the full
// pill shape; SegmentGroup remains the canonical commit-tier control for
// state declarations (see comment in segmentgroup.variants.ts).
export const tabVariants = tv({
  slots: {
    base: ['relative w-full'],
    list: [
      'relative flex gap-1',
      'before:absolute before:z-0 before:transition-all before:duration-[var(--blocks-duration-normal)]'
    ],
    trigger: [
      'relative z-10 flex items-center justify-center gap-2',
      'font-medium whitespace-nowrap cursor-pointer select-none',
      'transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--blocks-duration-fast)] ease-out',
      // Focus-ring geometry is bound to tier below so a commit-tier (pill)
      // trigger does not flip to a soft-rectangle outline on focus.
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/50',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'
    ],
    icon: ['inline-flex items-center justify-center shrink-0'],
    label: ['inline-flex items-center'],
    badge: ['inline-flex items-center ml-auto'],
    panel: [
      'w-full',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/20'
    ],
    indicator: [
      'absolute z-0 transition-all duration-[var(--blocks-duration-normal)] ease-out',
      'bg-primary'
    ]
  },
  variants: {
    variant: {
      line: {
        list: 'border-b border-border-subtle',
        trigger: [
          'px-4 py-2 text-text-tertiary',
          'hover:text-text-primary',
          'data-[state=active]:text-primary'
        ],
        indicator: 'h-0.5 bottom-0'
      },
      pills: {
        list: 'p-1 bg-surface-interactive',
        trigger: [
          'px-4 py-2 text-text-tertiary',
          'hover:text-text-primary hover:bg-surface-hover',
          'data-[state=active]:bg-surface-base data-[state=active]:text-primary',
          'data-[state=active]:shadow-[var(--blocks-shadow-sm)]'
        ]
      },
      enclosed: {
        list: 'border-b border-border-subtle',
        trigger: [
          'px-4 py-2 border border-b-0 -mb-px',
          'text-text-tertiary border-transparent',
          'hover:text-text-primary hover:bg-surface-subtle',
          'data-[state=active]:bg-surface-base data-[state=active]:text-primary',
          'data-[state=active]:border-border-subtle data-[state=active]:border-b-surface-base'
        ]
      },
      solid: {
        list: 'p-1 bg-surface-interactive',
        trigger: [
          'px-4 py-2 text-text-tertiary',
          'hover:text-text-primary',
          'data-[state=active]:bg-primary data-[state=active]:text-text-on-primary',
          'data-[state=active]:shadow-[var(--blocks-shadow-sm)]'
        ]
      }
    },
    orientation: {
      horizontal: {
        list: 'flex-row overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        panel: 'mt-4'
      },
      vertical: {
        base: 'flex gap-4',
        list: 'flex-col',
        panel: 'flex-1'
      }
    },
    size: {
      sm: {
        trigger: 'text-sm',
        icon: 'size-4',
        panel: 'text-sm'
      },
      md: {
        trigger: 'text-base',
        icon: 'size-5',
        panel: 'text-base'
      },
      lg: {
        trigger: 'text-lg',
        icon: 'size-6',
        panel: 'text-lg'
      }
    },
    fullWidth: {
      true: {
        trigger: 'flex-1'
      }
    },
    // 3-tier semantic radius. Default `modify` — Tab is navigation, the
    // trigger reads as a soft-rounded tap surface. `commit` switches to
    // full pills (uncommon, but available for product-marketing tab
    // strips). The body radius lives in compoundVariants — only `pills`,
    // `enclosed`, and `solid` carry a visible corner; `line` is borderless
    // and the body radius has no effect there. The focus-ring radius is
    // bound here so it follows the trigger geometry across all variants.
    tier: {
      commit: { trigger: 'focus-visible:rounded-commit' },
      modify: { trigger: 'focus-visible:rounded-modify' }
    }
  },
  compoundVariants: [
    // ── Tier × variant radius matrix ──
    {
      tier: 'modify',
      variant: 'pills',
      class: { list: 'rounded-modify', trigger: 'rounded-modify' }
    },
    {
      tier: 'commit',
      variant: 'pills',
      class: { list: 'rounded-commit', trigger: 'rounded-commit' }
    },
    {
      tier: 'modify',
      variant: 'solid',
      class: { list: 'rounded-modify', trigger: 'rounded-modify' }
    },
    {
      tier: 'commit',
      variant: 'solid',
      class: { list: 'rounded-commit', trigger: 'rounded-commit' }
    },
    {
      // Horizontal enclosed: top corners follow the tier. Vertical enclosed
      // gets its own `rounded-l-{tier}` pair below — the horizontal compound
      // is gated on orientation to avoid emitting `rounded-t-{tier}` next
      // to the vertical-specific `rounded-t-none`, which would leave two
      // `rounded-t-*` classes in the output and rely on CSS source order.
      tier: 'modify',
      variant: 'enclosed',
      orientation: 'horizontal',
      class: { trigger: 'rounded-t-modify' }
    },
    {
      tier: 'commit',
      variant: 'enclosed',
      orientation: 'horizontal',
      class: { trigger: 'rounded-t-commit' }
    },
    {
      variant: 'line',
      orientation: 'horizontal',
      class: {
        indicator: 'left-0 w-full'
      }
    },
    {
      variant: 'line',
      orientation: 'vertical',
      class: {
        list: 'border-b-0 border-l',
        indicator: 'w-0.5 h-full top-0 left-0'
      }
    },
    {
      variant: 'enclosed',
      orientation: 'vertical',
      class: {
        list: 'border-b-0 border-r',
        trigger: [
          'border-b border-r-0 rounded-t-none -mb-0 -mr-px',
          'data-[state=active]:border-r-surface-base data-[state=active]:border-b-border-subtle'
        ]
      }
    },
    {
      tier: 'modify',
      variant: 'enclosed',
      orientation: 'vertical',
      class: { trigger: 'rounded-l-modify' }
    },
    {
      tier: 'commit',
      variant: 'enclosed',
      orientation: 'vertical',
      class: { trigger: 'rounded-l-commit' }
    },
    {
      variant: 'pills',
      orientation: 'vertical',
      class: {
        trigger: 'w-full justify-start'
      }
    },
    {
      variant: 'solid',
      orientation: 'vertical',
      class: {
        trigger: 'w-full justify-start'
      }
    },
    {
      variant: 'line',
      size: 'sm',
      class: {
        trigger: 'py-1.5'
      }
    },
    {
      variant: 'line',
      size: 'lg',
      class: {
        trigger: 'py-3'
      }
    }
  ],
  defaultVariants: {
    variant: 'line',
    orientation: 'horizontal',
    size: 'md',
    fullWidth: false,
    tier: 'modify'
  }
});

export type TabVariants = VariantProps<typeof tabVariants>;
