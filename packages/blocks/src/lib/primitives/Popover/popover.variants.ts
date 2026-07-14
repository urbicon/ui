import { tv, type VariantProps } from '$lib/utils/variants';

/**
 * CSS-native enter/exit motion for the floating panel (ACC-3 rest), keyed on
 * the `data-state` attribute Popover always stamps. Kept as its own fragment
 * because two call sites need exactly these classes: `popoverVariants.base`
 * below, and Menu — which renders its inner Popover `unstyled` (to avoid a
 * double surface) and re-applies the fragment via Popover's `class` prop.
 *
 * How the two halves work:
 * - **Enter** — the panel un-hides via `showPopover()` (top layer) or a
 *   `display` flip (in-place mode), so a plain transition has no before-state;
 *   `starting:` (`@starting-style`) supplies it.
 * - **Exit** — `hidePopover()` / a native light dismiss yank the panel to
 *   `display: none` in the same style recalc that flips `data-state`;
 *   `transition-discrete` (`transition-behavior: allow-discrete`) on
 *   `display`/`overlay` keeps it painted (and in the top layer) until the
 *   fade lands. Popover lags the children-teardown to match — see the
 *   exit-motion block in Popover.svelte.
 *
 * Browsers without `@starting-style`/`allow-discrete` simply skip the motion
 * and keep today's instant toggle. Duration/easing resolve through the
 * `--blocks-popover-*` tokens (interaction.css), which reduced motion
 * collapses to 1ms; `motion-reduce:duration-[1ms]` guards the inline
 * per-instance override path, which can't see the media query.
 */
export const popoverMotion = [
  'transition-[opacity,scale,display,overlay] transition-discrete',
  'duration-[var(--blocks-popover-duration)] ease-[var(--blocks-popover-easing)]',
  'motion-reduce:duration-[1ms]',
  'data-[state=closed]:opacity-0 data-[state=closed]:scale-[0.98]',
  'starting:data-[state=open]:opacity-0 starting:data-[state=open]:scale-[0.98]'
].join(' ');

export const popoverVariants = tv({
  // tier: contain — floating panel surface.
  base: [
    'bg-surface-elevated border border-border-hairline rounded-contain',
    'shadow-[var(--blocks-shadow-md)] backdrop-blur-sm',
    popoverMotion,
    // `calc(100dvh-4rem)` is the static design cap; Floating UI's `size`
    // middleware (via useFloatingPanel) narrows it to the room actually left
    // between the anchor and the visual viewport edge through
    // `--blocks-overlay-available-height`, so the panel shrinks above the iOS
    // keyboard and recovers when it closes. The var falls back to 100dvh when
    // unset (SSR / no JS), leaving the design cap in charge.
    'overflow-y-auto max-h-[min(calc(100dvh-4rem),var(--blocks-overlay-available-height,100dvh))]'
  ],
  variants: {
    size: {
      sm: 'p-1 min-w-32 max-w-64 text-xs',
      md: 'p-2 min-w-48 max-w-96 text-sm',
      lg: 'p-3 min-w-64 max-w-screen-sm text-base'
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

export type PopoverVariants = VariantProps<typeof popoverVariants>;
