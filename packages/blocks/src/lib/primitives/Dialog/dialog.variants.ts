import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const dialogVariants = tv({
  slots: {
    dialog: [
      // alignment + padding come from the placement variant so `placement="top"`
      // doesn't fight a base `items-end` rule on mobile.
      'fixed inset-0 z-[var(--z-modal)] flex justify-center',
      'bg-transparent border-none outline-none',
      'max-w-none max-h-none w-full h-full overflow-hidden'
    ],
    backdrop: 'fixed inset-0 z-[var(--z-overlay)] bg-black/50 backdrop-blur-sm',
    // tier: contain — modal panel surface.
    // Panel border is a hairline (barely visible) — the shadow carries the
    // lift perception. Header/footer use a hairline border as well.
    // Mobile bottom-sheet keeps top-only rounding; desktop rounds all corners.
    panel: [
      'relative flex flex-col bg-surface-overlay border border-border-hairline',
      'rounded-t-contain sm:rounded-contain',
      'shadow-[var(--blocks-shadow-lg)] w-full z-[var(--z-modal)]',
      'max-h-[85dvh] sm:max-h-[calc(100vh-3rem)] lg:max-h-[calc(100vh-4rem)]',
      'overflow-hidden'
    ],
    content: 'p-6 overflow-y-auto overscroll-contain flex-1',
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
    // overlays; reproduced deterministically from buttonVariants). See
    // internal/core/.
    closeButton: [
      'relative font-medium text-center whitespace-nowrap border overflow-hidden',
      'transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-[var(--blocks-duration-fast)] ease-out',
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
    size: {
      sm: { panel: 'sm:max-w-sm' },
      md: { panel: 'sm:max-w-md' },
      lg: { panel: 'sm:max-w-lg' },
      xl: { panel: 'sm:max-w-2xl' },
      full: {
        panel: ['max-w-[95vw] max-h-[95vh] w-full h-full', 'lg:max-w-[90vw] lg:max-h-[90vh]']
      },
      fullscreen: {
        panel: [
          'max-w-none w-screen h-screen max-h-screen',
          'rounded-none sm:rounded-none',
          'border-0'
        ]
      }
    },
    placement: {
      // Mobile keeps the bottom-sheet alignment so a swipe-up gesture
      // hits the bottom edge; desktop opens centered.
      center: { dialog: 'items-end p-0 sm:items-center sm:p-6 lg:p-8' },
      // pt-12 keeps a comfortable top breathing room on mobile; sm:pt-16 covered desktop.
      top: { dialog: 'items-start justify-center pt-12 sm:pt-16 px-4 sm:px-6 lg:px-8' }
    },
    // Intent is conveyed via icon + title color at the call site, NOT via a
    // 3px colored top border. The intent variant remains as a type marker but
    // acts purely semantically (e.g. for aria-tagging by consumers).
    intent: {
      neutral: {},
      primary: {},
      secondary: {},
      success: {},
      warning: {},
      danger: {}
    }
  },
  compoundVariants: [
    // Fullscreen owns the entire viewport — cancel any placement padding
    // so the panel can render at the true 100vw/100vh extent.
    { size: 'fullscreen', placement: 'center', class: { dialog: 'p-0 sm:p-0 lg:p-0' } },
    {
      size: 'fullscreen',
      placement: 'top',
      class: { dialog: 'pt-0 sm:pt-0 px-0 sm:px-0 lg:px-0' }
    }
  ],
  defaultVariants: {
    size: 'sm',
    placement: 'center',
    intent: 'neutral'
  }
});

export type DialogVariants = VariantProps<typeof dialogVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type DialogSlots = SlotNames<typeof dialogVariants>;
