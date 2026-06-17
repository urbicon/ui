import { tv, type VariantProps } from '$lib/utils/variants';

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
    placement: {
      left: {
        dialog: 'justify-start',
        panel: 'h-full max-w-[100dvw] rounded-r-xl border-l-0'
      },
      right: {
        dialog: 'justify-end',
        panel: 'h-full max-w-[100dvw] rounded-l-xl border-r-0'
      },
      top: {
        dialog: 'items-start',
        panel: 'w-full max-h-[100dvh] rounded-b-xl border-t-0'
      },
      bottom: {
        dialog: 'items-end',
        panel: 'w-full max-h-[100dvh] rounded-t-xl border-b-0'
      }
    },
    size: {
      sm: {},
      md: {},
      lg: {},
      xl: {},
      full: {}
    },
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
    { placement: 'bottom', size: 'full', class: { panel: 'h-full' } }
    // Intent accent borders removed — for symmetry with Dialog.
    // Intent is conveyed at the call site via icon + heading color.
  ],
  defaultVariants: {
    placement: 'right',
    size: 'md',
    intent: 'neutral'
  }
});

export type DrawerVariants = VariantProps<typeof drawerVariants>;
