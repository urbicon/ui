import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const drawerVariants = tv({
  slots: {
    dialog: [
      'fixed inset-0 z-[var(--z-modal)] flex',
      'p-0 bg-transparent border-none outline-none',
      'max-w-none max-h-none w-full h-full overflow-hidden'
    ],
    backdrop: ['fixed inset-0 z-[var(--z-overlay)] bg-black/50 backdrop-blur-sm'],
    panel: [
      'relative flex flex-col bg-surface-overlay',
      'border border-border-hairline',
      'overflow-hidden z-[var(--z-modal)]',
      'shadow-[var(--blocks-shadow-lg)]'
    ],
    header: [
      'flex items-center justify-between px-5 py-4',
      'border-b border-border-hairline flex-shrink-0'
    ],
    title: ['text-base font-semibold text-text-primary truncate'],
    // Icon-only header close control (× dismiss). Rendered on the internal
    // CoreIconButton (behaviour-only base: inline-flex centring, cursor/select,
    // focus-visible reset, disabled inertness), so this slot carries the FULL
    // visual identity of the `<Button variant="ghost" size="sm">` (intent
    // neutral, tier commit) it used to be — the exact ghost/sm neutral Button
    // fold MINUS the classes CoreIconButton already supplies. Effective render is
    // byte-identical to the pre-extraction close button (no VR baseline gates
    // overlays; reproduced deterministically from buttonVariants). Mirrors Dialog.
    // See internal/core/.
    closeButton: [
      'relative font-medium text-center whitespace-nowrap border overflow-hidden',
      // `scale`, NOT `transform` — mirrors buttonVariants.base: Tailwind 4 emits
      // `scale-*` as the discrete `scale:` property, so `active:scale-[0.98]`
      // below only animates if the list names `scale`.
      'transition-[color,background-color,border-color,box-shadow,opacity,scale] duration-[var(--blocks-duration-fast)] ease-out',
      'rounded-commit bg-transparent border-transparent shadow-none',
      'hover:shadow-[var(--blocks-shadow-md)] active:scale-[0.98] active:shadow-[var(--blocks-shadow-sm)]',
      'h-8 px-3 text-sm gap-1.5 text-neutral-emphasis hover:bg-neutral-subtle',
      'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral/50'
    ],
    body: [
      'px-5 py-4 flex-1 overflow-y-auto overscroll-contain',
      'text-sm leading-relaxed text-text-secondary'
    ],
    footer: [
      'flex items-center justify-end gap-3 px-5 py-3',
      'border-t border-border-hairline flex-shrink-0'
    ]
  },
  variants: {
    // Only the inner edge is rounded — the other three meet the viewport. The
    // radius comes from the CONTAIN tier, exactly as Dialog's panel does: a Drawer
    // is architecture in the same family, so a theme that retunes
    // `--radius-contain` must move both. It rode a hardcoded `--radius-xl` (12px)
    // until 2026-08-02, which meant a project setting `--radius-contain: 0` got a
    // square Dialog next to a 12px Drawer with nothing documenting the exception.
    // For a softer sheet, raise the tier (and the Dialog follows, which is the point).
    placement: {
      left: {
        dialog: 'justify-start',
        panel: 'h-full max-w-[100dvw] rounded-r-contain border-l-0'
      },
      right: {
        dialog: 'justify-end',
        panel: 'h-full max-w-[100dvw] rounded-l-contain border-r-0'
      },
      top: {
        dialog: 'items-start',
        panel: 'w-full max-h-[100dvh] rounded-b-contain border-t-0'
      },
      bottom: {
        dialog: 'items-end',
        panel: 'w-full max-h-[100dvh] rounded-t-contain border-b-0'
      }
    },
    size: {
      sm: {},
      md: {},
      lg: {},
      xl: {},
      full: {}
    },
    // Semantic purpose. By default the Drawer paints no accent (symmetry with
    // Dialog — intent is surfaced only as `data-intent` for consumer hooks).
    // Each value additionally parks its colour in `--drawer-accent`, consumed
    // *only* when `accentEdge` is on (see the accentEdge×placement compounds).
    intent: {
      neutral: { panel: '[--drawer-accent:var(--color-border-strong)]' },
      primary: { panel: '[--drawer-accent:var(--color-primary)]' },
      secondary: { panel: '[--drawer-accent:var(--color-secondary)]' },
      success: { panel: '[--drawer-accent:var(--color-success)]' },
      warning: { panel: '[--drawer-accent:var(--color-warning)]' },
      danger: { panel: '[--drawer-accent:var(--color-danger)]' }
    },
    // Opt-in edge accent (DRW-1 completion). Off by default so the Drawer keeps
    // Dialog symmetry; on, the docked (viewport-facing) edge is thickened to 2px
    // and tinted in the intent colour via the placement compounds below.
    accentEdge: {
      true: {},
      false: {}
    }
  },
  compoundVariants: [
    // Horizontal (left/right) sizes
    { placement: 'left', size: 'sm', class: { panel: 'w-72' } },
    { placement: 'left', size: 'md', class: { panel: 'w-96' } },
    { placement: 'left', size: 'lg', class: { panel: 'w-[32rem]' } },
    { placement: 'left', size: 'xl', class: { panel: 'w-[42rem]' } },
    { placement: 'left', size: 'full', class: { panel: 'w-full' } },
    { placement: 'right', size: 'sm', class: { panel: 'w-72' } },
    { placement: 'right', size: 'md', class: { panel: 'w-96' } },
    { placement: 'right', size: 'lg', class: { panel: 'w-[32rem]' } },
    { placement: 'right', size: 'xl', class: { panel: 'w-[42rem]' } },
    { placement: 'right', size: 'full', class: { panel: 'w-full' } },
    // Vertical (top/bottom) sizes
    { placement: 'top', size: 'sm', class: { panel: 'h-48' } },
    { placement: 'top', size: 'md', class: { panel: 'h-72' } },
    { placement: 'top', size: 'lg', class: { panel: 'h-96' } },
    { placement: 'top', size: 'xl', class: { panel: 'h-[32rem]' } },
    { placement: 'top', size: 'full', class: { panel: 'h-full' } },
    { placement: 'bottom', size: 'sm', class: { panel: 'h-48' } },
    { placement: 'bottom', size: 'md', class: { panel: 'h-72' } },
    { placement: 'bottom', size: 'lg', class: { panel: 'h-96' } },
    { placement: 'bottom', size: 'xl', class: { panel: 'h-[32rem]' } },
    { placement: 'bottom', size: 'full', class: { panel: 'h-full' } },
    // Edge accent (opt-in via `accentEdge`). The tinted 2px border lands on the
    // *inner* edge — the one facing the viewport — so it reads as a coloured seam
    // between the drawer and the page, never a floating outline. Placement picks
    // the physical side; the colour comes from `--drawer-accent` (intent axis).
    // Default (no accentEdge) leaves the panel exactly as before — Dialog symmetry.
    {
      accentEdge: true,
      placement: 'left',
      class: { panel: 'border-r-2 [border-right-color:var(--drawer-accent)]' }
    },
    {
      accentEdge: true,
      placement: 'right',
      class: { panel: 'border-l-2 [border-left-color:var(--drawer-accent)]' }
    },
    {
      accentEdge: true,
      placement: 'top',
      class: { panel: 'border-b-2 [border-bottom-color:var(--drawer-accent)]' }
    },
    {
      accentEdge: true,
      placement: 'bottom',
      class: { panel: 'border-t-2 [border-top-color:var(--drawer-accent)]' }
    }
  ],
  defaultVariants: {
    placement: 'right',
    size: 'md',
    intent: 'neutral',
    accentEdge: false
  }
});

export type DrawerVariants = VariantProps<typeof drawerVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type DrawerSlots = SlotNames<typeof drawerVariants>;
