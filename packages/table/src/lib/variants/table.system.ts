/**
 * ⚡ TABLE PRIMITIVES
 * Basic table-specific patterns and tokens.
 * Extends blocks/primitives with table-specific functionality.
 *
 * Internal, not part of the public API — `variants/index.ts` deliberately does
 * not re-export any of it. Every entry below has at least one consumer in a
 * sibling `*.variants.ts` or in `TableHead.svelte`; unreferenced entries were
 * swept out on 2026-08-04 rather than kept "for later", because `variants:lint`
 * only reaches a fragment in this file once a `tv()` config actually imports it
 * (its input is the GLOBS over `*.variants.ts`), so dead entries here are
 * unguarded — the enter/exit pair it removed named `tailwindcss-animate`
 * utilities that this project has never had installed.
 */

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
    }
  }
} as const;

/**
 * The row heights above, as the pixel numbers the virtualizer strides in.
 *
 * Derived rather than written down a second time: for two years `ROW_HEIGHTS`
 * said 48/56/64 while these classes said 32/40/48, and nothing could report the
 * disagreement because one side was a Tailwind class and the other a JavaScript
 * number. It stayed invisible only because every virtualized row was absolutely
 * positioned at `index * rowHeight`, which pins a row wherever the number says
 * regardless of how tall it renders. The moment the rows went back into normal
 * flow (2026-08-13) the gap became a 208px blank strip at the end of a
 * 10 000-row list.
 *
 * `rem` is the reason this is a starting value and not the truth: `h-10` is
 * 2.5rem, so this arithmetic holds at the default root font size and nowhere
 * else. `TableDesktop` measures a rendered row and takes over from there — see
 * `measureRowHeight`. That measurement is what makes a consumer's own
 * `slotClasses.row` height work too, which no constant here could.
 */
export const TABLE_ROW_HEIGHT_PX = {
  sm: heightClassToPx(TABLE_DIMENSIONS.height.row.sm),
  md: heightClassToPx(TABLE_DIMENSIONS.height.row.md),
  lg: heightClassToPx(TABLE_DIMENSIONS.height.row.lg)
} as const;

/**
 * `h-10` → 40. Tailwind's spacing scale is 0.25rem per step and a `rem` is
 * 16px unless the page says otherwise, so a step is 4px.
 *
 * Throws on anything it cannot read. A silent 0 here would empty the
 * virtualized viewport — `computeVirtualItems` divides by this number — and a
 * silent fallback would restore exactly the quiet disagreement this constant
 * exists to remove.
 */
function heightClassToPx(heightClass: string): number {
  const step = /^h-(\d+(?:\.\d+)?)$/.exec(heightClass);
  if (!step) {
    throw new Error(
      `TABLE_DIMENSIONS.height.row must be a Tailwind \`h-<step>\` class to convert to pixels, got "${heightClass}".`
    );
  }
  return Number(step[1]) * 4;
}

/**
 * TABLE BORDERS
 */
export const TABLE_BORDERS = {
  // Border widths
  width: {
    thin: 'border'
  },

  // Border positions
  position: {
    bottom: 'border-b'
  },

  // Border colors
  color: {
    default: 'border-border-default',
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
  }
} as const;

/**
 * TABLE STATES
 * Table element states.
 */
export const TABLE_STATES = {
  // Row states
  row: {
    hover: 'hover:bg-surface-hover',
    selected: 'bg-primary-subtle border-primary',
    // "This row is the one being shown" (master/detail), which is not a
    // selection: no bulk action follows from it, so it stays below `selected`,
    // which owns the accent because it carries consequences.
    //
    // The inset rail is not decoration: the ground alone is `surface-hover`,
    // which is exactly what the row under the cursor gets — so while reading
    // down the list, two rows looked identical and neither said which one the
    // detail pane was showing. An `inset box-shadow` rather than a border-left,
    // because a `<tr>` under `border-collapse` drops one.
    active: 'bg-surface-hover shadow-[inset_2px_0_0_0_var(--color-border-strong)]',
    expanded: 'bg-surface-hover',
    disabled: 'opacity-50 pointer-events-none'
  },

  // Cell states
  cell: {
    sorted: 'bg-primary-subtle text-primary-emphasis font-semibold'
  }
} as const;

/**
 * TABLE ANIMATIONS
 * Animation patterns for table interactions.
 */
export const TABLE_ANIMATIONS = {
  // Expand/Collapse
  expand: {
    expanded: 'rotate-0',
    collapsed: '-rotate-90'
  },

  // Loading states
  loading: {
    spin: 'animate-spin',
    // `surface-2` / `surface-3` are not tokens in this design system and never
    // were, so all three gradient stops emitted nothing. Found by the
    // emitted-CSS guard in variants-lint, 2026-08-02.
    //
    // Two things this is NOT. It is not a visible fix: nothing renders either
    // slot that uses it (`LoadingState.svelte` uses container/content/text/
    // description, and `skeletonRowVariants` has no consumer at all), so this
    // is a dead-code correction. And it is not the blocks `Skeleton` wave,
    // which needs `bg-size-[200%_100%]` plus its own keyframe to sweep — the
    // gradient here is static under `animate-pulse`, i.e. tokens that resolve
    // rather than an effect that moves. Wire the wave properly if either slot
    // ever gains a consumer.
    skeleton:
      'animate-pulse bg-linear-to-r from-surface-interactive via-skeleton-shimmer to-surface-interactive'
  }
} as const;
