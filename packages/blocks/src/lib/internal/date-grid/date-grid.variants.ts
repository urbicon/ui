import { tv } from '$lib/utils/variants';

/**
 * The scaffold's own grid geometry (INTERNAL).
 *
 * A tv() base plus one axis, so the row class the caller hands in is the
 * override rung over it and strips what it collides with. Written in front of
 * that already-folded string instead, `grid-cols-7` would sit outside the
 * resolution and arrive beside a consumer's `grid-cols-1`, with the stylesheet
 * deciding which of the two paints (#349).
 *
 * Static column classes rather than an inline `grid-template`, so a caller can
 * still override them per breakpoint — Planner stacks its week rows below `md`
 * with `max-md:grid-cols-1`, a different bucket
 * (`max-md:grid-template-columns`), which therefore composes instead of
 * stripping. Both literals appear verbatim so Tailwind emits them.
 *
 * No `defaultVariants`: `showWeekNumber` decides the whole template, and the
 * caller always knows it.
 */
export const dateGridRow = tv({
  base: 'grid',
  variants: {
    showWeekNumber: {
      true: 'grid-cols-[minmax(2rem,auto)_repeat(7,minmax(0,1fr))]',
      false: 'grid-cols-7'
    }
  }
});
