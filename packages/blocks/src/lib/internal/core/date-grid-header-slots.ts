/**
 * The look of the small date-surface toolbar, once (INTERNAL).
 *
 * `CoreDateGridHeader` renders the bar; these are the classes Planner and
 * ResourceTimeline paint it with. Both files carried a byte-identical copy of
 * all four slots AND of their three size steps — 16 declarations twinned, which
 * `variants:lint` cannot see (it hunts dead tokens, not duplicates) and which
 * would have drifted the moment one of the two got a nicer focus ring (#191).
 *
 * Spread into each surface's own `tv()` config rather than applied by the core:
 * the slots stay part of the component's public `slotClasses` surface, a preset
 * or a provider override still reaches them, and a surface that wants a
 * different toolbar simply overrides the key after the spread. `variants:lint`
 * evaluates the configs at runtime, so the spread is fully visible to it.
 *
 * `CalendarHeader` is not a caller — its bar carries a month picker, a view
 * switcher and a narrow-viewport grid, and it names its title slot `title`.
 */

/**
 * Base classes for the four toolbar slots. Deliberately NOT `as const`: the
 * engine's config type takes mutable `string[]`, and a readonly tuple fails the
 * overload. The keys are what the slot-name types need, and those survive
 * widening.
 */
export const dateGridHeaderSlots = {
  header: ['flex items-center justify-between gap-2', 'border-b border-border-hairline'],
  headerTitle: 'font-semibold text-text-primary select-none tabular-nums',
  nav: 'flex items-center gap-1',
  /**
   * Rendered on the internal CoreIconButton, which already supplies the plumbing
   * (inline-flex centring, focus-visible reset, disabled
   * opacity/cursor/inertness) — this slot carries only the visual identity on
   * top. Deliberate deltas vs. the old `<Button unstyled mint="none">` render
   * (which had NO plumbing): `cursor-pointer` (was the UA arrow — Tailwind 4
   * preflight does not set it; now consistent with every styled Button) and
   * `disabled:pointer-events-none` (a disabled nav button is fully inert: no
   * hover-bg feedback, no not-allowed cursor). Mirrors calendar.variants
   * navButton, which stays its own because CalendarHeader is not a caller.
   */
  navButton: [
    'rounded-md',
    'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
    'transition-colors duration-[var(--blocks-duration-fast)]',
    'focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2'
  ]
};

/** Per-`size` overrides for the toolbar, spread into each surface's size axis. */
export const dateGridHeaderSizes = {
  sm: { header: 'py-2', headerTitle: 'text-sm', navButton: 'h-7 w-7' },
  md: { header: 'py-3', headerTitle: 'text-base', navButton: 'h-8 w-8' },
  lg: { header: 'py-4', headerTitle: 'text-lg', navButton: 'h-9 w-9' }
};
